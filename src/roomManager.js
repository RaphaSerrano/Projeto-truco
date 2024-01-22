class RoomManager {
    static updateRoom(rooms) {
        for (const room of rooms) {
            if (room.gameStatus !== 2) {
                room.status = room.q === room.max ? 'ready' : 'waiting...';
            }
        }
    }
}

module.exports = RoomManager;
