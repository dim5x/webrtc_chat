class GroupVoiceChat {
    constructor() {
        // this.peerId = Math.random().toString(36).substr(2, 9);
        this.peerId = this.generateReadableId();
        this.roomId = null;
        this.localStream = null;
        this.peerConnections = {};
        this.remoteStreams = {};
        this.ws = null;
        this.isMuted = false;
        this.isDeafened = false;
        this.isConnecting = false;
        this.pendingIceCandidates = {};
        // this.audioContext = null;
        // this.analyser = null;

        this.messageInput = null;
        // this.chatMessages = null; ***************
        // Новые свойства для файлов
        // this.attachMenu = null;
        this.maxFileSize = 1024 * 1024;

        // Привязываем методы к контексту
        // this.handleAttachClick = this.handleAttachClick.bind(this);
        // this.toggleAttachMenu = this.toggleAttachMenu.bind(this);
        // this.attachImage = this.attachImage.bind(this);
        // this.attachFile = this.attachFile.bind(this);

        this.init();
    }

    generateReadableId() {
        const adjectives = [
            "Живой", "Весёлый", "Лукавый", "Странный", "Пушистый", "Сладкий", "Зеркальный", "Шершавый",
            "Блестящий", "Тёплый", "Скрипучий", "Ленивый", "Мерцающий", "Бархатный", "Хрустальный", "Огненный", "Ледяной", "Мохнатый",
            "Сочный", "Шуршащий", "Лунный", "Солнечный", "Мягкий", "Искристый", "Задумчивый", "Прыгучий", "Воздушный", "Говорливый"
        ];

        const nouns = [
            "мясорубка", "шляпа", "тапок", "зонтик", "носорог", "ведёрко", "торт", "лампочка", "банан", "холодильник",
            "кактус", "гармошка", "крокодил", "пуговица", "подушка", "самолёт", "мышонок", "будильник", "ящерка", "телескоп",
            "картофель", "ковер", "зубочистка", "миска", "облако", "баранка", "одеяло", "морковка", "волчок", "фонарь"
        ];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const adjBase = adjectives[Math.floor(Math.random() * adjectives.length)];
        let adj = adjBase;
        // Обрезаем последние 2 символа и добавляем "-ая" или "-ое".
        if (noun.endsWith("а")) {
            adj = adjBase.slice(0, -2) + "ая";
        }
        if (noun.endsWith("о")) {
            adj = adjBase.slice(0, -2) + "ое";
        }

        return `${adj} ${noun}`;
    }


    async init() {
        // Проверяем что все элементы существуют.
        const requiredElements = [
            'joinRoom', 'leaveRoom', 'muteIcon', 'deafenIcon', 'messageInput', 'sendMessage', 'roomId',
            'statusCompact', 'myId', 'currentRoom', 'participantCount', 'attachButton'];

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
        await this.setupTextChat();

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
        // this.chatMessages = document.getElementById('chatMessages'); ********
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
        // avatarDiv.textContent = isOwn ? 'Y' : peerId.substr(0, 1).toUpperCase();
        avatarDiv.textContent = isOwn ? 'Y' : peerId.charAt(0).toUpperCase();

        // Имя отправителя
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        // senderSpan.textContent = isOwn ? 'You' : `User ${peerId.substr(0, 6)}`;
        senderSpan.textContent = isOwn ? 'Вы' : `${peerId}`;

        // Время
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = time;

        // Собираем заголовок в правильном порядке
        if (isOwn) {
            // Для своих: время → имя → аватар
            console.log('Для своих');
            headerDiv.appendChild(timeSpan);
            headerDiv.appendChild(senderSpan);
            headerDiv.appendChild(avatarDiv);
        } else {
            // Для чужих: аватар → имя → время
            console.log('Для чужих');
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
                const dataURL = "data:image/png;base64,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";
                new Notification('Сообщение', {
                    body: `От: ${peerId} \n${message}`,
                    // icon: '/favicon.svg'
                    icon: dataURL
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
        // const statusElement = document.getElementById('status');
        const statusCompactElement = document.getElementById('statusCompact');

        if (joinButton) joinButton.disabled = true;
        // if (statusElement) statusElement.textContent = 'Connecting...';
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

            // if (statusElement) statusElement.textContent = 'Connection failed';
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
                // this.ws = new WebSocket('ws://localhost:8080/ws');
                // console.log('WebSocket object created');
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws`;
                this.ws = new WebSocket(wsUrl);

                console.log('Connecting to:', wsUrl);
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

                    // const statusElement = document.getElementById('status');
                    const statusCompactElement = document.getElementById('statusCompact');

                    // if (statusElement) statusElement.textContent = 'Connected to server';
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

                this.ws.onmessage = async (event) => {
                    try {
                        console.log('WebSocket message received:', event.data);
                const data = JSON.parse(event.data);
                await this.handleSignalingData(data);
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
                await this.handlePeerJoined(data.peer_id);
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
                await this.addMessageToChat(data.from_peer, data.message, isOwnMessage);
                break;
            case 'file_message':
                await this.handleFileMessage(data);
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
        // const participantCountElement = document.getElementById('participantCount'); ************************
        const attachButton = document.getElementById('attachButton'); // ← ДОБАВЬТЕ

        // Обновляем информацию о комнате
        if (currentRoomElement) currentRoomElement.textContent = this.roomId;

        // Активируем элементы управления
        if (leaveButton) leaveButton.disabled = false;
        if (muteButton) muteButton.disabled = false;
        if (deafenButton) deafenButton.disabled = false;
        if (messageInput) messageInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        if (attachButton) attachButton.disabled = false; // ← ДОБАВЬТЕ

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
        this.updateAudioElements(); //*****************************************************
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
            iceTransportPolicy: "all", // или не указывать
            iceServers: [
                {urls: 'stun:stun.l.google.com:19302'},
                {urls: 'stun:stun1.l.google.com:19302'},
                {urls: 'stun:stun2.l.google.com:19302'},

                // TURN серверы (РЕШАЮТ ПРОБЛЕМУ!)
                    { urls: "turn:dim5x.duckdns.org:3478?transport=udp", username: "morzh", credential: "penis_morzha" },

    // 2. Если UDP не сработал — попробуем TCP
    { urls: "turn:dim5x.duckdns.org:3478?transport=tcp", username: "morzh", credential: "penis_morzha" },

    // 3. Если и TCP не сработал — попробуем TLS (порт 5349)
    { urls: "turn:dim5x.duckdns.org:5349?transport=tcp", username: "morzh", credential: "penis_morzha" }
                // {
                //     urls: [
                //         "turn:dim5x.duckdns.org:3478?transport=udp", // 1. Попробуем UDP
                //         "turn:dim5x.duckdns.org:3478?transport=tcp", // 2. Если UDP не сработал — попробуем TCP
                //         "turn:dim5x.duckdns.org:5349?transport=tcp"  // 3. Если и TCP не сработал — попробуем TLS (порт 5349)
                //     ],
                //     username: "morzh",
                //     credential: "penis_morzha"
                // }
                // {
                //     urls: 'turn:94.183.234.220:3478',
                //     username: 'morzh',
                //     credential: 'penis_morzha'
                // },
                // // Дополнительные варианты для надежности
                // {
                //     urls: 'turn:94.183.234.220:3478?transport=tcp',
                //     username: 'morzh',
                //     credential: 'penis_morzha'
                // },
                //
                // // Если настроен TLS
                // {
                //     urls: 'turns:94.183.234.220:5349?transport=tcp',
                //     username: 'morzh',
                //     credential: 'penis_morzha'
                // }

                // {
                //     urls: "turn:global.relay.metered.ca:80",
                //     username: "71769da3a63a7e4699e9c2df",
                //     credential: "Qfjq//h1tLkReXYW",
                // },
                // {
                //     urls: "turn:global.relay.metered.ca:80?transport=tcp",
                //     username: "71769da3a63a7e4699e9c2df",
                //     credential: "Qfjq//h1tLkReXYW",
                // },
                // {
                //     urls: "turn:global.relay.metered.ca:443",
                //     username: "71769da3a63a7e4699e9c2df",
                //     credential: "Qfjq//h1tLkReXYW",
                // },
                // {
                //     urls: "turns:global.relay.metered.ca:443?transport=tcp",
                //     username: "71769da3a63a7e4699e9c2df",
                //     credential: "Qfjq//h1tLkReXYW",
                // },

            ],

        };

        const pc = new RTCPeerConnection(configuration);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Логируем в консоль
                console.log(`❄️ [${peerId}] ICE candidate:`, {
                    type: event.candidate.type,
                    protocol: event.candidate.protocol,
                    address: event.candidate.address,
                    port: event.candidate.port,
                    candidateType: event.candidate.candidateType
                });

                // Отправляем через WebSocket
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        target_peer: peerId
                    }));
                }
            } else {
                console.log(`✅ [${peerId}] ICE gathering complete`);
            }
        };

        pc.ontrack = (event) => {
            this.remoteStreams[peerId] = event.streams[0];
            this.updateAudioElements();
        };

        // 🔽 ПРОСТОЙ МОНИТОРИНГ В КОНСОЛЬ 🔽
        pc.onconnectionstatechange = () => {
            console.log(`🔗 [${peerId}] Connection state: ${pc.connectionState}`);

            if (pc.connectionState === 'connected') {
                // Просто логируем когда соединение установлено
                console.log(`✅ [${peerId}] Connection established!`);
                this.logConnectionDetails(pc, peerId);
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`🌐 [${peerId}] ICE state: ${pc.iceConnectionState}`);
        };

        pc.onicegatheringstatechange = () => {
            console.log(`📡 [${peerId}] ICE gathering: ${pc.iceGatheringState}`);
        };

        pc.onsignalingstatechange = () => {
            console.log(`📶 [${peerId}] Signaling: ${pc.signalingState}`);
        };
        // 🔼 КОНЕЦ МОНИТОРИНГА 🔼

        return pc;
    }

    async logConnectionDetails(pc, peerId) {
        try {
            console.group(`📊 Connection details for ${peerId}`);

            console.log('🔄 Connection state:', pc.connectionState);
            console.log('🌐 ICE state:', pc.iceConnectionState);

            const stats = await pc.getStats();
            let activeLocalCandidate = null;
            let activeRemoteCandidate = null;

            stats.forEach(report => {
                // 🔽 ДОБАВЛЯЕМ ПОИСК АКТИВНОЙ ПАРЫ 🔽
                if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') {
                    console.log('⭐ ACTIVE Candidate Pair:', {
                        state: report.state,
                        bytesSent: report.bytesSent,
                        bytesReceived: report.bytesReceived,
                        priority: report.priority
                    });

                    // Находим конкретные кандидаты этой пары
                    activeLocalCandidate = stats.get(report.localCandidateId);
                    activeRemoteCandidate = stats.get(report.remoteCandidateId);
                }
            });

            // 🔽 ВЫВОДИМ ВЫБРАННЫЕ КАНДИДАТЫ 🔽
            if (activeLocalCandidate && activeRemoteCandidate) {
                console.log('🎯 SELECTED Local Candidate:', {
                    type: activeLocalCandidate.candidateType,
                    ip: activeLocalCandidate.ip,
                    port: activeLocalCandidate.port,
                    protocol: activeLocalCandidate.protocol
                });

                console.log('🎯 SELECTED Remote Candidate:', {
                    type: activeRemoteCandidate.candidateType,
                    ip: activeRemoteCandidate.ip,
                    port: activeRemoteCandidate.port,
                    protocol: activeRemoteCandidate.protocol
                });

                console.log('🔗 Connection Type:', this.getConnectionType(activeLocalCandidate, activeRemoteCandidate));
            } else {
                console.log('⏳ Active candidate pair not found yet');
            }

            console.groupEnd();

        } catch (error) {
            console.error('Error getting connection details:', error);
        }
    }

// 🔽 ДОБАВЛЯЕМ ВСПОМОГАТЕЛЬНЫЙ МЕТОД 🔽
    getConnectionType(localCandidate, remoteCandidate) {
        if (localCandidate.candidateType === 'relay' || remoteCandidate.candidateType === 'relay') {
            return 'TURN (Relay)';
        } else if (localCandidate.candidateType === 'srflx' || remoteCandidate.candidateType === 'srflx') {
            return 'STUN (NAT Traversal)';
        } else {
            return 'P2P (Local Network)';
        }
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
                // audio.style.display = 'none'; // ← СКРЫВАЕМ!

                // Устанавливаем громкость из регулятора
                const volumeSlider = document.querySelector(`.volume-slider[data-peer-id="${peerId}"]`);
                if (volumeSlider) {
                    audio.volume = volumeSlider.value / 100;
                }

                const info = document.createElement('div');
                info.className = 'audio-stream-info';
                info.textContent = `${peerId}`;

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
                <div class="participant-name">Вы: ${this.peerId}</div>
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
                    <div class="participant-avatar">${peerId.charAt(0).toUpperCase()}</div>
                    <div class="participant-info">
                        <div class="participant-name">${peerId}</div>
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

            // Обновляем счетчик.
            const participantCountElement = document.getElementById('participantCount');
            if (participantCountElement) {
                participantCountElement.textContent = String(currentPeers.length);
            }

            // Настраиваем регуляторы громкости
            this.setupVolumeControls();
        } else {
            // Показываем пустой список если не в комнате
            peerList.innerHTML = `
            <div class="participant">
                <div class="participant-avatar">Y</div>
                <div class="participant-info">
                    <div class="participant-name">Вы</div>
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
            await this.addPendingIceCandidates(data.from_peer, pc);
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
        if (!pc || !pc.remoteDescription) {
            (this.pendingIceCandidates[data.from_peer] ||= []).push(data.candidate);
            return;
        }
        await pc.addIceCandidate(data.candidate);
    }

    async addPendingIceCandidates(peerId, pc) {
        const candidates = this.pendingIceCandidates[peerId] || [];
        delete this.pendingIceCandidates[peerId];
        for (const candidate of candidates) {
            await pc.addIceCandidate(candidate);
        }
    }


    leaveRoom() {
        console.log('Leaving room...');

        // Безопасное получение элементов
        const joinButton = document.getElementById('joinRoom');
        const leaveButton = document.getElementById('leaveRoom');
        const muteButton = document.getElementById('muteIcon');
        const deafenButton = document.getElementById('deafenIcon');
        const attachButton = document.getElementById('attachButton');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendMessage');
        const roomIdInput = document.getElementById('roomId');
        const statusElement = document.getElementById('status');
        const statusCompactElement = document.getElementById('statusCompact');
        const currentRoomElement = document.getElementById('currentRoom');
        // const participantCountElement = document.getElementById('participantCount'); ******************
        const chatMessagesElement = document.getElementById('chatMessages');
        // const peerListElement = document.getElementById('peerList'); ***************
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
        if (attachButton) attachButton.disabled = true;

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
        // this.updatePeerList([]);

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
            </div>`;
        }

        // Закрываем соединения
        Object.values(this.peerConnections).forEach(pc => {
            if (pc) pc.close();
        });
        this.peerConnections = {};
        this.remoteStreams = {};
        this.pendingIceCandidates = {};

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

        // Обновляем после обнуления roomID, иначе не будет применяться css-класс 'status-offline' в updatePeerList().
        this.updatePeerList([]);
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
                muteButton.innerHTML = '<i class="icon-mic-off"></i>';
            } else {
                muteButton.classList.remove('active');
                muteButton.innerHTML = '<i class="icon-mic-2"></i>';
            }
        }
    }

    toggleDeafen() {
        this.isDeafened = !this.isDeafened;
        const deafenButton = document.getElementById('deafenIcon');

        if (this.isDeafened) {
            deafenButton.classList.add('active');
            deafenButton.innerHTML = '<i class="icon-headphones-1"></i>';
        } else {
            deafenButton.classList.remove('active');
            deafenButton.innerHTML = '<i class="icon-headphones-1"></i>';
        }

        this.updateAudioElements();
    }

    handleAttachClick() {
        console.log('Attach button clicked');
        this.toggleAttachMenu();
    }

    toggleAttachMenu() {
        const menu = document.getElementById('attachMenu');
        if (menu) {
            menu.classList.toggle('open');
            console.log('Attach menu toggled:', menu.classList.contains('open'));
        }
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
        const attachButton = document.getElementById('attachButton');

        if (attachButton) {
            attachButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleAttachClick();
            });
            console.log('Attach button listener added');
        } else {
            console.error('Attach button not found');
        }

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


// Прикрепить изображение
    async attachImage() {
        this.toggleAttachMenu();

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = false;

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > this.maxFileSize) {
                    alert('Файл слишком большой. Максимум 1 MB');
                    return;
                }

                await this.sendFile(file);
            }
        };

        input.click();
    }

    // Прикрепить любой файл
    async attachFile() {
        this.toggleAttachMenu();

        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = false;

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > this.maxFileSize) {
                    alert('Файл слишком большой. Максимум 1 MB');
                    return;
                }

                await this.sendFile(file);
            }
        };

        input.click();
    }

    // Отправить файл через WebSocket
    async sendFile(file) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Нет подключения к серверу');
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                const base64 = this.arrayBufferToBase64(arrayBuffer);

                // ✅ ПРАВИЛЬНОЕ локальное отображение
                const localFile = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: base64 // ← Используем base64 а не File объект
                };
                await this.addFileMessage(this.peerId, localFile, true);

                // Отправляем на сервер
                this.ws.send(JSON.stringify({
                    type: 'file_message',
                    file_name: file.name,
                    file_type: file.type,
                    file_size: file.size,
                    file_data: base64,
                    timestamp: new Date().toISOString()
                }));
            };

            reader.readAsArrayBuffer(file);

        } catch (error) {
            console.error('Error sending file:', error);
            alert('Ошибка при отправке файла');
        }
    }

// Конвертация ArrayBuffer в Base64
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

// Добавить сообщение с файлом в чат
    async addFileMessage(peerId, file, isOwn = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own-message' : 'other-message'}`;

        const time = new Date().toLocaleTimeString();

        // Заголовок сообщения
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.innerHTML = `
        <span class="message-sender">${isOwn ? 'Вы' : `${peerId}`}</span>
        <span class="message-time">${time}</span>
    `;

        // Контент с файлом
        const fileDiv = document.createElement('div');
        fileDiv.className = 'message-file';

        if (file.type.startsWith('image/')) {
            // 🔽 ПРАВИЛЬНОЕ создание Data URL 🔽
            const dataUrl = `data:${file.type};base64,${file.data}`;

            fileDiv.innerHTML = `
            <div class="file-content">
                <div class="file-icon"><i class="fas fa-image"></i></div>
                <div class="file-info">
                    <div class="file-name">${this.escapeHtml(file.name)}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
            </div>
            <img src="${dataUrl}" alt="${this.escapeHtml(file.name)}" class="file-image"
                 onclick="app.openImage('${dataUrl}')">
        `;
        } else {
            // Для других файлов
            fileDiv.innerHTML = `
            <div class="file-content">
                <div class="file-icon"><i class="fas fa-file"></i></div>
                <div class="file-info">
                    <div class="file-name">${this.escapeHtml(file.name)}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
                <button class="file-download" onclick="app.downloadFile('${this.escapeHtml(file.name)}', '${file.type}', '${file.data}')">
                    Скачать
                </button>
            </div>
        `;
        }

        // Собираем сообщение
        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(fileDiv);

        const chatMessages = document.getElementById('chatMessages');
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

// Форматирование размера файла
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

// Открыть изображение в полном размере
    openImage(src) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;

        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        border-radius: 8px;
    `;

        overlay.appendChild(img);
        overlay.onclick = () => document.body.removeChild(overlay);

        document.body.appendChild(overlay);
    }

// Скачать файл
    downloadFile(filename, type, base64Data) {
        const binary = atob(base64Data);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([array], {type: type});
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }

    async handleFileMessage(data) {
        console.log('📁 File message received from:', data.from_peer);

        const isOwnMessage = data.from_peer === this.peerId;

        // Если это наше собственное сообщение - игнорируем (уже показали локально)
        if (isOwnMessage) {
            console.log('Ignoring own file message (already shown locally)');
            return;
        }

        // Создаем файловый объект из полученных данных
        const file = {
            name: data.file_name,
            type: data.file_type,
            size: data.file_size,
            data: data.file_data
        };

        // Добавляем сообщение в чат
        await this.addFileMessage(data.from_peer, file, false);
    }

}


// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GroupVoiceChat();
    // new GroupVoiceChat();
});
