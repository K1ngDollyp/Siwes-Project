import React, { useEffect, useRef } from 'react';
import { Hash, Users, MessageSquare, UserPlus, Loader2, Reply, Clock, ShieldAlert } from 'lucide-react';
import MessageInput from './MessageInput';

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';

  let str = String(timestamp);
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('Z')) {
    str = str + 'Z';
  }

  const date = new Date(str);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 10) return 'just now';
  if (diffInSeconds < 60) return `${Math.max(1, diffInSeconds)}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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
  onRequestJoin,
  requesting,
  replyingTo,
  onReplyMessage,
  onCancelReply,
  pendingRequestsCount,
  onOpenRequestsModal
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const isAdminOrOwner = room?.user_role === 'owner' || room?.user_role === 'admin';

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-4 shadow-inner">
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
      <div className="h-16 px-6 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between z-10 backdrop-blur-md select-none">
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

        <div className="flex items-center gap-3">
          {/* Admin Pending Requests Button */}
          {isAdminOrOwner && (
            <button
              onClick={onOpenRequestsModal}
              className="flex items-center gap-2 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm"
              title="Review Join Requests"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          )}

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
          <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
            {room.join_request_status === 'pending' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-4 shadow-inner">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Request Pending Approval</h3>
                <p className="text-slate-400 text-sm max-w-md mb-6">
                  Your request to join <span className="text-white font-semibold">#{room.name}</span> has been sent to group admins. You will gain access as soon as an admin approves your request.
                </p>
                <div className="px-5 py-2.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Awaiting Group Admin Review
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-4 shadow-inner">
                  <UserPlus className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Join #{room.name}</h3>
                <p className="text-slate-400 text-sm max-w-sm mb-6">
                  This group requires admin approval to enter. Submit a join request to get started!
                </p>
                <button
                  onClick={() => onRequestJoin(room.id)}
                  disabled={requesting}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-all"
                >
                  {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Request to Join Room
                </button>
              </>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 select-none">
            <MessageSquare className="w-12 h-12 mb-3 text-slate-700" />
            <p className="text-sm">No messages in this room yet. Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.user_id === currentUserId;

            return (
              <div
                key={msg.id || index}
                className={`group flex items-start gap-3 relative ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarColor(
                    msg.username
                  )} flex items-center justify-center text-white font-bold text-xs shadow-md flex-shrink-0`}
                >
                  {msg.username?.[0]?.toUpperCase() || 'U'}
                </div>

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
                    className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                    }`}
                  >
                    {msg.reply_to && (
                      <div className="mb-2 p-2 rounded-xl bg-black/25 border-l-2 border-indigo-400 text-xs">
                        <div className="font-semibold text-indigo-300 mb-0.5">
                          @{msg.reply_to.username}
                        </div>
                        <div className="text-slate-300 italic line-clamp-2">
                          "{msg.reply_to.content}"
                        </div>
                      </div>
                    )}

                    {msg.content}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onReplyMessage(msg)}
                  className={`opacity-0 group-hover:opacity-100 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all cursor-pointer shadow-md self-center ${
                    isMe ? 'mr-2' : 'ml-2'
                  }`}
                  title="Reply to message"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}

        {typingUsers && typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 italic py-1 animate-pulse select-none">
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
        replyingTo={replyingTo}
        onCancelReply={onCancelReply}
      />
    </div>
  );
}
