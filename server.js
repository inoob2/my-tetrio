const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingPlayer = null;
let rooms = {};

io.on('connection', (socket) => {
    console.log(`玩家連線: ${socket.id}`);

    if (!waitingPlayer) {
        waitingPlayer = socket;
        socket.emit('message', '正在尋找對手...');
    } else {
        const opponent = waitingPlayer;
        waitingPlayer = null;

        const roomId = `${opponent.id}#${socket.id}`;
        socket.join(roomId);
        opponent.join(roomId);

        rooms[socket.id] = { roomId, opponentId: opponent.id };
        rooms[opponent.id] = { roomId, opponentId: socket.id };

        io.to(roomId).emit('gameStart', { message: '對手已找到！遊戲開始！' });
    }

    socket.on('sendAttack', (lines) => {
        const roomInfo = rooms[socket.id];
        if (roomInfo) {
            socket.to(roomInfo.roomId).emit('getAttacked', lines);
        }
    });

    socket.on('disconnect', () => {
        console.log(`玩家斷線: ${socket.id}`);
        if (waitingPlayer === socket) waitingPlayer = null;
        
        const roomInfo = rooms[socket.id];
        if (roomInfo) {
            socket.to(roomInfo.roomId).emit('opponentLeft', '對手已離開遊戲。');
            delete rooms[roomInfo.opponentId];
            delete rooms[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器運行在 http://localhost:${PORT}`);
});
