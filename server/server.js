const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.hml');
});

const players = {}; // Store all connected players

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Add new player
    players[socket.id] = {
        x: Math.random() * 150 + 250,
        y: Math.random() * 150 + 150
    };

    console.log(`Players: ${players}`);

    // Send all players to the new player
    socket.emit('playerId', socket.id);
    io.emit('updatePlayers', players);
    

    // Handle player disconnect
    socket.on('disconnect', (reason) => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
/*
    socket.on('playerMove', (velocityX, velocityY, anim) => {
        players[socket.id].x += velocityX;
        players[socket.id].y += velocityY;
        io.emit('updatePositions', socket.id, velocityX, velocityY, anim);
    });*/

    socket.on('spriteMove', (velocityX, velocityY, anim) => {
        players[socket.id].x += velocityX;
        players[socket.id].y += velocityY;
        io.emit('updatePositions', socket.id, velocityX, velocityY, anim);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
