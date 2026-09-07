import React from 'react';
import { Users, Circle, ShieldCheck } from 'lucide-react';

export default function OnlineUsers({ members, onlineUserIds, currentUserId }) {
  // Sort members: current user first, then online users, then offline users
  const sortedMembers = [...members].sort((a, b) => {
    if (a.user_id === currentUserId) return -1;
    if (b.user_id === currentUserId) return 1;
    const aOnline = onlineUserIds.includes(a.user_id);
    const bOnline = onlineUserIds.includes(b.user_id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="w-64 bg-slate-900 border-l border-slate-800/80 flex flex-col h-full select-none">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-sm">Room Members</h3>
        </div>
        <span className="text-xs bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded-full border border-slate-700">
          {onlineUserIds.length} online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {members.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">No members found</div>
        ) : (
          sortedMembers.map((member) => {
            const isOnline = onlineUserIds.includes(member.user_id);
            const isMe = member.user_id === currentUserId;

            return (
              <div
                key={member.id || member.user_id}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 uppercase">
                      {member.username?.[0] || 'U'}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white flex items-center gap-1 truncate">
                      <span>{member.username}</span>
                      {isMe && <span className="text-[10px] text-indigo-400 font-normal">(you)</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{isOnline ? 'Online' : 'Offline'}</div>
                  </div>
                </div>

                {isOnline && (
                  <Circle className="w-2 h-2 text-emerald-400 fill-emerald-400 flex-shrink-0 ml-1 animate-pulse" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
