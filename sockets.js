const crypto = require('crypto');

let waitingUsers = {};

function initializeSocket(io) {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('findPartner', ({ country }) => {
            try {
                if (country) {
                    if (waitingUsers[country] && waitingUsers[country].id !== socket.id) {
                        socket.emit('partner', waitingUsers[country].id);
                        waitingUsers[country].emit('partner', socket.id);
                        delete waitingUsers[country];
                    } else {
                        waitingUsers[country] = socket;
                        socket.country = country;
                    }
                } else {
                    if (waitingUsers['any'] && waitingUsers['any'].id !== socket.id) {
                        socket.emit('partner', waitingUsers['any'].id);
                        waitingUsers['any'].emit('partner', socket.id);
                        delete waitingUsers['any'];
                    } else {
                        waitingUsers['any'] = socket;
                    }
                }
            } catch (error) {
                console.error('Error finding partner:', error);
                socket.emit('error', 'An error occurred while finding a partner. Please try again.');
            }
        });

        socket.on('disconnect', () => {
            console.log('A user disconnected:', socket.id);
            if (socket.country) {
                if (waitingUsers[socket.country] === socket) {
                    delete waitingUsers[socket.country];
                }
            } else {
                if (waitingUsers['any'] === socket) {
                    delete waitingUsers['any'];
                }
            }
        });

        socket.on('signal', (data) => {
            try {
                const partnerId = data.partnerId;
                const signal = data.signal;
                io.to(partnerId).emit('signal', { signal, from: socket.id });
            } catch (error) {
                console.error('Error handling signal:', error);
                socket.emit('error', 'An error occurred while handling the signal. Please try again.');
            }
        });

        socket.on('location', (location) => {
            console.log(`Location from ${socket.id}: ${location}`);
        });
    });
}

function encryptMessage(message) {
    const algorithm = 'aes-256-ctr';
    const secretKey = process.env.SECRET_KEY;
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encryptedMessage = Buffer.concat([cipher.update(message), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encryptedMessage.toString('hex')
    };
}

function decryptMessage(hash) {
    const algorithm = 'aes-256-ctr';
    const secretKey = process.env.SECRET_KEY;
    const iv = Buffer.from(hash.iv, 'hex');
    const encryptedText = Buffer.from(hash.content, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    const decryptedMessage = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

    return decryptedMessage.toString();
}

module.exports = { initializeSocket, encryptMessage, decryptMessage };
