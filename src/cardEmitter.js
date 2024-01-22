class CardEmitter {
    static emitCards(index, rooms, io) {
        for (let j = 0; j < 4; j++) {
            const privatePlayers = [];
            for (let i = 0; i < 4; i++) {
                if (rooms[index].game.players[i].id === rooms[index].game.players[j].id) {
                    privatePlayers.push({
                        isMe: true,
                        ...rooms[index].game.players[i]
                    });
                } else {
                    privatePlayers.push({
                        isMe: false,
                        idTurno: rooms[index].game.players[i].idTurno,
                        nome: rooms[index].game.players[i].nome,
                        id: rooms[index].game.players[i].id,
                        team: rooms[index].game.players[i].team,
                        numCartas: rooms[index].game.players[i].numCartas,
                    });
                }
            }
            const removeCards = {
                active: true,
                myPos: rooms[index].game.players[j].idTurno,
                myTeam: rooms[index].game.players[j].team,
                ...rooms[index].game.table,
                players: privatePlayers
            };
            io.to(`${rooms[index].game.players[j].id}`).emit('gameStart', removeCards);
        }
    }
}

module.exports = CardEmitter;
