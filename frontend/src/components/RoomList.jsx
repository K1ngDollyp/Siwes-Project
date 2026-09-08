import React, { useState } from 'react';
import { Plus, Search, Hash, Users, LogOut, X, Loader2, Sparkles, Lock, Globe } from 'lucide-react';

export default function RoomList({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onJoinRoom,
  currentUser,
  onLogout,
  loading,
  unreadCounts = {}
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (room.description && room.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    setError('');

    try {
      await onCreateRoom(newRoomName.trim(), newRoomDesc.trim(), isPrivate);
      setNewRoomName('');
      setNewRoomDesc('');
      setIsPrivate(false);
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to create room.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800/80 flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base leading-tight">Chat Rooms</h2>
            <p className="text-slate-400 text-xs">{rooms.length} available</p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center cursor-pointer"
          title="Create New Room"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-xs gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <span>Loading rooms...</span>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-500 text-xs">
            {searchQuery ? 'No rooms match your search.' : 'No chat rooms exist yet. Create one!'}
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isActive = room.id === activeRoomId;
            const unreadCount = unreadCounts[room.id] || 0;

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room)}
                className={`group p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                  isActive
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-white shadow-sm'
                    : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isActive
                        ? 'bg-indigo-500/30 text-indigo-300'
                        : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {room.is_private ? <Lock className="w-4 h-4 text-amber-400" /> : <Hash className="w-4 h-4" />}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                      <span className="truncate">{room.name}</span>
                      {room.is_private ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                          Private
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                          Public
                        </span>
                      )}
                    </div>
                    {room.description && (
                      <div className="text-xs text-slate-400 truncate">{room.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {unreadCount > 0 && !isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-md shadow-indigo-600/30 animate-pulse">
                      {unreadCount}
                    </span>
                  )}

                  <span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-950/40 px-2 py-0.5 rounded-md border border-slate-800">
                    <Users className="w-3 h-3 text-slate-400" />
                    {room.member_count}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            {currentUser?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="truncate">
            <div className="text-sm font-semibold text-white truncate">{currentUser?.username}</div>
            <div className="text-xs text-slate-400 truncate">{currentUser?.email}</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Create Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Create New Chat Room</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Room Name *
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Developers Lounge"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="Brief summary of room topics..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Room Privacy Choice */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Room Access Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      !isPrivate
                        ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <span>Public Room</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Anyone can join instantly
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isPrivate
                        ? 'bg-amber-600/20 border-amber-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Private Room</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Requires admin approval to enter
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newRoomName.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-sm font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
