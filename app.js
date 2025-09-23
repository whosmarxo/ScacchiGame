const express = require('express');
const socketio = require('socket.io');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`Server in ascolto su http://localhost:${PORT}`);
});

const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const games = {};

io.on('connection', (socket) => {
  console.log('Nuova connessione:', socket.id);

  socket.on('createGame', () => {
    const gameId = generateId();
    const chess = new Chess();

    games[gameId] = {
      chess,
      players: {
        white: socket.id,
        black: null
      },
      status: 'waiting'
    };

    socket.join(gameId);
    console.log(`Partita creata: ${gameId}`, {
      players: games[gameId].players,
      fen: chess.fen()
    });

    socket.emit('gameCreated', {
      gameId,
      playerId: socket.id
    });
  });

  socket.on('joinGame', ({ gameId }) => {
    gameId = gameId.toUpperCase();
    console.log(`Tentativo di unione a ${gameId} da ${socket.id}`);

    const game = games[gameId];
    if (!game) {
      console.log(`Partita ${gameId} non trovata`);
      return socket.emit('gameNotFound', gameId);
    }

    if (game.players.black) {
      console.log(`Partita ${gameId} già piena`);
      return socket.emit('gameJoined', {
        error: 'La partita è già piena'
      });
    }

    game.players.black = socket.id;
    game.status = 'active';
    socket.join(gameId);

    const fen = game.chess.fen();
    console.log(`Giocatore ${socket.id} unito a ${gameId} come nero`, {
      fen,
      players: game.players
    });

    socket.emit('gameJoined', {
      opponentConnected: !!game.players.black,
      gameId,
      color: 'black',
      fen,
      opponent: game.players.white,
      opponentConnected: true,
    });

    io.to(game.players.white).emit('opponentJoined', {
      fen,
      opponent: socket.id,
      opponentConnected: true
    });
  });

  socket.on('move', ({ gameId, move }) => {
    const game = games[gameId];
    if (!game) {
      console.log(`Partita ${gameId} non trovata per mossa`);
      return;
    }

    try {
      const result = game.chess.move(move);
      if (result) {
        console.log(`Mossa valida in ${gameId}:`, result);
        io.to(gameId).emit('moveMade', result);
      } else {
        console.log('Mossa non valida');
      }
    } catch (e) {
      console.error('Errore mossa', e.message);
      socket.emit('error', e.message);
    }
  });

  socket.on('resetGame', ({ gameId }) => {
  const game = games[gameId];
  if (game) {
    game.chess.reset();
    game.status = 'active';
   
    io.to(gameId).emit('newGame', {
      fen: game.chess.fen(),
      gameId,
      players: game.players
    });
  }
});

socket.on('abandonGame', ({ gameId }) => {
  const game = games[gameId];
  if (!game) return;

  const opponent = game.players.white === socket.id ? game.players.black : game.players.white;
  if (opponent) {
    io.to(opponent).emit('opponentAbandoned');
  }

  socket.emit('abandonSuccess');
  
  delete games[gameId];
  if (socket) socket.leave(gameId);
  if (opponent) {
      const opponentSocket = io.sockets.sockets.get(opponent);
      if (opponentSocket) opponentSocket.leave(gameId);
  }
});

  socket.on('disconnect', () => {
  for (const gameId in games) {
    const game = games[gameId];
    if (game.players.white === socket.id || game.players.black === socket.id) {
      const opponent = game.players.white === socket.id ? game.players.black : game.players.white;
      if (opponent) {
        io.to(opponent).emit('opponentAbandoned');
      }
      delete games[gameId];
    }
  }
});

socket.on('chatMessage', ({ gameId, message, color }) => {
  const game = games[gameId];
  if (!game) return;

  const opponent = game.players.white === socket.id ? game.players.black : game.players.white;
  if (opponent) {
    io.to(opponent).emit('chatMessage', {
      message,
      color,
      isSender: false
    });
  }
  socket.emit('chatMessage', {
    message,
    color,
    isSender: true
  });
});

});


function generateId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

