import React, { useState } from 'react';
import { Users, Circle, Shield, ShieldCheck, UserX, Crown, Loader2 } from 'lucide-react';

export default function OnlineUsers({
  members,
  onlineUserIds,
  currentUserId,
  userRole,
  onUpdateRole,
  onRemoveMember
}) {
  const [loadingUserId, setLoadingUserId] = useState(null);

  const isCallerAdminOrOwner = userRole === 'owner' || userRole === 'admin';

  // Sort members: owner first, then admins, then online users, then offline users
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === 'owner') return -1;
    if (b.role === 'owner') return 1;
    if (a.user_id === currentUserId) return -1;
    if (b.user_id === currentUserId) return 1;
    const aOnline = onlineUserIds.includes(a.user_id);
    const bOnline = onlineUserIds.includes(b.user_id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  const handleToggleAdmin = async (member) => {
    if (member.role === 'owner') return;
    setLoadingUserId(member.user_id);
    try {
      const newRole = member.role === 'admin' ? 'member' : 'admin';
      await onUpdateRole(member.user_id, newRole);
    } catch (err) {
      alert(err.message || 'Failed to update member role');
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleKickMember = async (member) => {
    if (member.role === 'owner') return;
    if (!window.confirm(`Are you sure you want to remove ${member.username} from this group?`)) return;
    
    setLoadingUserId(member.user_id);
    try {
      await onRemoveMember(member.user_id);
    } catch (err) {
      alert(err.message || 'Failed to remove member');
    } finally {
      setLoadingUserId(null);
    }
  };

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
            const isTargetOwner = member.role === 'owner';
            const isTargetAdmin = member.role === 'admin';

            return (
              <div
                key={member.id || member.user_id}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 transition-all hover:border-slate-700"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex-shrink-0">
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
                      <span className="truncate">{member.username}</span>
                      {isMe && <span className="text-[10px] text-indigo-400 font-normal">(you)</span>}
                    </div>

                    <div className="flex items-center gap-1 mt-0.5">
                      {isTargetOwner ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <Crown className="w-2.5 h-2.5" />
                          Owner
                        </span>
                      ) : isTargetAdmin ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      ) : null}

                      <span className="text-[10px] text-slate-500 font-mono">
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Admin Management Controls */}
                <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                  {loadingUserId === member.user_id ? (
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : isCallerAdminOrOwner && !isMe ? (
                    isTargetOwner ? (
                      <span
                        className="p-1 text-slate-600 cursor-not-allowed"
                        title="Group Owner cannot be removed or demoted"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleToggleAdmin(member)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isTargetAdmin
                              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                          }`}
                          title={isTargetAdmin ? 'Demote to Regular Member' : 'Make Group Admin'}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleKickMember(member)}
                          className="p-1.5 bg-slate-800 hover:bg-red-600/30 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700 hover:border-red-500/40 transition-all cursor-pointer"
                          title="Remove from Group"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  ) : isOnline ? (
                    <Circle className="w-2 h-2 text-emerald-400 fill-emerald-400 animate-pulse" />
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
