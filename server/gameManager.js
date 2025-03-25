let players = {};

function addPlayer(socket) {
    players[socket.id] = { x: 400, y: 300 };
}

function removePlayer(socketId) {
    delete players[socketId];
}

function updatePlayer(socketId, data) {
    if (players[socketId]) {
        players[socketId].x = data.x;
        players[socketId].y = data.y;
    }
}

module.exports = { addPlayer, removePlayer, updatePlayer };
