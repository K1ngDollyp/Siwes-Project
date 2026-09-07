import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../api';

export function useWebSocket(roomId, token) {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [status, setStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const typingTimerRefs = useRef({});

  // Format WebSocket URL from http/https base URL
  const getWsUrl = useCallback(() => {
    if (!roomId || !token) return null;
    const httpUrl = API_BASE_URL.replace(/\/$/, '');
    const wsProtocol = httpUrl.startsWith('https') ? 'wss' : 'ws';
    const host = httpUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${host}/api/ws/${roomId}?token=${encodeURIComponent(token)}`;
  }, [roomId, token]);

  // Handle incoming messages
  const handleMessagePayload = useCallback((data) => {
    switch (data.type) {
      case 'history':
        if (data.messages) {
          setMessages(data.messages);
        }
        if (data.online_users) {
          setOnlineUsers(data.online_users);
        }
        break;

      case 'message':
        setMessages((prev) => {
          // Avoid duplicate messages by ID
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });

        // Remove sender from typing indicator when message received
        if (data.user_id) {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[data.user_id];
            return next;
          });
        }
        break;

      case 'typing':
        if (data.user_id && data.username) {
          setTypingUsers((prev) => ({
            ...prev,
            [data.user_id]: data.username,
          }));

          // Clear existing timer for user
          if (typingTimerRefs.current[data.user_id]) {
            clearTimeout(typingTimerRefs.current[data.user_id]);
          }

          // Auto clear typing status after 3 seconds
          typingTimerRefs.current[data.user_id] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[data.user_id];
              return next;
            });
          }, 3000);
        }
        break;

      case 'user_joined':
        if (data.online_users) {
          setOnlineUsers(data.online_users);
        }
        break;

      case 'user_left':
        if (data.online_users) {
          setOnlineUsers(data.online_users);
        }
        break;

      default:
        break;
    }
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!roomId || !token) {
      setStatus('disconnected');
      setMessages([]);
      setOnlineUsers([]);
      setTypingUsers({});
      return;
    }

    let isMounted = true;

    const connectWS = () => {
      const wsUrl = getWsUrl();
      if (!wsUrl) return;

      setStatus('connecting');
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setStatus('connected');
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);
          handleMessagePayload(payload);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        if (!isMounted) return;
        setStatus('disconnected');
        
        // Attempt reconnect after 3 seconds if not closed cleanly intentionally
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) connectWS();
          }, 3000);
        }
      };
    };

    connectWS();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      Object.values(typingTimerRefs.current).forEach(clearTimeout);
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [roomId, token, getWsUrl, handleMessagePayload]);

  // Action methods
  const sendMessage = useCallback((content) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'message',
          content,
        })
      );
    }
  }, []);

  const sendTyping = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'typing',
        })
      );
    }
  }, []);

  return {
    messages,
    onlineUsers,
    typingUsers: Object.values(typingUsers),
    status,
    sendMessage,
    sendTyping,
  };
}
