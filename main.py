import json
import os
import re
from pathlib import Path

from aiohttp import WSMsgType, web


BASE_DIR = Path(__file__).resolve().parent
MAX_MESSAGE_SIZE = 2 * 1024 * 1024
MAX_TEXT_LENGTH = 4_000
MAX_FILE_DATA_LENGTH = 1_400_000
MAX_ROOM_SIZE = 6
PEER_ID_PATTERN = re.compile(r"[A-Za-zА-Яа-яЁё -]{1,64}")


class SignalingHub:
    def __init__(self):
        self.rooms = {}
        self.peer_rooms = {}
        self.connections = {}

    async def join(self, room_id, peer_id, ws):
        room_id = room_id.strip()[:64] or "100"
        if not PEER_ID_PATTERN.fullmatch(peer_id):
            await ws.send_json({"type": "error", "message": "Invalid peer name"})
            return None
        if peer_id in self.connections:
            await ws.send_json({"type": "error", "message": "Peer name is already in use"})
            return None
        members = self.rooms.setdefault(room_id, set())
        if len(members) >= MAX_ROOM_SIZE:
            await ws.send_json({"type": "error", "message": "Room is full (max 6 users)"})
            return None

        self.connections[peer_id] = ws
        self.peer_rooms[peer_id] = room_id
        members.add(peer_id)
        await ws.send_json({
            "type": "room_joined",
            "peer_id": peer_id,
            "room_id": room_id,
            "peers": [member for member in members if member != peer_id],
        })
        await self.broadcast_peer_list(room_id)
        return peer_id

    async def disconnect(self, peer_id):
        if not peer_id:
            return

        self.connections.pop(peer_id, None)
        room_id = self.peer_rooms.pop(peer_id, None)
        if not room_id:
            return

        members = self.rooms.get(room_id)
        if not members:
            return

        members.discard(peer_id)
        if members:
            await self.broadcast_peer_list(room_id)
        else:
            del self.rooms[room_id]

    async def broadcast_peer_list(self, room_id):
        members = self.rooms.get(room_id, set())
        message = {"type": "peer_list_update", "peers": list(members)}
        for peer_id in tuple(members):
            ws = self.connections.get(peer_id)
            if ws and not ws.closed:
                await ws.send_json(message)

    async def relay(self, peer_id, data):
        message_type = data.get("type")
        room_id = self.peer_rooms.get(peer_id)
        if not room_id:
            return

        if message_type in {"offer", "answer", "ice-candidate"}:
            target_id = data.get("target_peer")
            if target_id not in self.rooms.get(room_id, set()):
                return
            field = {"offer": "offer", "answer": "answer", "ice-candidate": "candidate"}[message_type]
            if field not in data:
                return
            target = self.connections.get(target_id)
            if target and not target.closed:
                await target.send_json({"type": message_type, field: data[field], "from_peer": peer_id})
            return

        if message_type == "text_message":
            message = data.get("message")
            if not isinstance(message, str) or not message or len(message) > MAX_TEXT_LENGTH:
                return
            await self.broadcast(room_id, {
                "type": "text_message",
                "message": message,
                "from_peer": peer_id,
                "timestamp": data.get("timestamp", ""),
            })
            return

        if message_type == "file_message":
            required = ("file_name", "file_type", "file_size", "file_data")
            if any(field not in data for field in required):
                return
            if (not isinstance(data["file_name"], str) or not isinstance(data["file_type"], str)
                    or not isinstance(data["file_data"], str) or len(data["file_data"]) > MAX_FILE_DATA_LENGTH):
                return
            await self.broadcast(room_id, {
                "type": "file_message",
                "file_name": data["file_name"][:255],
                "file_type": data["file_type"][:100],
                "file_size": data["file_size"],
                "file_data": data["file_data"],
                "from_peer": peer_id,
                "timestamp": data.get("timestamp", ""),
            }, exclude=peer_id)

    async def broadcast(self, room_id, message, exclude=None):
        for member_id in tuple(self.rooms.get(room_id, set())):
            if member_id == exclude:
                continue
            ws = self.connections.get(member_id)
            if ws and not ws.closed:
                await ws.send_json(message)


async def websocket_handler(request):
    hub = request.app["hub"]
    ws = web.WebSocketResponse(max_msg_size=MAX_MESSAGE_SIZE)
    await ws.prepare(request)
    peer_id = None

    try:
        async for msg in ws:
            if msg.type == WSMsgType.ERROR:
                break
            if msg.type != WSMsgType.TEXT:
                continue
            try:
                data = json.loads(msg.data)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON format"})
                continue
            if not isinstance(data, dict):
                await ws.send_json({"type": "error", "message": "Message must be an object"})
                continue

            if data.get("type") == "join":
                if peer_id:
                    await ws.send_json({"type": "error", "message": "Already joined a room"})
                    continue
                room_id = data.get("room_id", "")
                requested_peer_id = data.get("peer_id")
                if not isinstance(room_id, str) or not isinstance(requested_peer_id, str):
                    await ws.send_json({"type": "error", "message": "Invalid room ID or peer name"})
                    continue
                peer_id = await hub.join(room_id, requested_peer_id, ws)
            elif data.get("type") == "leave":
                await hub.disconnect(peer_id)
                peer_id = None
            else:
                await hub.relay(peer_id, data)
    finally:
        await hub.disconnect(peer_id)

    return ws


async def health_handler(_request):
    return web.json_response({"status": "ok"})


async def index_handler(_request):
    return web.FileResponse(BASE_DIR / "index.html")


def create_app():
    app = web.Application()
    app["hub"] = SignalingHub()
    app.router.add_get("/", index_handler)
    app.router.add_get("/health", health_handler)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_static("/static/", BASE_DIR / "static")
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
