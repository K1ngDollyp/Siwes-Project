const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('chat_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('chat_token');
      localStorage.removeItem('chat_user');
      window.location.reload();
    }
    const error = new Error(data.detail || 'An error occurred while processing your request');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth API
  register: (username, email, password) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Rooms API
  getRooms: () => request('/api/rooms'),

  createRoom: (name, description) =>
    request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  requestToJoinRoom: (roomId) =>
    request(`/api/rooms/${roomId}/join-request`, {
      method: 'POST',
    }),

  getJoinRequests: (roomId) => request(`/api/rooms/${roomId}/join-requests`),

  approveJoinRequest: (roomId, requestId) =>
    request(`/api/rooms/${roomId}/join-requests/${requestId}/approve`, {
      method: 'POST',
    }),

  rejectJoinRequest: (roomId, requestId) =>
    request(`/api/rooms/${roomId}/join-requests/${requestId}/reject`, {
      method: 'POST',
    }),

  getRoomMembers: (roomId) => request(`/api/rooms/${roomId}/members`),

  updateMemberRole: (roomId, userId, role) =>
    request(`/api/rooms/${roomId}/members/${userId}/role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  removeMember: (roomId, userId) =>
    request(`/api/rooms/${roomId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Messages API
  getMessages: (roomId, limit = 50, offset = 0) =>
    request(`/api/rooms/${roomId}/messages?limit=${limit}&offset=${offset}`),
};

export { API_BASE_URL };
