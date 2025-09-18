document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const game = new Chess();
  let board = null;
  let gameId = null;
  let playerColor = null;
  let opponentConnected = false;
  let nickname = null;
  let isGameOver = false;
  let resetTimeout = null;
 
  let whiteMaterial = 0;
  let blackMaterial = 0;

  let abandonButton = document.getElementById('abandon-game');
  const abandonConfirmModal = new bootstrap.Modal('#abandonConfirmModal');

  document.getElementById('abandon-game').addEventListener('click', () => {
  abandonConfirmModal.show();
});

document.getElementById('confirmAbandon').addEventListener('click', () => {
  abandonConfirmModal.hide();
  socket.emit('abandonGame', { gameId });
});

function handleGameAbandonment(isVoluntary) {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modalEl => {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  });

  const backdrops = document.querySelectorAll('.modal-backdrop');
  backdrops.forEach(backdrop => backdrop.remove());

  document.body.style.overflow = 'auto';
  document.body.style.paddingRight = '0';

  gameId = null;
  playerColor = null;
  opponentConnected = false;
  isGameOver = true;

  document.getElementById('abandon-game').classList.add('d-none');
  document.getElementById('create-game').disabled = false;
  document.getElementById('join-game').disabled = false;
  document.getElementById('game-id').value = '';
  
  game.reset();
  board.setPosition('start');
  
  document.getElementById('chat-input').disabled = true;
  document.getElementById('send-message').disabled = true;
  document.getElementById('chat-messages').innerHTML = '';
  
  document.getElementById('move-history').innerHTML = '';
  whiteMaterial = 0;
  blackMaterial = 0;
  updateMaterialUI();

  if (isVoluntary) {
    document.getElementById('game-status').textContent = 'Hai abbandonato la partita';
  } else {
    document.getElementById('game-status').textContent = 'Il tuo avversario ha abbandonato!';
  }
  opponentConnected = false; 
  enableChat(); 
}

  const nicknameModal = new bootstrap.Modal(document.getElementById('nicknameModal'));
  nicknameModal.show();

  document.getElementById('confirmNickname').addEventListener('click', () => {
  nickname = document.getElementById('nicknameInput').value.trim();
  if (nickname) {
    nicknameModal.hide();
    document.getElementById('game-status').textContent = `Benvenuto ${nickname}!`;
    socket.emit('setNickname', nickname);
  }
});

document.getElementById('nicknameModal').addEventListener('hide.bs.modal', (e) => {
  if (!nickname) e.preventDefault();
});

function showGameResultModal(result) {
  const modalEl = document.getElementById('resultModal');
  let title, message;

  switch (result) {
    case 'win':
      title = 'VITTORIA!';
      message = '🎉 Complimenti! 🎉';
      break;
    case 'lose':
      title = 'SCONFITTA!';
      message = '😔 Ritenta! 😔';
      break;
    case 'draw':
      title = 'PATTA!';
      message = '🤝 La partita è pari!';
      break;
  }

  if (!modalEl) {
    const modalHTML = `
      <div class="modal fade" id="resultModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-body text-center py-5">
              <h2>${title}</h2>
              <p class="mt-3">${message}</p>
              <button id="closeResultModal" class="btn btn-primary mt-3">Chiudi</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  } else {
    modalEl.querySelector('h2').textContent = title;
    modalEl.querySelector('p').textContent = message;
  }

  const modal = new bootstrap.Modal('#resultModal');
  const closeBtn = document.getElementById('closeResultModal');
  
  closeBtn.replaceWith(closeBtn.cloneNode(true));
  
  document.getElementById('closeResultModal').addEventListener('click', () => {
    modal.hide();
    if (resetTimeout) {
      clearTimeout(resetTimeout);
      resetTimeout = null;
    }
    socket.emit('resetGame', { gameId });
  });

  modal.show();
}

  function enableChat() {
  const chatActive = opponentConnected && !isGameOver && playerColor;
  document.getElementById('chat-input').disabled = !chatActive;
  document.getElementById('send-message').disabled = !chatActive;
}

  document.getElementById('send-message').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (message && nickname && !input.disabled) { // Controllo sullo stato effettivo
    socket.emit('chatMessage', {
      gameId,
      message,
      color: playerColor
    });
    addMessageToChat(message, 'sent');
    input.value = '';
  }
}

  function addMessageToChat(message, type) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  
  messageDiv.className = `chat-message ${type === 'sent' ? 'sent' : 'received'}`;
  messageDiv.textContent = message;
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


  socket.on('chatMessage', ({ message, color }) => {
    if (color !== playerColor) {
      addMessageToChat(message, 'received');
    }
  });

  enableChat();

  const pieceValues = {
    'p': 1,
    'n': 3,
    'b': 3,
    'r': 5,
    'q': 9,
    'k': 0
  };

  function updateMaterialUI() {
    const whiteEl = document.getElementById('white-material');
    const blackEl = document.getElementById('black-material');
   
    whiteEl.textContent = `${whiteMaterial >= 0 ? '+' : ''}${whiteMaterial}`;
    blackEl.textContent = `${blackMaterial >= 0 ? '+' : ''}${blackMaterial}`;
   
    whiteEl.className = whiteMaterial >= 0 ? 'text-success' : 'text-danger';
    blackEl.className = blackMaterial >= 0 ? 'text-success' : 'text-danger';
  }

  board = Chessboard2('board', {
    pieceTheme: 'https://unpkg.com/@chrisoakman/chessboard2@0.5.0/dist/img/chesspieces/wikipedia/{piece}.png',
    draggable: true,

    onDragStart: (sourceObj) => {
      const piece = sourceObj.piece;

      if (!piece || !playerColor || !opponentConnected) return false;
      if (piece[0] !== playerColor[0]) return false;
      if (game.turn() !== playerColor[0]) return false;

      return true;
    },

    onDrop: (source, _target) => {
      const sourceSquare = source.square || source.source;
      const targetSquare = source.target;

      if (!sourceSquare || !targetSquare) return 'snapback';

      try {
        const move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q'
        });

        if (!move) return 'snapback';

        if (move.captured) {
          const value = pieceValues[move.captured];
          if (playerColor === 'white') {
            whiteMaterial += value;
          } else {
            blackMaterial += value;
          }
          updateMaterialUI();
        }

        socket.emit('move', { gameId, move });
        updateBoardUI();
      } catch (e) {
        return 'snapback';
      }
    }
  });

  board.resize(600);

  function updateBoardUI() {
  board.resize();
  board.setPosition(game.fen());
  
  const history = game.history();
  const historyElement = document.getElementById('move-history');
  let html = '';
  
  for (let i = 0; i < history.length; i += 2) {
    const gap = " ";
    const whiteMove = history[i];
    const blackMove = history[i + 1] || '';
   
    html += `
      <tr>
        <td>${gap}</td>
        <td>${whiteMove}</td>
        <td>${blackMove}</td>
      </tr>
    `;
  }
  
  historyElement.innerHTML = html;

  let status = '';
  if (game.in_checkmate()) {
    const result = game.turn() === playerColor[0] ? 'lose' : 'win';
    showGameResultModal(result);
    resetTimeout = setTimeout(() => {
      socket.emit('resetGame', { gameId });
    }, 3000);
  } else if (game.in_draw()) {
    showGameResultModal('draw');
    resetTimeout = setTimeout(() => {
      socket.emit('resetGame', { gameId });
    }, 3000);
  } else {
    status = `Turno del ${game.turn() === 'w' ? 'bianco' : 'nero'}`;
    if (game.in_check()) status += ' - Scacco!';
    if (playerColor && game.turn() === playerColor[0]) {
      status += ' (Tocca a te!)';
    }
  }

  document.getElementById('game-status').textContent = status;
}

  document.getElementById('create-game').addEventListener('click', () => {
    if (!nickname) return alert('Devi inserire un nickname!');
    socket.emit('createGame', { nickname });
    document.getElementById('create-game').disabled = true;
    document.getElementById('join-game').disabled = true;
  });

  document.getElementById('join-game').addEventListener('click', () => {
    if (!nickname) return alert('Devi inserire un nickname!');
    const id = document.getElementById('game-id').value.trim().toUpperCase();
    if (!id) {
      alert('Inserisci un ID partita valido');
      return;
    }
    socket.emit('joinGame', { gameId: id });
    document.getElementById('join-game').disabled = true;
    document.getElementById('create-game').disabled = true;
  });

  socket.on('connect', () => {
    document.getElementById('game-status').textContent = 'Connesso al server';
  });

  socket.on('gameCreated', (data) => {
    gameId = data.gameId;
    playerColor = 'white';
    board.setOrientation('white');
    document.getElementById('game-id').value = data.gameId;
    document.getElementById('game-status').textContent = `Partita creata (ID: ${data.gameId}) - In attesa del nero...`;
  });

  socket.on('gameJoined', (data) => {
    if (data.error) {
      alert(data.error);
      document.getElementById('join-game').disabled = false;
      return;
    }

    gameId = data.gameId;
    playerColor = data.color;
    opponentConnected = true;

    game.load(data.fen || 'start');
    board.setOrientation(data.color);
    board.setPosition(data.fen || 'start');

    updateBoardUI();
    document.getElementById('game-status').textContent = `Sei il ${data.color === 'white' ? 'bianco' : 'nero'}! Partita iniziata`;
    abandonButton.style.display = 'inline-block';
    abandonButton.classList.remove('d-none');
    opponentConnected = true;
    isChatInitialized = true;
    enableChat();
  });

  socket.on('opponentJoined', (data) => {
    opponentConnected = true;
    game.load(data.fen || 'start');
    board.setPosition(data.fen || 'start');
    updateBoardUI();
    document.getElementById('game-status').textContent =
      playerColor === 'white'
        ? 'Avversario unito! Tocca a te'
        : 'Avversario unito! Tocca al bianco';
    abandonButton.style.display = 'inline-block';
    abandonButton.classList.remove('d-none');
    opponentConnected = true;
    isChatInitialized = true;
    enableChat();
  });

  socket.on('moveMade', (move) => {
    try {
      const appliedMove = game.move(move);
      if (appliedMove) {
        if (appliedMove.captured) {
          const value = pieceValues[appliedMove.captured];
          if (appliedMove.color === 'w') {
            whiteMaterial += value;
          } else {
            blackMaterial += value;
          }
          updateMaterialUI();
        }
        updateBoardUI();
      }
    } catch (e) {
      console.error('Errore applicazione mossa:', e);
    }
    if (game.isGameOver()) {
    const result = game.turn() === playerColor[0] ? 'lose' : 'win';
    showGameResultModal(result);
    isGameOver = true;
  }
  });

  socket.on('gameNotFound', (gameId) => {
    alert(`Partita con ID ${gameId} non trovata`);
    document.getElementById('join-game').disabled = false;
  });

  socket.on('error', (error) => {
    alert(`Errore: ${error.message || error}`);
    document.getElementById('join-game').disabled = false;
    document.getElementById('create-game').disabled = false;
  });

  socket.on('gameAbandoned', () => {
  showGameResultModal('win');
  handleGameAbandonment(false);
});

socket.on('abandonSuccess', () => {
  handleGameAbandonment(true);
  alert('Hai abbandonato la partita');
});

socket.on('opponentAbandoned', () => {
  showGameResultModal('win');
  handleGameAbandonment(false);
});

  socket.on('newGame', (data) => {
    game.reset();
    board.setPosition(game.fen());
   
    gameId = data.gameId;
    opponentConnected = true;
   
    whiteMaterial = 0;
    blackMaterial = 0;
    updateMaterialUI();
   
    board.setOrientation(playerColor);
    document.getElementById('move-history').textContent = "";
    document.getElementById('game-status').textContent = "Nuova partita iniziata!";
    isGameOver = false; 
    opponentConnected = true; 
    enableChat(); 
  });

});


