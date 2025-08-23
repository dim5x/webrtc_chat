// static/client.js
class GroupVoiceChat {
    constructor() {
        this.peerId = Math.random().toString(36).substr(2, 9);
        this.roomId = null;
        this.localStream = null;
        this.peerConnections = {};
        this.remoteStreams = {};
        this.ws = null;
        this.isMuted = false;
        this.isDeafened = false;
        this.isConnecting = false;
        this.audioContext = null;
        this.analyser = null;

        this.init();
    }

    // async init() {
    //     document.getElementById('myId').textContent = this.peerId;
    //     this.setupEventListeners();
    //     this.setupTextChat();
    //     this.addMessageToChat();
    //     this.sendTextMessage();
    //     this.escapeHtml();
    //
    //     // Запрашиваем разрешение на уведомления
    //     if ('Notification' in window && Notification.permission === 'default') {
    //         Notification.requestPermission();
    //     }
    // }
    async init() {
        // Проверяем что все элементы существуют
        const requiredElements = [
            'joinRoom', 'leaveRoom', 'muteIcon', 'deafenIcon',
            'messageInput', 'sendMessage', 'roomId', 'status',
            'statusCompact', 'myId', 'currentRoom', 'participantCount'
        ];

        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                console.error('Element not found:', id);
            } else {
                console.log('Element found:', id);
            }
        });

        const myIdElement = document.getElementById('myId');
        if (myIdElement) {
            myIdElement.textContent = this.peerId;
        }

        this.setupEventListeners();
        this.setupTextChat();

        // Запрашиваем разрешение на уведомления
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.log('Notification permission denied');
            }
        }
    }

    async setupTextChat() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');

        document.getElementById('sendMessage').addEventListener('click', () => {
            this.sendTextMessage();
        });

        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessage();
            }
        });
    }

    async sendTextMessage() {
        const message = this.messageInput.value.trim();
        if (message && this.ws && this.ws.readyState === WebSocket.OPEN) {
            // ТОЛЬКО отправляем сообщение на сервер
            // НЕ добавляем локально, сервер вернет его всем
            this.ws.send(JSON.stringify({
                type: 'text_message',
                message: message,
                timestamp: new Date().toISOString()
            }));

            this.messageInput.value = '';
        }
    }

    async addMessageToChat(peerId, message, isOwn = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own-message' : 'other-message'}`;

        const time = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Создаем заголовок с отправителем и временем
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';

        // Аватарка (первая буква имени)
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.textContent = isOwn ? 'Y' : peerId.substr(0, 1).toUpperCase();

        // Имя отправителя
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = isOwn ? 'You' : `User ${peerId.substr(0, 6)}`;

        // Время
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = time;

        // Собираем заголовок в правильном порядке
        if (isOwn) {
            // Для своих: время → имя → аватар
            headerDiv.appendChild(timeSpan);
            headerDiv.appendChild(senderSpan);
            headerDiv.appendChild(avatarDiv);
        } else {
            // Для чужих: аватар → имя → время
            headerDiv.appendChild(avatarDiv);
            headerDiv.appendChild(senderSpan);
            headerDiv.appendChild(timeSpan);
        }

        // Создаем контент сообщения
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;

        // Собираем сообщение
        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(contentDiv);

        const chatMessages = document.getElementById('chatMessages');
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Уведомления для чужих сообщений
        if (!isOwn && document.hidden) {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('New message', {
                    body: `From ${peerId.substr(0, 6)}: ${message}`,
                    icon: '/favicon.ico'
                });
            }
        }
    }


    async joinRoom(roomId = '') {
        console.log('Join room called with roomId:', roomId);
        // Если roomId пустой, используем значение из input или "100"
        if (!roomId) {
            const roomInput = document.getElementById('roomId');
            roomId = roomInput.value.trim() || '100'; // По умолчанию "100"
            roomInput.value = roomId; // Обновляем значение в input
        }
        if (this.isConnecting) {
            console.log('Already connecting, skipping...');
            return;
        }

        this.isConnecting = true;
        const joinButton = document.getElementById('joinRoom');

        // Безопасное получение элементов
        const statusElement = document.getElementById('status');
        const statusCompactElement = document.getElementById('statusCompact');

        if (joinButton) joinButton.disabled = true;
        if (statusElement) statusElement.textContent = 'Connecting...';
        if (statusCompactElement) statusCompactElement.textContent = 'Connecting...';

        try {
            console.log('Step 1: Connecting WebSocket...');
            await this.connectWebSocket();

            console.log('Step 2: Waiting for WebSocket to be ready...');
            await this.waitForWebSocketConnection();

            console.log('Step 3: Sending join message...');
            this.ws.send(JSON.stringify({
                type: 'join',
                peer_id: this.peerId,
                room_id: roomId
            }));

            console.log('Join message sent successfully');

        } catch (error) {
            console.error('Error in join process:', error);
            alert('Error joining room: ' + error.message);

            if (joinButton) joinButton.disabled = false;
            this.isConnecting = false;

            if (statusElement) statusElement.textContent = 'Connection failed';
            if (statusCompactElement) statusCompactElement.textContent = 'Failed';
        }
    }

    async connectWebSocket() {
        console.log('connectWebSocket called');

        // Проверяем есть ли уже активное соединение
        if (this.ws) {
            console.log('Existing WebSocket found, state:', this.ws.readyState);

            if (this.ws.readyState === WebSocket.OPEN) {
                console.log('WebSocket already open, reusing');
                return Promise.resolve();
            }

            if (this.ws.readyState === WebSocket.CONNECTING) {
                console.log('WebSocket already connecting, waiting...');
                // Ждем завершения подключения
                return this.waitForWebSocketConnection();
            }

            // Если соединение закрыто или закрывается, создаем новое
            console.log('WebSocket in state', this.ws.readyState, ', creating new connection');
            this.ws.close(); // Закрываем старое соединение
        }

        return new Promise((resolve, reject) => {
            console.log('Creating new WebSocket connection to ws://localhost:8080/ws');

            try {
                this.ws = new WebSocket('ws://localhost:8080/ws');
                console.log('WebSocket object created');

                // Таймаут для подключения
                const connectionTimeout = setTimeout(() => {
                    console.error('WebSocket connection timeout');
                    reject(new Error('WebSocket connection timeout'));
                    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                        this.ws.close();
                    }
                }, 10000); // 10 секунд таймаут

                this.ws.onopen = () => {
                    console.log('WebSocket connection opened successfully');
                    clearTimeout(connectionTimeout);

                    const statusElement = document.getElementById('status');
                    const statusCompactElement = document.getElementById('statusCompact');

                    if (statusElement) statusElement.textContent = 'Connected to server';
                    if (statusCompactElement) {
                        statusCompactElement.textContent = 'Connected';
                        statusCompactElement.classList.add('connected');
                    }

                    resolve();
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket connection error:', error);
                    clearTimeout(connectionTimeout);
                    reject(new Error('WebSocket connection failed'));
                };

                this.ws.onclose = (event) => {
                    console.log('WebSocket connection closed:', event.code, event.reason);
                    clearTimeout(connectionTimeout);

                    const statusElement = document.getElementById('status');
                    const statusCompactElement = document.getElementById('statusCompact');

                    if (statusElement) statusElement.textContent = 'Disconnected from server';
                    if (statusCompactElement) {
                        statusCompactElement.textContent = 'Disconnected';
                        statusCompactElement.classList.remove('connected');
                    }

                    if (this.isConnecting) {
                        reject(new Error('WebSocket closed during connection'));
                    }
                };

                this.ws.onmessage = (event) => {
                    try {
                        console.log('WebSocket message received:', event.data);
                        const data = JSON.parse(event.data);
                        this.handleSignalingData(data);
                    } catch (e) {
                        console.error('Error parsing WebSocket message:', e, event.data);
                    }
                };

            } catch (error) {
                console.error('Error creating WebSocket:', error);
                reject(new Error('Failed to create WebSocket'));
            }
        });
    }

    waitForWebSocketConnection() {
        console.log('Waiting for WebSocket connection...');

        return new Promise((resolve, reject) => {
            const maxWaitTime = 15000; // 15 секунд
            const startTime = Date.now();
            const checkInterval = 100; // Проверяем каждые 100ms

            const checkConnection = () => {
                if (!this.ws) {
                    console.error('WebSocket not initialized');
                    reject(new Error('WebSocket not initialized'));
                    return;
                }

                console.log('WebSocket state:', this.ws.readyState);

                if (this.ws.readyState === WebSocket.OPEN) {
                    console.log('WebSocket connected successfully');
                    resolve();
                } else if (this.ws.readyState === WebSocket.CLOSED ||
                    this.ws.readyState === WebSocket.CLOSING) {
                    console.error('WebSocket failed to connect');
                    reject(new Error('WebSocket failed to connect'));
                } else if (Date.now() - startTime > maxWaitTime) {
                    console.error('WebSocket connection timeout');
                    reject(new Error('WebSocket connection timeout'));
                } else {
                    setTimeout(checkConnection, checkInterval);
                }
            };

            checkConnection();
        });
    }

    async handleSignalingData(data) {
        switch (data.type) {
            case 'room_joined':
                this.handleRoomJoined(data);
                break;
            case 'peer_joined':
                this.handlePeerJoined(data.peer_id);
                break;
            case 'peer_left':
                this.handlePeerLeft(data.peer_id);
                break;
            case 'peer_list_update':  // ← НОВЫЙ ОБРАБОТЧИК
                this.handlePeerListUpdate(data.peers);
                break;
            case 'offer':
                await this.handleOffer(data);
                break;
            case 'answer':
                await this.handleAnswer(data);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(data);
                break;
            // case 'text_message':
            //     this.addMessageToChat(data.from_peer, data.message);
            //     break;
            case 'text_message':
                const isOwnMessage = data.from_peer === this.peerId;
                console.log('Received message:', {from: data.from_peer, own: this.peerId, isOwn: isOwnMessage});
                this.addMessageToChat(data.from_peer, data.message, isOwnMessage);
                break;
            case 'error':
                alert(data.message);
                this.isConnecting = false;
                document.getElementById('joinRoom').disabled = false;
                break;
        }
    }

    handlePeerListUpdate(peers) {
        console.log('Peer list updated:', peers);
        this.updatePeerList(peers);
    }

    handleRoomJoined(data) {
    this.roomId = data.room_id;
    this.isConnecting = false;

    // Безопасное получение элементов
    const leaveButton = document.getElementById('leaveRoom');
    const muteButton = document.getElementById('muteIcon');
    const deafenButton = document.getElementById('deafenIcon');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const joinButton = document.getElementById('joinRoom');
    const roomIdInput = document.getElementById('roomId');
    const statusElement = document.getElementById('status');
    const statusCompactElement = document.getElementById('statusCompact');
    const currentRoomElement = document.getElementById('currentRoom');
    const participantCountElement = document.getElementById('participantCount');

    // Обновляем информацию о комнате
    if (currentRoomElement) currentRoomElement.textContent = this.roomId;

    // Активируем элементы управления
    if (leaveButton) leaveButton.disabled = false;
    if (muteButton) muteButton.disabled = false;
    if (deafenButton) deafenButton.disabled = false;
    if (messageInput) messageInput.disabled = false;
    if (sendButton) sendButton.disabled = false;

    // Деактивируем кнопку Join
    if (joinButton) joinButton.disabled = true;
    if (roomIdInput) roomIdInput.disabled = true;

    // Обновляем статус
    if (statusElement) statusElement.textContent = 'Connected to room ' + this.roomId;
    if (statusCompactElement) {
        statusCompactElement.textContent = 'Connected';
        statusCompactElement.classList.add('connected');
    }

    // Обновляем список участников с сервера (включая себя)
    const allPeers = [this.peerId, ...data.peers];
    this.updatePeerList(allPeers);

    // Подключаемся к существующим пирам
    setTimeout(() => {
        data.peers.forEach(peerId => {
            this.connectToPeer(peerId);
        });
    }, 1000);

    console.log(`Joined room: ${this.roomId} with peers:`, data.peers);
}

    async connectToPeer(peerId) {
        if (this.peerConnections[peerId]) return;

        try {
            if (!this.localStream) {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    },
                    video: false
                }).catch(error => {
                    console.error('Error accessing microphone:', error);
                    throw new Error('Microphone access denied. Please allow microphone access.');
                });


            }

            const pc = this.createPeerConnection(peerId);
            this.peerConnections[peerId] = pc;

            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Проверяем что WebSocket еще открыт перед отправкой
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'offer',
                    offer: offer,
                    target_peer: peerId
                }));
            }
            this.updateAudioElements();

        } catch (error) {
            console.error('Error connecting to peer:', error);
            if (error.message.includes('Microphone access denied')) {
                alert('Please allow microphone access to use voice chat');
                this.leaveRoom();
            }
        }
    }

    createPeerConnection(peerId) {
        const configuration = {
            iceServers: [
                {urls: 'stun:stun.l.google.com:19302'},
                {urls: 'stun:stun1.l.google.com:19302'},
                {urls: 'stun:stun2.l.google.com:19302'}
            ]
        };

        const pc = new RTCPeerConnection(configuration);

        pc.onicecandidate = (event) => {
            if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    target_peer: peerId
                }));
            }
        };

        pc.ontrack = (event) => {
            this.remoteStreams[peerId] = event.streams[0];
            this.updateAudioElements();
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`ICE connection state with ${peerId}: ${pc.iceConnectionState}`);
        };

        return pc;
    }

    updateAudioElements() {
        const audioContainer = document.getElementById('audioOutputContainer');
        if (!audioContainer) return;

        audioContainer.innerHTML = '';

        if (Object.keys(this.remoteStreams).length > 0 && !this.isDeafened) {
            const title = document.createElement('div');
            title.className = 'audio-stream-info';
            title.textContent = `${Object.keys(this.remoteStreams).length} active stream(s)`;
            audioContainer.appendChild(title);
        }

        Object.entries(this.remoteStreams).forEach(([peerId, stream]) => {
            if (!this.isDeafened) {
                const audioWrapper = document.createElement('div');
                audioWrapper.style.margin = '8px 0';

                const audio = document.createElement('audio');
                audio.className = 'remote-audio';
                audio.srcObject = stream;
                audio.autoplay = true;
                audio.controls = true;
                audio.title = `Peer: ${peerId}`;
                audio.dataset.peerId = peerId; // ← ДОБАВИТЬ ЭТО

                // Устанавливаем громкость из регулятора
                const volumeSlider = document.querySelector(`.volume-slider[data-peer-id="${peerId}"]`);
                if (volumeSlider) {
                    audio.volume = volumeSlider.value / 100;
                }

                const info = document.createElement('div');
                info.className = 'audio-stream-info';
                info.textContent = `Peer: ${peerId.substr(0, 6)}`;

                audioWrapper.appendChild(audio);
                audioWrapper.appendChild(info);
                audioContainer.appendChild(audioWrapper);
            }
        });

        if (Object.keys(this.remoteStreams).length === 0 || this.isDeafened) {
            const noAudioMessage = document.createElement('div');
            noAudioMessage.style.color = '#72767d';
            noAudioMessage.style.fontSize = '12px';
            noAudioMessage.style.textAlign = 'center';
            noAudioMessage.style.padding = '10px';

            if (this.isDeafened) {
                noAudioMessage.textContent = 'Audio deafened';
                noAudioMessage.style.color = '#ed4245';
            } else {
                noAudioMessage.textContent = 'No active audio streams';
            }

            audioContainer.appendChild(noAudioMessage);
        }
    }

    async handlePeerJoined(peerId) {
        // this.updatePeerList();
        // Даем время новому пиру настроить соединение
        setTimeout(() => {
            this.connectToPeer(peerId);
        }, 500);
    }

    handlePeerLeft(peerId) {
        if (this.peerConnections[peerId]) {
            this.peerConnections[peerId].close();
            delete this.peerConnections[peerId];
        }
        delete this.remoteStreams[peerId];
        // this.updatePeerList();
        this.updateAudioElements(); // Обновляем аудио элементы
    }

    // Перепишем метод updatePeerList полностью
    updatePeerList(peers = null) {
    const peerList = document.getElementById('peerList');
    if (!peerList) return;

    // Если peers не передан, используем текущие подключения
    const currentPeers = peers || Object.keys(this.peerConnections);

    peerList.innerHTML = '';

    // Добавляем только если мы в комнате
    if (this.roomId) {
        // Добавляем текущего пользователя
        const selfDiv = document.createElement('div');
        selfDiv.className = 'participant';
        selfDiv.innerHTML = `
            <div class="participant-avatar">Y</div>
            <div class="participant-info">
                <div class="participant-name">You (${this.peerId.substr(0, 6)})</div>
                <div class="status-online">● Online</div>
            </div>
            <div class="volume-control" style="display: none;">
                <input type="range" min="0" max="100" value="100" class="volume-slider">
            </div>
        `;
        peerList.appendChild(selfDiv);

        // Добавляем других участников из списка сервера
        currentPeers.forEach(peerId => {
            if (peerId !== this.peerId) {
                const participantDiv = document.createElement('div');
                participantDiv.className = 'participant';
                participantDiv.dataset.peerId = peerId;

                participantDiv.innerHTML = `
                    <div class="participant-avatar">${peerId.substr(0, 1).toUpperCase()}</div>
                    <div class="participant-info">
                        <div class="participant-name">User ${peerId.substr(0, 6)}</div>
                        <div class="status-online">● Online</div>
                    </div>
                    <div class="volume-control">
                        <input type="range" min="0" max="100" value="100" 
                               class="volume-slider" data-peer-id="${peerId}">
                    </div>
                `;
                peerList.appendChild(participantDiv);
            }
        });

        // Обновляем счетчик
        const participantCountElement = document.getElementById('participantCount');
        if (participantCountElement) {
            participantCountElement.textContent = currentPeers.length;
        }

        // Настраиваем регуляторы громкости
        this.setupVolumeControls();
    } else {
        // Показываем пустой список если не в комнате
        peerList.innerHTML = `
            <div class="participant">
                <div class="participant-avatar">Y</div>
                <div class="participant-info">
                    <div class="participant-name">You</div>
                    <div class="status-offline">● Offline</div>
                </div>
            </div>
        `;
        document.getElementById('participantCount').textContent = '0';
    }
}

    setupVolumeControls() {
        const sliders = document.querySelectorAll('.volume-slider');
        sliders.forEach(slider => {
            const peerId = slider.dataset.peerId;
            if (peerId) {
                slider.addEventListener('input', (e) => {
                    this.setPeerVolume(peerId, e.target.value / 100);
                });
            }
        });
    }

    setPeerVolume(peerId, volume) {
        const audioElement = document.querySelector(`audio[title*="${peerId}"]`);
        if (audioElement) {
            audioElement.volume = volume;
        }

        // Также обновляем громкость в remoteStreams если нужно
        if (this.remoteStreams[peerId]) {
            // Здесь можно добавить обработку громкости на уровне Web Audio API
            // если нужно более точное управление
        }
    }

    async handleOffer(data) {
        try {
            if (!this.localStream) {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true
                    },
                    video: false
                });


            }

            const pc = this.createPeerConnection(data.from_peer);
            this.peerConnections[data.from_peer] = pc;

            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });

            await pc.setRemoteDescription(data.offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'answer',
                    answer: answer,
                    target_peer: data.from_peer
                }));
            }

        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(data) {
        const pc = this.peerConnections[data.from_peer];
        if (pc) {
            await pc.setRemoteDescription(data.answer);
        }
    }

    async handleIceCandidate(data) {
        const pc = this.peerConnections[data.from_peer];
        if (pc) {
            await pc.addIceCandidate(data.candidate);
        }
    }


    leaveRoom() {
    console.log('Leaving room...');

    // Безопасное получение элементов
    const joinButton = document.getElementById('joinRoom');
    const leaveButton = document.getElementById('leaveRoom');
    const muteButton = document.getElementById('muteIcon');
    const deafenButton = document.getElementById('deafenIcon');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const roomIdInput = document.getElementById('roomId');
    const statusElement = document.getElementById('status');
    const statusCompactElement = document.getElementById('statusCompact');
    const currentRoomElement = document.getElementById('currentRoom');
    const participantCountElement = document.getElementById('participantCount');
    const chatMessagesElement = document.getElementById('chatMessages');
    const peerListElement = document.getElementById('peerList');
    const audioContainer = document.getElementById('audioOutputContainer');

    // Удаляем визуализатор
    // this.removeAudioVisualizer();

    // Сбрасываем элементы управления
    if (joinButton) joinButton.disabled = false;
    if (leaveButton) leaveButton.disabled = true;
    if (muteButton) muteButton.disabled = true;
    if (deafenButton) deafenButton.disabled = true;
    if (messageInput) messageInput.disabled = true;
    if (sendButton) sendButton.disabled = true;
    if (roomIdInput) roomIdInput.disabled = false;

    // Очищаем поле roomId
    if (roomIdInput) roomIdInput.value = '';

    // Сбрасываем статус
    if (statusElement) statusElement.textContent = 'Disconnected';
    if (statusCompactElement) {
        statusCompactElement.textContent = 'Disconnected';
        statusCompactElement.classList.remove('connected');
    }
    if (currentRoomElement) currentRoomElement.textContent = 'Not connected';

    // Очищаем список участников
    this.updatePeerList([]);

    // Очищаем чат (оставляем только системное сообщение)
    if (chatMessagesElement) {
        chatMessagesElement.innerHTML = `
            <div class="message other-message">
                <div class="message-header">
                    <div class="message-avatar">S</div>
                    <span class="message-sender">System</span>
                    <span class="message-time">Just now</span>
                </div>
                <div class="message-content">
                    Disconnected from room. Join a room to start talking.
                </div>
            </div>
        `;
    }

    // Очищаем аудио выходы
    if (audioContainer) {
        audioContainer.innerHTML = `
            <div style="color: #72767d; font-size: 12px; text-align: center; padding: 10px;">
                No active audio streams
            </div>
        `;
    }

    // Закрываем соединения
    Object.values(this.peerConnections).forEach(pc => {
        if (pc) pc.close();
    });
    this.peerConnections = {};
    this.remoteStreams = {};

    if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
    }

    // Отправляем сообщение о выходе из комнаты на сервер
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
            type: 'leave',
            room_id: this.roomId
        }));
    }

    if (this.ws) {
        this.ws.close();
        this.ws = null;
    }

    this.roomId = null;
    this.isConnecting = false;

    console.log('Left room successfully');
}

    toggleMute() {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });

            this.isMuted = !audioTracks[0].enabled;
            const muteButton = document.getElementById('muteIcon');

            if (this.isMuted) {
                muteButton.classList.add('active');
                muteButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            } else {
                muteButton.classList.remove('active');
                muteButton.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        }
    }

    toggleDeafen() {
        this.isDeafened = !this.isDeafened;
        const deafenButton = document.getElementById('deafenIcon');

        if (this.isDeafened) {
            deafenButton.classList.add('active');
            deafenButton.innerHTML = '<i class="fas fa-headphones-slash"></i>';
        } else {
            deafenButton.classList.remove('active');
            deafenButton.innerHTML = '<i class="fas fa-headphones"></i>';
        }

        this.updateAudioElements();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Проверяем что элементы существуют перед добавлением обработчиков
        const joinButton = document.getElementById('joinRoom');
        const leaveButton = document.getElementById('leaveRoom');
        const muteButton = document.getElementById('muteIcon');
        const deafenButton = document.getElementById('deafenIcon');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendMessage');
        const roomIdInput = document.getElementById('roomId');

        if (joinButton) {
            joinButton.addEventListener('click', () => {
                const roomId = document.getElementById('roomId').value.trim();
                this.joinRoom(roomId);
            });
            console.log('Join button listener added');
        } else {
            console.error('Join button not found');
        }

        if (leaveButton) {
            leaveButton.addEventListener('click', () => {
                this.leaveRoom();
            });
            console.log('Leave button listener added');
        } else {
            console.error('Leave button not found');
        }

        if (muteButton) {
            muteButton.addEventListener('click', () => {
                this.toggleMute();
            });
            console.log('Mute button listener added');
        } else {
            console.error('Mute button not found');
        }

        if (deafenButton) {
            deafenButton.addEventListener('click', () => {
                this.toggleDeafen();
            });
            console.log('Deafen button listener added');
        } else {
            console.error('Deafen button not found');
        }

        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendTextMessage();
                }
            });
        }

        if (sendButton) {
            sendButton.addEventListener('click', () => {
                this.sendTextMessage();
            });
        }

        if (roomIdInput) {
            roomIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const joinBtn = document.getElementById('joinRoom');
                    if (joinBtn) joinBtn.click();
                }
            });
        }

        console.log('All event listeners setup completed');
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    new GroupVoiceChat();
});