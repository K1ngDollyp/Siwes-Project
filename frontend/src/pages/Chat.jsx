import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';
import RoomList from '../components/RoomList';
import ChatWindow from '../components/ChatWindow';
import OnlineUsers from '../components/OnlineUsers';

export default function Chat({ currentUser, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomMembers, setRoomMembers] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const token = localStorage.getItem('chat_token');

  // Connect WebSocket to active room
  const {
    messages,
    onlineUsers,
    typingUsers,
    status,
    sendMessage,
    sendTyping
  } = useWebSocket(activeRoom?.id, token);

  // Fetch all chat rooms
  const loadRooms = useCallback(async (selectRoomId = null) => {
    try {
      setLoadingRooms(true);
      const data = await api.getRooms();
      setRooms(data);

      if (data.length > 0) {
        if (selectRoomId) {
          const target = data.find((r) => r.id === selectRoomId);
          if (target) setActiveRoom(target);
        } else if (!activeRoom) {
          setActiveRoom(data[0]);
        } else {
          const updatedActive = data.find((r) => r.id === activeRoom.id);
          if (updatedActive) setActiveRoom(updatedActive);
        }
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, [activeRoom]);

  // Fetch members for active room
  const loadRoomMembers = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      const members = await api.getRoomMembers(roomId);
      setRoomMembers(members);
    } catch (err) {
      console.error('Error fetching room members:', err);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (activeRoom?.id) {
      setReplyingTo(null);
      loadRoomMembers(activeRoom.id);
    }
  }, [activeRoom?.id, loadRoomMembers]);

  // Create room handler
  const handleCreateRoom = async (name, description) => {
    const newRoom = await api.createRoom(name, description);
    await loadRooms(newRoom.id);
  };

  // Join room handler
  const handleJoinRoom = async (roomId) => {
    try {
      setJoiningRoomId(roomId);
      const joinedRoom = await api.joinRoom(roomId);
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? { ...r, is_member: true, member_count: joinedRoom.member_count, user_role: joinedRoom.user_role }
            : r
        )
      );
      setActiveRoom((prev) =>
        prev?.id === roomId
          ? { ...prev, is_member: true, member_count: joinedRoom.member_count, user_role: joinedRoom.user_role }
          : prev
      );
      await loadRoomMembers(roomId);
    } catch (err) {
      console.error('Failed to join room:', err);
    } finally {
      setJoiningRoomId(null);
    }
  };

  // Update member role handler
  const handleUpdateRole = async (userId, newRole) => {
    if (!activeRoom?.id) return;
    await api.updateMemberRole(activeRoom.id, userId, newRole);
    await loadRoomMembers(activeRoom.id);
  };

  // Remove member handler
  const handleRemoveMember = async (userId) => {
    if (!activeRoom?.id) return;
    await api.removeMember(activeRoom.id, userId);
    await loadRoomMembers(activeRoom.id);
    await loadRooms(activeRoom.id);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden font-sans antialiased">
      {/* Left Sidebar - Rooms List */}
      <RoomList
        rooms={rooms}
        activeRoomId={activeRoom?.id}
        onSelectRoom={(room) => {
          setActiveRoom(room);
          setReplyingTo(null);
        }}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        currentUser={currentUser}
        onLogout={onLogout}
        loading={loadingRooms}
      />

      {/* Main Chat Center Panel */}
      <ChatWindow
        room={activeRoom}
        messages={messages}
        typingUsers={typingUsers}
        status={status}
        onlineCount={onlineUsers.length}
        currentUserId={currentUser?.id}
        onSendMessage={sendMessage}
        onTyping={sendTyping}
        onJoinRoom={handleJoinRoom}
        joining={joiningRoomId === activeRoom?.id}
        replyingTo={replyingTo}
        onReplyMessage={(msg) =>
          setReplyingTo({
            id: msg.id,
            username: msg.username,
            content: msg.content,
          })
        }
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Right Sidebar - Online Users in Active Room */}
      {activeRoom && (
        <OnlineUsers
          members={roomMembers}
          onlineUserIds={onlineUsers}
          currentUserId={currentUser?.id}
          userRole={activeRoom.user_role}
          onUpdateRole={handleUpdateRole}
          onRemoveMember={handleRemoveMember}
        />
      )}
    </div>
  );
}
