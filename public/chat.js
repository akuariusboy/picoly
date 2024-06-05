const socket = io();
let localStream;
let peer;
const status = document.getElementById('status');
const chatMessages = document.getElementById('chatMessages');
const locationDisplay = document.getElementById('location');
let chatHistory = [];
let typingTimeout;

// Configurar peer y obtener la ubicación del usuario
function initializePeer(isInitiator) {
    peer = new SimplePeer({ initiator: isInitiator, stream: localStream });

    peer.on('signal', data => {
        socket.emit('signal', { partnerId: peer.partnerId, signal: data });
    });

    peer.on('stream', stream => {
        document.getElementById('remoteVideo').srcObject = stream;
    });

    peer.on('data', data => {
        const decryptedMessage = decryptMessage(JSON.parse(data));
        const message = document.createElement('div');
        message.classList.add('p-2', 'bg-gray-200', 'rounded', 'mb-2');
        message.textContent = `Partner: ${decryptedMessage}`;
        chatMessages.appendChild(message);
        chatHistory.push(`Partner: ${decryptedMessage}`);
        if (Notification.permission === "granted") {
            new Notification("New message from partner");
        }
    });

    peer.on('close', () => {
        status.innerText = 'Partner disconnected';
        document.getElementById('remoteVideo').srcObject = null;
    });

    peer.on('error', (err) => {
        console.error('Peer connection error:', err);
        status.innerText = 'Connection error';
    });

    // Obtener la ubicación del usuario
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            const location = `Your partner is from ${data.city}, ${data.country_name}`;
            socket.emit('location', location);
        })
        .catch(error => console.error('Error fetching location:', error));
}

// Obtener stream de video y audio del usuario
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        document.getElementById('localVideo').srcObject = stream;
        localStream = stream;

        const urlParams = new URLSearchParams(window.location.search);
        const selectedCountry = urlParams.get('country');

        document.getElementById('startCall').addEventListener('click', () => {
            socket.emit('findPartner', { country: selectedCountry });
            status.innerText = 'Looking for a partner...';
        });

        document.getElementById('endCall').addEventListener('click', () => {
            if (peer) {
                peer.destroy();
                status.innerText = 'Call ended';
            }
        });

        document.getElementById('sendMessage').addEventListener('click', () => {
            if (peer) {
                let message = document.getElementById('chatInput').value.trim();
                if (!message) {
                    alert('Message cannot be empty');
                    return;
                }
                message = filter.clean(message); // Filtrar mensaje
                const encryptedMessage = encryptMessage(message);
                peer.send(JSON.stringify(encryptedMessage));
                const messageElement = document.createElement('div');
                messageElement.classList.add('p-2', 'bg-blue-200', 'rounded', 'mb-2', 'self-end');
                messageElement.textContent = `You: ${message}`;
                chatMessages.appendChild(messageElement);
                chatHistory.push(`You: ${message}`);
                document.getElementById('chatInput').value = '';
            } else {
                alert('No active call to send message');
            }
        });

        document.getElementById('volumeControl').addEventListener('input', (event) => {
            document.getElementById('remoteVideo').volume = event.target.value;
        });

        document.getElementById('videoFilter').addEventListener('change', (event) => {
            document.getElementById('localVideo').style.filter = event.target.value;
        });

        socket.on('partner', partnerId => {
            peer.partnerId = partnerId;
            initializePeer(true);
            status.innerText = 'Connected to a partner';
        });

        socket.on('signal', data => {
            if (!peer) {
                peer.partnerId = data.from;
                initializePeer(false);
            }
            peer.signal(data.signal);
        });

        socket.on('location', location => {
            locationDisplay.innerText = location;
        });

        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }

    })
    .catch(err => {
        console.error('Error accessing media devices:', err);
        status.innerText = 'Error accessing media devices. Please check your permissions and try again.';
    });

socket.on('connect', () => {
    status.innerText = 'Connected to server. Click "Start Call" to find a partner.';
});

socket.on('disconnect', () => {
    status.innerText = 'Disconnected from server';
});

// Función para encriptar mensajes
function encryptMessage(message) {
    const secretKey = CryptoJS.enc.Utf8.parse('your-secret-key');
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(message, secretKey, { iv: iv });

    return {
        iv: iv.toString(CryptoJS.enc.Hex),
        content: encrypted.toString()
    };
}

// Función para desencriptar mensajes
function decryptMessage(hash) {
    const secretKey = CryptoJS.enc.Utf8.parse('your-secret-key');
    const iv = CryptoJS.enc.Hex.parse(hash.iv);
    const decrypted = CryptoJS.AES.decrypt(hash.content, secretKey, { iv: iv });

    return decrypted.toString(CryptoJS.enc.Utf8);
}

// Función para descargar historial de chat
function downloadChatHistory() {
    const blob = new Blob([chatHistory.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_history.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Añadir botón de descarga
const downloadButton = document.createElement('button');
downloadButton.classList.add('bg-pink-custom', 'text-white', 'px-4', 'py-2', 'rounded', 'mt-2');
downloadButton.textContent = 'Download Chat History';
downloadButton.addEventListener('click', downloadChatHistory);
document.getElementById('chatContainer').appendChild(downloadButton);
