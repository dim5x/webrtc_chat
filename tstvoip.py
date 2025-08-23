# server.py
import asyncio
import json
import os
from aiohttp import web, WSMsgType
import uuid


class WebRTCServer:
    def __init__(self):
        self.rooms = {}
        self.peer_rooms = {}
        self.connections = {}

    # В класс WebRTCServer добавить:
    async def handle_signaling_data(self, data, peer_id):
        if data['type'] == 'text_message':
            room_id = self.peer_rooms.get(peer_id)
            if room_id:
                # Отправляем сообщение всем в комнате
                for member_id in self.rooms[room_id]:
                    if member_id != peer_id and member_id in self.connections:
                        await self.connections[member_id].send_json({
                            'type': 'text_message',
                            'message': data['message'],
                            'from_peer': peer_id,
                            'timestamp': data.get('timestamp')
                        })

    async def websocket_handler(self, request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        peer_id = None
        room_id = '100'

        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    data = json.loads(msg.data)

                    if data['type'] == 'join':
                        peer_id = data['peer_id']
                        room_id = data.get('room_id')

                        if not room_id:
                            room_id = str(uuid.uuid4())[:8]

                        await self.handle_join(peer_id, room_id, ws, data)

                    elif data['type'] == 'offer':
                        await self.handle_offer(peer_id, data)

                    elif data['type'] == 'answer':
                        await self.handle_answer(peer_id, data)

                    elif data['type'] == 'ice-candidate':
                        await self.handle_ice_candidate(peer_id, data)

                    elif data['type'] == 'text_message':
                        await self.handle_text_message(peer_id, data)

                    elif data['type'] == 'leave':
                        await self.handle_disconnect(peer_id, room_id)

        except Exception as e:
            print(f"WebSocket error: {e}")
        finally:
            await self.handle_disconnect(peer_id, room_id)

        return ws

    async def handle_join(self, peer_id, room_id, ws, data):
        if room_id in self.rooms and len(self.rooms[room_id]) >= 3:
            await ws.send_json({
                'type': 'error',
                'message': 'Room is full (max 3 users)'
            })
            return

        self.connections[peer_id] = ws
        self.peer_rooms[peer_id] = room_id

        if room_id not in self.rooms:
            self.rooms[room_id] = []

        self.rooms[room_id].append(peer_id)

        # Отправляем новому участнику список всех в комнате
        await ws.send_json({
            'type': 'room_joined',
            'room_id': room_id,
            'peers': [p for p in self.rooms[room_id] if p != peer_id]
        })

        # Отправляем всем в комнате обновленный список участников
        await self.broadcast_peer_list(room_id)

        print(f"Peer {peer_id} joined room {room_id}. Peers: {self.rooms[room_id]}")

    async def handle_offer(self, peer_id, data):
        target_peer = data['target_peer']
        if (target_peer in self.connections and
                self.peer_rooms.get(peer_id) == self.peer_rooms.get(target_peer)):
            await self.connections[target_peer].send_json({
                'type': 'offer',
                'offer': data['offer'],
                'from_peer': peer_id
            })

    async def handle_answer(self, peer_id, data):
        target_peer = data['target_peer']
        if (target_peer in self.connections and
                self.peer_rooms.get(peer_id) == self.peer_rooms.get(target_peer)):
            await self.connections[target_peer].send_json({
                'type': 'answer',
                'answer': data['answer'],
                'from_peer': peer_id
            })

    async def handle_ice_candidate(self, peer_id, data):
        target_peer = data['target_peer']
        if (target_peer in self.connections and
                self.peer_rooms.get(peer_id) == self.peer_rooms.get(target_peer)):
            await self.connections[target_peer].send_json({
                'type': 'ice-candidate',
                'candidate': data['candidate'],
                'from_peer': peer_id
            })

    async def handle_text_message(self, peer_id, data):
        room_id = self.peer_rooms.get(peer_id)
        if not room_id or room_id not in self.rooms:
            return

        # Отправляем сообщение всем в комнате (включая отправителя)
        for member_id in self.rooms[room_id]:
            if member_id in self.connections:
                await self.connections[member_id].send_json({
                    'type': 'text_message',
                    'message': data['message'],
                    'from_peer': peer_id,
                    'timestamp': data.get('timestamp', '')
                })

    async def handle_disconnect(self, peer_id, room_id=None):
        if not room_id and peer_id in self.peer_rooms:
            room_id = self.peer_rooms[peer_id]

        if peer_id in self.connections:
            del self.connections[peer_id]

        if peer_id in self.peer_rooms:
            if not room_id:
                room_id = self.peer_rooms[peer_id]
            del self.peer_rooms[peer_id]

            if room_id in self.rooms and peer_id in self.rooms[room_id]:
                self.rooms[room_id].remove(peer_id)

                # Отправляем всем оставшимся обновленный список
                await self.broadcast_peer_list(room_id)

                if not self.rooms[room_id]:
                    del self.rooms[room_id]

            print(f"Peer {peer_id} disconnected from room {room_id}")

    async def broadcast_peer_list(self, room_id):
        """Отправляет всем в комнате текущий список участников"""
        if room_id not in self.rooms:
            return

        for member_id in self.rooms[room_id]:
            if member_id in self.connections:
                await self.connections[member_id].send_json({
                    'type': 'peer_list_update',
                    'peers': self.rooms[room_id]  # Отправляем весь список включая себя
                })


# Простой обработчик для главной страницы
async def index_handler(request):
    # Читаем файл index.html и отправляем его
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            content = f.read()
        return web.Response(text=content, content_type='text/html')
    except FileNotFoundError:
        return web.Response(text='<h1>File index.html not found</h1>', content_type='text/html')


# Обработчик для JavaScript файлов
async def js_handler(request):
    try:
        filename = request.match_info.get('filename', '')
        with open(f'static/{filename}', 'r', encoding='utf-8') as f:
            content = f.read()
        return web.Response(text=content, content_type='application/javascript')
    except FileNotFoundError:
        return web.Response(text='// File not found', content_type='application/javascript')


# Добавьте обработчик для CSS файлов
async def css_handler(request):
    try:
        with open('static/style.css', 'r', encoding='utf-8') as f:
            content = f.read()
        return web.Response(text=content, content_type='text/css')
    except FileNotFoundError:
        return web.Response(text='/* CSS file not found */', content_type='text/css')


async def main():
    server = WebRTCServer()

    app = web.Application()

    # Добавляем маршруты
    app.router.add_get('/', index_handler)
    app.router.add_get('/ws', server.websocket_handler)
    app.router.add_get('/static/{filename}', js_handler)
    app.router.add_get('/static/style.css', css_handler)
    # Запускаем сервер
    runner = web.AppRunner(app)
    await runner.setup()

    # site = web.TCPSite(runner, 'localhost', 8080)
    site = web.TCPSite(runner, '0.0.0.0', 8080)  # Для доступа извне
    await site.start()
    print("Server started at http://localhost:8080")
    print("Make sure you have index.html and static/client.js files in the same directory")

    await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(main())
