const express = require('express');
const path = require('path');
const Deck = require('./src/deck');
const RoomManager = require('./src/roomManager');
const CardEmitter = require('./src/cardEmitter'); 

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const Game = require('./src/game');

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'public'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use('/', (req, res) => {
    res.render('index.html');
});
app.use('/jogar', (req, res) => {
    res.render('jogar.html');
});

let rooms = [{ name: 'room1', q: 0, max: 4, status: 'waiting...', usersid: [], usersname: [], game: { active: false }, gameStatus: 1 },
{ name: 'room2', q: 0, max: 4, status: 'waiting...', usersid: [], usersname: [], game: { active: false }, gameStatus: 1 },
{ name: 'room3', q: 0, max: 4, status: 'waiting...', usersid: [], usersname: [], game: { active: false }, gameStatus: 1 }];

io.on('connection', socket => {
    console.log(socket.id);
    socket.on('adduser', function (username) {
        socket.username = username;

        socket.emit('dispRooms', rooms);
    });
    socket.on('switchRoom', function (newroom) {
        let index2 = rooms.findIndex((e) => e.name === newroom);
        if (index2 != -1) {
            if (rooms[index2].q == rooms[index2].max) {
                //fullgame
            } else {
                let playerI = rooms[index2].usersid.findIndex((e) => e == socket.id);
                if (playerI == -1) {//ve se o player ja n ta no novo sv

                    let index = rooms.findIndex((e) => e.name === socket.room);
                    if (index != -1) {
                        rooms[index].q--;
                        console.log(rooms[index].usersid, rooms[index].usersname)
                        let indexUser = rooms[index].usersid.findIndex((e) => e == socket.id);
                        if (indexUser != -1) {
                            rooms[index].usersid.splice(indexUser, 1);
                            rooms[index].usersname.splice(indexUser, 1);
                        }
                        socket.leave(socket.room);
                        console.log(rooms[index].usersid, rooms[index].usersname)
                    }
                    if (rooms[index2].gameStatus == 2) {//se o jogo tiver ativo adiciona o id
                        let playerIndex = rooms[index2].game.players.findIndex((e) => e.id == '');

                        if (playerIndex != -1) {
                            rooms[index2].game.players[playerIndex].id = socket.id;
                            rooms[index2].game.players[playerIndex].nome = socket.username;
                            emitCards(index2);
                        }

                    }
                    rooms[index2].q++;
                    rooms[index2].usersid.push(socket.id);
                    rooms[index2].usersname.push(socket.username);
                    socket.join(newroom);
                    socket.room = newroom;
                    socket.roomId = index2;
                    if (rooms[index2].q == rooms[index2].max) {
                        io.in(socket.room).emit('ready', true);
                    }
                    RoomManager.updateRoom(rooms);
                    io.emit('dispRooms', rooms);
                }
            }
        }
    });
    socket.on('go', function () {
        let index = rooms.findIndex((e) => e.name === socket.room);
        if (rooms[index].gameStatus != 2) {
            rooms[index].gameStatus = 2;
            rooms[index].status = 'IN GAME';
            rooms[index] = { ...rooms[index], ...new Game(rooms[index].usersname, rooms[index].usersid) };
        }
        //console.log(rooms[index].usersname, rooms[index].usersid)
        CardEmitter.emitCards(index, rooms, io);

        io.emit('dispRooms', rooms);
    });
    


    socket.on('disconnect', function () {
        let index = rooms.findIndex((e) => e.name === socket.room);
        if (index != -1) {

            if (rooms[index].gameStatus == 2) {//se o jogo tiver ativo remove o id
                for (let i = 0; i < 4; i++) {
                    if (rooms[index].game.players[i].id == socket.id) {
                        rooms[index].game.players[i].id = '';
                    }
                }
            }
            let indexUser = rooms[index].usersid.findIndex((e) => e == socket.id);
            if (indexUser != -1) {
                rooms[index].usersid.splice(indexUser, 1);
                rooms[index].usersname.splice(indexUser, 1);
                rooms[index].q--;
            }
            if (rooms[index].q == 0) {
                rooms[index].gameStatus = 1;
                rooms[index].status = 'waiting...';
                rooms[index].game = { active: false };
            }
            socket.leave(socket.room);
            RoomManager.updateRoom(rooms);
        }
        io.emit('dispRooms', rooms);
    });

    socket.on('sendCard', function (infos) {
        let index = rooms.findIndex((e) => e.name === socket.room);
        if (index != -1) {
            if (rooms[index].game.table.turno.player == infos.player && rooms[index].game.table.requestTruco.requested == false && rooms[index].game.table.centroMesa.length <= 4) {
                let indexUser = rooms[index].game.players.findIndex((e) => e.id == socket.id);
                let carta = rooms[index].game.players[indexUser].cartas[infos.carta];
                rooms[index].game.players[indexUser].cartas.splice(infos.carta, 1);
                rooms[index].game.players[indexUser].numCartas--;
                rooms[index].game.table.centroMesa.push({ playerId: infos.player, carta })
                if (rooms[index].game.table.turno.player != 4) rooms[index].game.table.turno.player++;
                else rooms[index].game.table.turno.player = 1;
                if (rooms[index].game.table.centroMesa.length == 4) {
                    verificaQuemGanhou(index);
                } else {
                    CardEmitter.emitCards(index, rooms, io);

                }
            }
        }
    });
    function verificaQuemGanhou(index) {
        let maior = rooms[index].game.table.centroMesa[0];
        let empate = 0;
        let rankCartas = [
            3, 2, 1, 13, 12, 11, 7, 6, 5, 4
        ];
        let rankNaipes = [
            'c', 'h', 's', 'd'
        ]
        for (let i = 1; i < rooms[index].game.table.centroMesa.length; i++) {
            if (maior.carta.value == (rooms[index].game.table.coringa.value + 1) || (maior.carta.value == 1 && rooms[index].game.table.coringa.value == 13) || (maior.carta.value == 11 && rooms[index].game.table.coringa.value == 7)) {//ve se a maior carta tambem é coringa 
                if (rooms[index].game.table.centroMesa[i].carta.value == (rooms[index].game.table.coringa.value + 1) || (rooms[index].game.table.centroMesa[i].carta.value == 1 && rooms[index].game.table.coringa.value == 13) || (rooms[index].game.table.centroMesa[i].carta.value == 11 && rooms[index].game.table.coringa.value == 7)) {//ve se a carta e coringa
                    let rankNaipeMaior = rankNaipes.findIndex((e) => e == maior.carta.suit)
                    let rankNaipeAtual = rankNaipes.findIndex((e) => e == rooms[index].game.table.centroMesa[i].carta.suit);
                    if (rankNaipeAtual < rankNaipeMaior) {
                        maior = rooms[index].game.table.centroMesa[i];
                        empate = 0;
                    }
                }
            } else {
                if (rooms[index].game.table.centroMesa[i].carta.value == (rooms[index].game.table.coringa.value + 1) || (rooms[index].game.table.centroMesa[i].carta.value == 1 && rooms[index].game.table.coringa.value == 13) || (rooms[index].game.table.centroMesa[i].carta.value == 11 && rooms[index].game.table.coringa.value == 7)) {//ve se a carta e coringa
                    maior = rooms[index].game.table.centroMesa[i];
                    empate = 0;
                } else {
                    let rankMaior = rankCartas.findIndex((e) => e == maior.carta.value);
                    let rankAtual = rankCartas.findIndex((e) => e == rooms[index].game.table.centroMesa[i].carta.value);
                    if (rankAtual < rankMaior) {
                        maior = rooms[index].game.table.centroMesa[i];
                    } else {
                        if (rankAtual == rankMaior) {//n empata mesmo time
                            let indexUserMaior = rooms[index].game.players.findIndex((e) => e.idTurno == maior.playerId);
                            let indexUserAtual = rooms[index].game.players.findIndex((e) => e.idTurno == rooms[index].game.table.centroMesa[i].playerId);
                            if (rooms[index].game.players[indexUserMaior].team != rooms[index].game.players[indexUserAtual].team) {
                                empate = 1;
                            }
                        }

                    }
                }
            }
        }
        if (empate != 1) {//adiciona o ponto do round
            rooms[index].game.table.turno.player = maior.playerId;
            let indexUser = rooms[index].game.players.findIndex((e) => e.idTurno == maior.playerId);//pegar time do vencedor
            if (rooms[index].game.players[indexUser].team == 'red') {
                rooms[index].game.table.roundPoints.red++;
                if (rooms[index].game.table.roundPoints.quemGanhouPrimeiro == '') {
                    rooms[index].game.table.roundPoints.quemGanhouPrimeiro = 'red';
                }
            } else {
                rooms[index].game.table.roundPoints.blue++;
                if (rooms[index].game.table.roundPoints.quemGanhouPrimeiro == '') {
                    rooms[index].game.table.roundPoints.quemGanhouPrimeiro = 'blue';
                }
            }
        } else {
            rooms[index].game.table.roundPoints.empate++;
        }
        CardEmitter.emitCards(index, rooms, io);
        rooms[index].game.table.centroMesa = [];//limpa mesa
        setTimeout(function () {
            //verifica se ja acabou o round
            verificaFimRound(index);

        }, 2000);
    }
    function verificaFimRound(index) {
        let endRound = 0;
        if (rooms[index].game.table.roundPoints.empate > 0) {
            if (rooms[index].game.table.roundPoints.red == 1 && rooms[index].game.table.roundPoints.blue == 1) {
                if (rooms[index].game.table.roundPoints.quemGanhouPrimeiro == 'red') {
                    rooms[index].game.table.teamsPoint.red += rooms[index].game.table.valueTruco;
                    endRound = 1;
                } else {
                    rooms[index].game.table.teamsPoint.blue += rooms[index].game.table.valueTruco;
                    endRound = 1;
                }
            } else {
                if (rooms[index].game.table.roundPoints.red > 0) {
                    rooms[index].game.table.teamsPoint.red += rooms[index].game.table.valueTruco;
                    endRound = 1;
                }
                if (rooms[index].game.table.roundPoints.blue > 0) {
                    rooms[index].game.table.teamsPoint.blue += rooms[index].game.table.valueTruco;
                    endRound = 1;
                }
                if (rooms[index].game.table.roundPoints.empate == 3) {
                    endRound = 1;
                }
            }
        }
        if (rooms[index].game.table.roundPoints.red == 2) {
            rooms[index].game.table.teamsPoint.red += rooms[index].game.table.valueTruco;
            endRound = 1;
        }
        if (rooms[index].game.table.roundPoints.blue == 2) {
            rooms[index].game.table.teamsPoint.blue += rooms[index].game.table.valueTruco;
            endRound = 1;
        }
        if (endRound == 1) {//acabou o round
            criaNovoRound(index);
            verificaFimGame(index);
        } else {
            CardEmitter.emitCards(index, rooms, io);

        }
    }
    function verificaFimGame(index) {
        if (rooms[index].game.table.teamsPoint.blue >= 12 || rooms[index].game.table.teamsPoint.red >= 12) {
            rooms[index].game.table.endGame = true;
            setTimeout(function () {

                CardEmitter.emitCards(index, rooms, io);

                socket.leave(socket.room);
                if (rooms[index].gameStatus != 1) {
                    rooms[index].game = { active: false };
                    rooms[index].gameStatus = 1;
                    rooms[index].usersid = [];
                    rooms[index].usersname = [];
                    rooms[index].q = 0;
                    rooms[index].status = 'waiting...';
                }
                io.emit('dispRooms', rooms);
            }, 1000);
        } else {
            if (rooms[index].game.table.teamsPoint.blue == 11 || rooms[index].game.table.teamsPoint.red == 11) {
                if (rooms[index].game.table.teamsPoint.blue == 11) rooms[index].game.table.onze.maoOnze = 'blue';
                if (rooms[index].game.table.teamsPoint.red == 11) rooms[index].game.table.onze.maoOnze = 'red';
                if (rooms[index].game.table.teamsPoint.red == 11 && rooms[index].game.table.teamsPoint.blue == 11) rooms[index].game.table.onze.maoOnze = 'ambos';
                if (rooms[index].game.table.onze.maoOnze != 'ambos') {
                    rooms[index].game.table.onze.maoOnzeStatus = 'decide';
                    rooms[index].game.table.onze.message = 'Estamos decidindo a mão de onze';
                }
                emitCardsMaoOnze(index);
            } else {
                CardEmitter.emitCards(index, rooms, io);

            }
        }
    }
    function emitCardsMaoOnze(index) {
        if (rooms[index].game.table.teamsPoint.red == 11 && rooms[index].game.table.teamsPoint.blue == 11) rooms[index].game.table.onze.maoOnze = 'ambos';
        for (let j = 0; j < 4; j++) {
            let privatePlayers = [];
            for (let i = 0; i < 4; i++) {
                if (rooms[index].game.players[i].id == rooms[index].game.players[j].id) {//entra aki se for eu
                    if (rooms[index].game.table.teamsPoint.blue == 11 && rooms[index].game.table.teamsPoint.red == 11) {
                        privatePlayers.push({
                            isMe: true,
                            idTurno: rooms[index].game.players[i].idTurno,
                            nome: rooms[index].game.players[i].nome,
                            id: rooms[index].game.players[i].id,
                            team: rooms[index].game.players[i].team,
                            numCartas: rooms[index].game.players[i].numCartas,
                        })
                    } else {
                        privatePlayers.push({
                            isMe: true,
                            ...rooms[index].game.players[i]
                        });
                    }
                } else {
                    if (rooms[index].game.table.teamsPoint.blue == 11 && rooms[index].game.table.teamsPoint.red == 11) {
                        privatePlayers.push({
                            isMe: false,
                            idTurno: rooms[index].game.players[i].idTurno,
                            nome: rooms[index].game.players[i].nome,
                            id: rooms[index].game.players[i].id,
                            team: rooms[index].game.players[i].team,
                            numCartas: rooms[index].game.players[i].numCartas,
                        })
                    } else {
                        if (rooms[index].game.table.teamsPoint.blue == 11 && rooms[index].game.table.teamsPoint.red != 11 && rooms[index].game.players[i].team == 'blue') {
                            privatePlayers.push({
                                isMe: false,
                                ...rooms[index].game.players[i]
                            })
                        } else {

                            if (rooms[index].game.table.teamsPoint.blue != 11 && rooms[index].game.table.teamsPoint.red == 11 && rooms[index].game.players[i].team == 'red') {
                                privatePlayers.push({
                                    isMe: false,
                                    ...rooms[index].game.players[i]
                                })
                            } else {
                                privatePlayers.push({
                                    isMe: false,
                                    idTurno: rooms[index].game.players[i].idTurno,
                                    nome: rooms[index].game.players[i].nome,
                                    id: rooms[index].game.players[i].id,
                                    team: rooms[index].game.players[i].team,
                                    numCartas: rooms[index].game.players[i].numCartas,
                                })
                            }
                        }
                    }
                }
            }
            let removeCards = {
                active: true,
                myTeam: rooms[index].game.players[j].team,
                myPos: rooms[index].game.players[j].idTurno,
                ...rooms[index].game.table,
                players: privatePlayers
            }
            io.to(`${rooms[index].game.players[j].id}`).emit('gameStart', removeCards);
        }
    }
    function criaNovoRound(index) {
        if (rooms[index].game.table.turno.lastStart == rooms[index].max) {//ve o player q comeca o proximo round
            rooms[index].game.table.turno.player = 1;
            rooms[index].game.table.turno.lastStart = 1;
        } else {
            rooms[index].game.table.turno.lastStart++;
            rooms[index].game.table.turno.player = rooms[index].game.table.turno.lastStart;
        }
        let deck = new Deck();
        for (let i = 0; i < rooms[index].max; i++) {//gera novas cartas pros players
            rooms[index].game.players[i].numCartas = 3;
            rooms[index].game.players[i].cartas = [];
            for (let j = 0; j < 3; j++) {
                rooms[index].game.players[i].cartas.push(deck.deal());
            }
        }
        zeraPedidoTruco(index);
        rooms[index].game.table.valueTruco = 1;
        rooms[index].game.table.coringa = deck.deal();
        rooms[index].game.table.roundPoints.quemGanhouPrimeiro = '';
        rooms[index].game.table.roundPoints.red = 0;
        rooms[index].game.table.roundPoints.blue = 0;
        rooms[index].game.table.roundPoints.empate = 0;
    }
    socket.on('pedirTruco', function (infos) {
        let index = rooms.findIndex((e) => e.name === socket.room);
        if (index != -1) {
            let indexUser = rooms[index].game.players.findIndex((e) => e.id == socket.id);//acha o usuario q requisito
            let team = rooms[index].game.players[indexUser].team;//time do usuario q requisito
            if (rooms[index].game.table.onze.maoOnze == '') {
                if (rooms[index].game.table.requestTruco.requested == false) {//faz o pedido
                    requestTruco(index, indexUser, team);
                } else {//ve se vao aceitar o pedido
                    if (team == rooms[index].game.table.requestTruco.to) {
                        let verificaVoto = rooms[index].game.table.requestTruco.votacao.findIndex((e) => e.id == socket.id);//ve se o player ja votou
                        if (verificaVoto == -1) {
                            let text;
                            if (infos.value == 1) text = 'TRUCO';
                            if (infos.value == 2) text = 'Aceito';
                            if (infos.value == 3) text = 'To fora';
                            rooms[index].game.table.requestTruco.votacao.push({ player: rooms[index].game.players[indexUser].nome, status: infos.value, text, id: socket.id });
                            rooms[index].game.table.requestTruco.votosCont++;
                            verificaFimGame(index);
                            if (infos.value == 1) {
                                contabilizaVotacao(index, indexUser, team, infos.value);
                            } else {
                                if (rooms[index].game.table.requestTruco.votosCont == 2) {
                                    setTimeout(function () {
                                        contabilizaVotacao(index, indexUser, team, infos.value);
                                    }, 2000);
                                }
                            }
                        }

                    }
                }
            }
        }
    });
    function contabilizaVotacao(index, indexUser, team, value) {
        if (rooms[index].game.table.requestTruco.votacao[0].status == 1 || rooms[index].game.table.requestTruco.votacao[1].status == 1) {//pediu 6 ou 9 ou 12
            rooms[index].game.table.requestTruco.votosCont = 0;
            rooms[index].game.table.requestTruco.votacao = [];
            rooms[index].game.table.valueTruco = rooms[index].game.table.requestTruco.value;
            requestTruco(index, indexUser, team);
        } else {
            if (rooms[index].game.table.requestTruco.votacao[0].status == 2 || rooms[index].game.table.requestTruco.votacao[1].status == 2) {// 1 deles aceitou
                rooms[index].game.table.requestTruco.playerName = 'Time ' + team;
                rooms[index].game.table.requestTruco.status = 'Aceitamos';
                rooms[index].game.table.valueTruco = rooms[index].game.table.requestTruco.value;
                rooms[index].game.table.requestTruco.votosCont = 0;
                rooms[index].game.table.requestTruco.votacao = [];
                CardEmitter.emitCards(index, rooms, io);

                rooms[index].game.table.requestTruco.requested = false;
                setTimeout(function () {
                    CardEmitter.emitCards(index, rooms, io);

                }, 2000);
            } else {//os dois correram
                if (team == 'red') rooms[index].game.table.teamsPoint.blue += rooms[index].game.table.valueTruco;
                else rooms[index].game.table.teamsPoint.red += rooms[index].game.table.valueTruco;
                rooms[index].game.table.requestTruco.status = 'Vamos correr';
                rooms[index].game.table.requestTruco.playerName = 'Time ' + team;
                CardEmitter.emitCards(index, rooms, io);

                criaNovoRound(index);
                setTimeout(function () {
                    verificaFimGame(index);
                }, 2000);
            }
        }

    }
    function requestTruco(index, indexUser, team) {
        if (team !== rooms[index].game.table.requestTruco.by && rooms[index].game.table.requestTruco.value < 12) {//ve se o time q ta fazendo pedido e diferente do ultimo q fez
            rooms[index].game.table.requestTruco.requested = true;
            rooms[index].game.table.requestTruco.by = team;
            rooms[index].game.table.requestTruco.to = (team == 'red') ? 'blue' : 'red';
            rooms[index].game.table.requestTruco.playerName = rooms[index].game.players[indexUser].nome;
            rooms[index].game.table.requestTruco.value += 3;
            rooms[index].game.table.requestTruco.status = (rooms[index].game.table.requestTruco.value == 3) ? 'Pedindo Truco' : 'Pedindo ' + rooms[index].game.table.requestTruco.value;
            CardEmitter.emitCards(index, rooms, io);

        }
    }
    function zeraPedidoTruco(index) {
        rooms[index].game.table.requestTruco.requested = false;
        rooms[index].game.table.requestTruco.by = '';
        rooms[index].game.table.requestTruco.to = '';
        rooms[index].game.table.requestTruco.playerName = '';
        rooms[index].game.table.requestTruco.value = 0;
        rooms[index].game.table.requestTruco.votacao = [];
        rooms[index].game.table.requestTruco.votosCont = 0;
        rooms[index].game.table.requestTruco.status = '';
    }

    socket.on('statusMaoOnze', function (infos) {
        let index = rooms.findIndex((e) => e.name === socket.room);
        if (index != -1) {
            let indexUser = rooms[index].game.players.findIndex((e) => e.id == socket.id);//acha o usuario q requisito
            let team = rooms[index].game.players[indexUser].team;//time do usuario q requisito
            if (rooms[index].game.table.onze.maoOnze == team) {
                let verificaVoto = rooms[index].game.table.onze.votacao.findIndex((e) => e.id == socket.id);//ve se o player ja votou
                if (verificaVoto == -1) {
                    if (infos.value == 1) text = 'To dentro';
                    if (infos.value == 2) text = 'To fora';
                    rooms[index].game.table.onze.votacao.push({ player: rooms[index].game.players[indexUser].nome, status: infos.value, text, id: socket.id });
                    rooms[index].game.table.onze.votosCont++;
                    emitCardsMaoOnze(index);
                    if (rooms[index].game.table.onze.votosCont == 2) {

                        if (rooms[index].game.table.onze.votacao[0].status == 1 || rooms[index].game.table.onze.votacao[1].status == 1) {
                            rooms[index].game.table.onze.maoOnzeStatus = 'decide';
                            rooms[index].game.table.onze.message = 'Aceitamos a mão de onze';
                            emitCardsMaoOnze(index);
                            rooms[index].game.table.onze.votosCont = 0;
                            rooms[index].game.table.onze.votacao = [];
                            rooms[index].game.table.onze.message = '';
                            rooms[index].game.table.onze.maoOnze = '';
                            rooms[index].game.table.onze.maoOnzeStatus = '';
                            rooms[index].game.table.valueTruco = 3;
                            rooms[index].game.table.onze.maoOnzeStatus = 'aceito';
                            setTimeout(function () {
                                emitCardsMaoOnze(index);
                            }, 2000);
                        } else {
                            if (rooms[index].game.table.onze.votacao[0].status == 2 && rooms[index].game.table.onze.votacao[1].status == 2) {
                                rooms[index].game.table.onze.maoOnzeStatus = 'decide';
                                rooms[index].game.table.onze.message = 'Vamos correr';
                                emitCardsMaoOnze(index);
                                if (rooms[index].game.table.onze.maoOnze == 'red') rooms[index].game.table.teamsPoint.blue += rooms[index].game.table.valueTruco;
                                else rooms[index].game.table.teamsPoint.red += rooms[index].game.table.valueTruco;
                                rooms[index].game.table.onze.maoOnzeStatus = 'corremos';
                                rooms[index].game.table.onze.votosCont = 0;
                                rooms[index].game.table.onze.votacao = [];
                                rooms[index].game.table.onze.message = '';
                                rooms[index].game.table.onze.maoOnze = '';
                                rooms[index].game.table.onze.maoOnzeStatus = '';
                                criaNovoRound(index);
                                setTimeout(function () {
                                    verificaFimGame(index);
                                }, 2000);
                            }
                        }
                    }
                }
            }
        }
    });
});


server.listen(process.env.PORT || 3001);