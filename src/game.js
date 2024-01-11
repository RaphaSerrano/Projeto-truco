const Deck = require('./deck');

class Game {
    constructor(players, playersId) {
        const deck1 = new Deck();
        let startPlayer = (Math.floor(Math.random() * 4) + 1);
        this.game = {
            active: true,
            players: [{
                nome: players[0],
                id: playersId[0],
                idTurno: 1,
                team: 'red',
                numCartas: 3,
                cartas: [deck1.deal(),
                deck1.deal(),
                deck1.deal()]
            },
            {
                nome: players[1],
                id: playersId[1],
                idTurno: 3,
                team: 'red',
                numCartas: 3,
                cartas: [deck1.deal(),
                deck1.deal(),
                deck1.deal()]
            },
            {
                nome: players[2],
                id: playersId[2],
                idTurno: 2,
                team: 'blue',
                numCartas: 3,
                cartas: [deck1.deal(),
                deck1.deal(),
                deck1.deal()]
            }, {
                nome: players[3],
                id: playersId[3],
                idTurno: 4,
                team: 'blue',
                numCartas: 3,
                cartas: [deck1.deal(),
                deck1.deal(),
                deck1.deal()]
            }],
            table: {
                endGame: false,
                onze: {
                    maoOnze: '',
                    maoOnzeStatus: '',
                    message: '',
                    votacao: [],
                    votosCont: 0,
                },
                teamsPoint: {
                    red: 0,
                    blue: 0
                },
                coringa: deck1.deal(),
                turno: {
                    player: startPlayer,//quem comeca e vai pra quem ta na vez
                    lastStart: startPlayer//salva o player q comecou a ultima rodada, para q o proximo da fila comece depois
                },
                roundPoints: {
                    blue: 0,
                    red: 0,
                    empate: 0,
                    quemGanhouPrimeiro: ''
                },
                valueTruco: 1,
                requestTruco: {
                    requested: false,
                    status: '',
                    by: '',
                    to: '',
                    playerName: '',
                    votacao: [],
                    votosCont: 0,
                    value: 0,
                },
                centroMesa: [/*{ playerId: 1, carta: deck1.deal() },
                { playerId: 2, carta: deck1.deal() },
                { playerId: 3, carta: deck1.deal() },
                { playerId: 4, carta: deck1.deal() }*/]
            }
        }
    }

};
module.exports = Game;