import React, { useEffect, useRef } from 'react';
import { Hash, Users, Wifi, WifiOff, MessageSquare, UserPlus, Loader2 } from 'lucide-react';
import MessageInput from './MessageInput';

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Generate consistent avatar color based on username
function getAvatarColor(username) {
  const colors = [
    'from-indigo-600 to-blue-600',
    'from-violet-600 to-purple-600',
    'from-emerald-600 to-teal-600',
    'from-rose-600 to-pink-600',
    'from-amber-600 to-orange-600',
    'from-cyan-600 to-blue-600',
  ];
  let hash = 0;
  for (let i = 0; i < (username || '').length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ChatWindow({
  room,
  messages,
  typingUsers,
  status,
  onlineCount,
  currentUserId,
  onSendMessage,
  onTyping,
  onJoinRoom,
  joining
}) {
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Room Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm">
          Select a chat room from the sidebar or create a new room to start chatting in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Room Header */}
      <div className="h-16 px-6 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-base">{room.name}</h2>
            </div>
            <p className="text-xs text-slate-400">
              {room.description || 'Welcome to the room!'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Online count */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold">{onlineCount}</span>
            <span className="text-slate-400">online</span>
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-2 text-xs bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse'
                  : status === 'connecting'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-red-500'
              }`}
            />
            <span className="capitalize font-medium text-slate-300">
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!room.is_member ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-4">
              <UserPlus className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Join #{room.name}</h3>
            <p className="text-slate-400 text-sm max-w-sm mb-6">
              You are not a member of this room yet. Join now to view live chat and send messages!
            </p>
            <button
              onClick={() => onJoinRoom(room.id)}
              disabled={joining}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-all"
            >
              {joining && <Loader2 className="w-4 h-4 animate-spin" />}
              Join Room
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <MessageSquare className="w-12 h-12 mb-3 text-slate-700" />
            <p className="text-sm">No messages in this room yet. Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.user_id === currentUserId;

            return (
              <div
                key={msg.id || index}
                className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar Initials */}
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarColor(
                    msg.username
                  )} flex items-center justify-center text-white font-bold text-xs shadow-md flex-shrink-0`}
                >
                  {msg.username?.[0]?.toUpperCase() || 'U'}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[70%] flex flex-col ${
                    isMe ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-semibold text-slate-300">
                      {isMe ? 'You' : msg.username}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatRelativeTime(msg.created_at || msg.timestamp)}
                    </span>
                  </div>

                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers && typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 italic py-1 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Panel */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTyping={onTyping}
        disabled={!room.is_member || status !== 'connected'}
      />
    </div>
  );
}
