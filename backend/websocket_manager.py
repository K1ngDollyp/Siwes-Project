from typing import Dict, List, Tuple
from fastapi import WebSocket

class ConnectionManager:
    """Manages active WebSocket connections per room, user tracking, and broadcasts."""
    def __init__(self):
        # Mapping of room_id (str) -> List of (WebSocket, user_id (str))
        self.active_connections: Dict[str, List[Tuple[WebSocket, str]]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str):
        """Accepts WebSocket connection and registers client into active room connections."""
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append((websocket, user_id))

    def disconnect(self, websocket: WebSocket, room_id: str):
        """Removes disconnected WebSocket from the specified room."""
        if room_id in self.active_connections:
            self.active_connections[room_id] = [
                (ws, uid) for ws, uid in self.active_connections.get(room_id, [])
                if ws != websocket
            ]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, message: dict, room_id: str):
        """Broadcasts JSON payload to all active WebSocket connections in a room."""
        connections = self.active_connections.get(room_id, [])
        for websocket, _ in list(connections):
            try:
                await websocket.send_json(message)
            except Exception:
                # Catch closed socket exceptions gracefully
                pass

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Sends JSON payload directly to a specific connected WebSocket client."""
        try:
            await websocket.send_json(message)
        except Exception:
            pass

    def get_online_users(self, room_id: str) -> List[str]:
        """Returns list of active user_ids in the specified room."""
        return [uid for _, uid in self.active_connections.get(room_id, [])]


# Global Connection Manager instance
manager = ConnectionManager()
