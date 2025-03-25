const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const gameManager = require('./gameManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    gameManager.addPlayer(socket);

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        gameManager.removePlayer(socket.id);
    });

    socket.on('playerMovement', (data) => {
        gameManager.updatePlayer(socket.id, data);
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port 3000');
});
