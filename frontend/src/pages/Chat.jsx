import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';
import RoomList from '../components/RoomList';
import ChatWindow from '../components/ChatWindow';
import OnlineUsers from '../components/OnlineUsers';
import { X, Check, Clock, UserCheck, UserX, Loader2 } from 'lucide-react';

export default function Chat({ currentUser, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomMembers, setRoomMembers] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [requestingJoin, setRequestingJoin] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  // Join Requests state
  const [joinRequests, setJoinRequests] = useState([]);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);

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

  // Fetch pending join requests for active room (Admins/Owner only)
  const loadJoinRequests = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      const requests = await api.getJoinRequests(roomId);
      setJoinRequests(requests);
    } catch (err) {
      // Non-admins will fail silently
      setJoinRequests([]);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (activeRoom?.id) {
      setReplyingTo(null);
      loadRoomMembers(activeRoom.id);

      if (activeRoom.user_role === 'owner' || activeRoom.user_role === 'admin') {
        loadJoinRequests(activeRoom.id);
      } else {
        setJoinRequests([]);
      }
    }
  }, [activeRoom?.id, activeRoom?.user_role, loadRoomMembers, loadJoinRequests]);

  // Create room handler
  const handleCreateRoom = async (name, description, isPrivate = false) => {
    const newRoom = await api.createRoom(name, description, isPrivate);
    await loadRooms(newRoom.id);
  };

  // Leave room handler
  const handleLeaveRoom = async (roomId) => {
    if (!roomId || !currentUser?.id) return;
    try {
      await api.removeMember(roomId, currentUser.id);
      setActiveRoom(null);
      await loadRooms();
    } catch (err) {
      console.error('Failed to leave room:', err);
      alert(err.message || 'Failed to leave room.');
    }
  };

  // Submit Join Request handler
  const handleRequestJoin = async (roomId) => {
    try {
      setRequestingJoin(true);
      const updatedRoom = await api.requestToJoinRoom(roomId);
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? updatedRoom : r))
      );
      setActiveRoom(updatedRoom);
    } catch (err) {
      console.error('Failed to submit join request:', err);
      alert(err.message || 'Failed to submit join request.');
    } finally {
      setRequestingJoin(false);
    }
  };

  // Approve Request handler
  const handleApproveRequest = async (requestId) => {
    if (!activeRoom?.id) return;
    setProcessingRequestId(requestId);
    try {
      await api.approveJoinRequest(activeRoom.id, requestId);
      await loadJoinRequests(activeRoom.id);
      await loadRoomMembers(activeRoom.id);
      await loadRooms(activeRoom.id);
    } catch (err) {
      alert(err.message || 'Failed to approve request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Reject Request handler
  const handleRejectRequest = async (requestId) => {
    if (!activeRoom?.id) return;
    setProcessingRequestId(requestId);
    try {
      await api.rejectJoinRequest(activeRoom.id, requestId);
      await loadJoinRequests(activeRoom.id);
    } catch (err) {
      alert(err.message || 'Failed to reject request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    if (!activeRoom?.id) return;
    await api.updateMemberRole(activeRoom.id, userId, newRole);
    await loadRoomMembers(activeRoom.id);
  };

  const handleRemoveMember = async (userId) => {
    if (!activeRoom?.id) return;
    await api.removeMember(activeRoom.id, userId);
    await loadRoomMembers(activeRoom.id);
    await loadRooms(activeRoom.id);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden font-sans antialiased relative">
      {/* Left Sidebar - Rooms List */}
      <RoomList
        rooms={rooms}
        activeRoomId={activeRoom?.id}
        onSelectRoom={(room) => {
          setActiveRoom(room);
          setReplyingTo(null);
        }}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleRequestJoin}
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
        currentUser={currentUser}
        members={roomMembers}
        onSendMessage={sendMessage}
        onTyping={sendTyping}
        onRequestJoin={handleRequestJoin}
        requesting={requestingJoin}
        replyingTo={replyingTo}
        onReplyMessage={(msg) =>
          setReplyingTo({
            id: msg.id,
            user_id: msg.user_id,
            username: msg.username,
            content: msg.content,
          })
        }
        onCancelReply={() => setReplyingTo(null)}
        pendingRequestsCount={joinRequests.length}
        onOpenRequestsModal={() => setIsRequestsModalOpen(true)}
        onLeaveRoom={handleLeaveRoom}
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

      {/* Admin Join Requests Approval Modal */}
      {isRequestsModalOpen && activeRoom && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Pending Join Requests</h3>
                  <p className="text-xs text-slate-400">Review applicants for #{activeRoom.name}</p>
                </div>
              </div>

              <button
                onClick={() => setIsRequestsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
              {joinRequests.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No pending join requests for this room.
                </div>
              ) : (
                joinRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 uppercase text-xs">
                        {req.username?.[0] || 'U'}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-sm text-white truncate">{req.username}</div>
                        <div className="text-xs text-slate-400 truncate">{req.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        disabled={processingRequestId === req.id}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700 hover:border-red-500/40 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Reject
                      </button>

                      <button
                        onClick={() => handleApproveRequest(req.id)}
                        disabled={processingRequestId === req.id}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        {processingRequestId === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsRequestsModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
