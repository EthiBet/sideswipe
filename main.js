// ============================================================
// SIDESWIPE LOBBY - screens, usernames, and PeerJS networking
// ============================================================
// This file owns everything before the match starts. Once a match is
// ready (room full, or two parties successfully bridged), it reveals
// #game-screen and dynamically imports main.js to start the actual
// 3D game. Real multi-car network sync (each connected player's car
// actually moving/hitting the ball for everyone) is the NEXT stage on
// top of this - this stage proves the connections and lobby flow work.

const lobbyDebugEl = document.getElementById('lobby-debug');
function lobbyLog(msg) {
  lobbyDebugEl.textContent += (lobbyDebugEl.textContent ? '\n' : '') + msg;
}

// ---------- SCREEN MANAGEMENT ----------
const screens = ['username-screen', 'home-screen', 'join-code-screen', 'qr-screen', 'party-screen'];
function showScreen(id) {
  screens.forEach((s) => {
    document.getElementById(s).style.display = s === id ? 'flex' : 'none';
  });
}

// ---------- STATE ----------
let localUsername = '';
let peer = null;
let isHost = false;
let hostConnections = []; // if we're a host: DataConnection to each other player
let clientConnection = null; // if we're a client: DataConnection to the host
let currentRoomCode = null;
let roomCapacity = 2; // 2 for solo 1v1, or party-size*2 once bridged
let partyMembers = []; // {username, conn} - members connected to US as a party leader
let partyRosterFromServer = []; // usernames, kept in sync for display on client side too
let isPartyLeader = false;
let pendingChallengeConn = null; // temporary connection while challenging another party
let matchRosterLocked = false; // true once a challenge is accepted and we're the final host

function generateRoomCode() {
  return 'sideswipe-' + Math.random().toString(36).substring(2, 7);
}

function renderQRFor(code) {
  const container = document.getElementById('qr-code-container');
  container.innerHTML = '';
  const img = document.createElement('img');
  img.width = 200;
  img.height = 200;
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(code)}`;
  container.appendChild(img);
  document.getElementById('qr-code-text').textContent = code;
}

function renderPartyMembers(usernames) {
  const list = document.getElementById('party-members-list');
  list.innerHTML = '';
  usernames.forEach((name) => {
    const card = document.createElement('div');
    card.className = 'party-member-card';
    card.textContent = name;
    list.appendChild(card);
  });
}

// ---------- STARTING THE ACTUAL GAME ----------
let gameStarted = false;
function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  screens.forEach((s) => { document.getElementById(s).style.display = 'none'; });
  lobbyDebugEl.style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  import('./main.js').catch((err) => {
    lobbyDebugEl.style.display = 'block';
    lobbyLog('FAILED TO START GAME: ' + (err.message || err));
  });
}

// ============================================================
// USERNAME SCREEN
// ============================================================
document.getElementById('username-continue-btn').addEventListener('click', () => {
  const val = document.getElementById('username-input').value.trim();
  if (!val) return;
  localUsername = val;
  document.getElementById('home-username-display').textContent = localUsername;
  showScreen('home-screen');
});

// ============================================================
// HOME SCREEN
// ============================================================
document.getElementById('host-game-btn').addEventListener('click', () => {
  isHost = true;
  roomCapacity = 2; // solo host is always a 1v1
  currentRoomCode = generateRoomCode();
  hostConnections = [];

  peer = new Peer(currentRoomCode);
  peer.on('open', (id) => {
    lobbyLog(`Hosting 1v1 room: ${id}`);
    renderQRFor(id);
    showScreen('qr-screen');
  });
  peer.on('error', (err) => lobbyLog('PEER ERROR: ' + err.type));

  peer.on('connection', (conn) => {
    if (hostConnections.length >= roomCapacity - 1) {
      conn.on('open', () => conn.close());
      return;
    }
    conn.on('open', () => {
      lobbyLog(`Player joined: ${conn.metadata?.username || 'unknown'}`);
      hostConnections.push(conn);
      if (hostConnections.length === roomCapacity - 1) {
        lobbyLog('Room full - starting match');
        hostConnections.forEach((c) => c.send({ type: 'matchStart' }));
        startGame();
      }
    });
  });
});

document.getElementById('join-game-btn').addEventListener('click', () => {
  document.getElementById('join-code-title').textContent = 'Enter Room Code';
  document.getElementById('join-code-input').dataset.mode = 'game';
  showScreen('join-code-screen');
});

document.getElementById('create-party-btn').addEventListener('click', () => {
  isHost = true;
  isPartyLeader = true;
  currentRoomCode = generateRoomCode();
  hostConnections = [];
  partyMembers = [];

  peer = new Peer(currentRoomCode);
  peer.on('open', (id) => {
    lobbyLog(`Party created: ${id}`);
    document.getElementById('party-code-display').textContent = id;
    document.getElementById('party-status-text').textContent = 'Waiting for party members...';
    renderPartyMembers([localUsername]);
    document.getElementById('challenge-code-input').style.display = 'block';
    document.getElementById('party-challenge-btn').style.display = 'block';
    showScreen('party-screen');
  });
  peer.on('error', (err) => lobbyLog('PEER ERROR: ' + err.type));

  peer.on('connection', (conn) => {
    if (conn.metadata?.isPartyChallenge) {
      handleIncomingConnection(conn);
      return;
    }
    conn.on('open', () => {
      const memberName = conn.metadata?.username || 'Player';
      lobbyLog(`Player connected: ${memberName}`);

      if (matchRosterLocked) {
        // We've already accepted a challenge and know the final roster size -
        // this is a redirected member joining the finished match, not a
        // regular pre-challenge party join.
        hostConnections.push(conn);
        checkIfMatchFull();
        return;
      }

      partyMembers.push({ username: memberName, conn });
      renderPartyMembers([localUsername, ...partyMembers.map((m) => m.username)]);
      document.getElementById('party-status-text').textContent =
        `${partyMembers.length + 1} in party - ready to challenge another party`;
    });

    conn.on('data', (data) => {
      if (data.type === 'leaveParty') {
        partyMembers = partyMembers.filter((m) => m.conn !== conn);
        renderPartyMembers([localUsername, ...partyMembers.map((m) => m.username)]);
      }
    });
  });
});

document.getElementById('join-party-btn').addEventListener('click', () => {
  document.getElementById('join-code-title').textContent = 'Enter Party Code';
  document.getElementById('join-code-input').dataset.mode = 'party';
  showScreen('join-code-screen');
});

document.getElementById('show-qr-btn').addEventListener('click', () => {
  if (currentRoomCode) {
    renderQRFor(currentRoomCode);
  } else {
    document.getElementById('qr-code-container').innerHTML = '<p>No active room yet - host a game or party first.</p>';
    document.getElementById('qr-code-text').textContent = '';
  }
  showScreen('qr-screen');
});

document.getElementById('qr-back-btn').addEventListener('click', () => {
  showScreen(isPartyLeader ? 'party-screen' : 'home-screen');
});

// ============================================================
// JOIN CODE SCREEN (shared by Join Game and Join Party)
// ============================================================
document.getElementById('join-code-back-btn').addEventListener('click', () => showScreen('home-screen'));

document.getElementById('join-code-submit-btn').addEventListener('click', () => {
  const code = document.getElementById('join-code-input').value.trim();
  const mode = document.getElementById('join-code-input').dataset.mode;
  if (!code) return;

  isHost = false;
  peer = new Peer();
  peer.on('open', () => {
    const conn = peer.connect(code, { metadata: { username: localUsername } });

    conn.on('open', () => {
      lobbyLog(`Connected to ${code}`);
      clientConnection = conn;

      if (mode === 'game') {
        // Direct 1v1 join - wait for the host to signal match start
      } else {
        // Joined as a party member
        isPartyLeader = false;
        document.getElementById('party-code-display').textContent = code;
        document.getElementById('party-status-text').textContent = 'Waiting for party leader...';
        document.getElementById('challenge-code-input').style.display = 'none';
        document.getElementById('party-challenge-btn').style.display = 'none';
        showScreen('party-screen');
      }
    });

    conn.on('data', (data) => {
      if (data.type === 'matchStart') {
        lobbyLog('Match starting!');
        startGame();
      } else if (data.type === 'partyRoster') {
        renderPartyMembers(data.usernames);
      } else if (data.type === 'redirect') {
        // Our party leader is telling us to reconnect to the final match host
        lobbyLog(`Redirecting to match host: ${data.hostId}`);
        conn.close();
        const newConn = peer.connect(data.hostId, { metadata: { username: localUsername } });
        newConn.on('open', () => {
          clientConnection = newConn;
        });
        newConn.on('data', (d2) => {
          if (d2.type === 'matchStart') startGame();
        });
      }
    });

    conn.on('error', (err) => lobbyLog('CONNECTION ERROR: ' + err));
  });
  peer.on('error', (err) => lobbyLog('PEER ERROR: ' + err.type));
});

// ============================================================
// PARTY SCREEN
// ============================================================
document.getElementById('party-leave-btn').addEventListener('click', () => {
  if (clientConnection) clientConnection.send({ type: 'leaveParty' });
  if (peer) peer.destroy();
  isHost = false;
  isPartyLeader = false;
  partyMembers = [];
  currentRoomCode = null;
  showScreen('home-screen');
});

document.getElementById('party-challenge-btn').addEventListener('click', () => {
  const opponentCode = document.getElementById('challenge-code-input').value.trim();
  if (!opponentCode) return;

  lobbyLog(`Challenging party: ${opponentCode}`);
  pendingChallengeConn = peer.connect(opponentCode, {
    metadata: { username: localUsername, isPartyChallenge: true, partySize: partyMembers.length + 1 },
  });

  pendingChallengeConn.on('open', () => {
    lobbyLog('Connected to opponent party leader - waiting for them to accept');
  });

  pendingChallengeConn.on('data', (data) => {
    if (data.type === 'challengeAccepted') {
      // The opponent leader (data.hostId) becomes the final match host.
      // Tell our own party members to redirect there, then redirect ourselves too.
      lobbyLog(`Challenge accepted - final host: ${data.hostId}`);
      partyMembers.forEach((m) => m.conn.send({ type: 'redirect', hostId: data.hostId }));

      const finalConn = peer.connect(data.hostId, { metadata: { username: localUsername } });
      finalConn.on('data', (d2) => {
        if (d2.type === 'matchStart') startGame();
      });
    } else if (data.type === 'challengeRejected') {
      lobbyLog('Challenge rejected - opponent party may be full or unavailable');
    }
  });

  pendingChallengeConn.on('error', (err) => lobbyLog('CHALLENGE ERROR: ' + err));
});

// This handles an INCOMING challenge from another party leader, when we're
// hosting our own party and someone else's leader connects to challenge us.
// We hook into the same 'connection' handler used for our own party members
// by checking the metadata flag - see create-party-btn handler above for the
// normal party-member path; this extends it for the challenge case.
function handleIncomingConnection(conn) {
  if (conn.metadata?.isPartyChallenge) {
    conn.on('open', () => {
      lobbyLog(`Incoming challenge from ${conn.metadata.username} (party of ${conn.metadata.partySize})`);
      // Accept automatically for now and become the final match host.
      // Total capacity = our party + their party.
      roomCapacity = (partyMembers.length + 1) + conn.metadata.partySize;
      matchRosterLocked = true;
      conn.send({ type: 'challengeAccepted', hostId: currentRoomCode });
      hostConnections = [...partyMembers.map((m) => m.conn), conn];
      checkIfMatchFull();
    });
  }
}

function checkIfMatchFull() {
  // +1 for the local party leader (us) who is also part of the match
  const connectedSoFar = hostConnections.length + 1;
  lobbyLog(`Match roster: ${connectedSoFar}/${roomCapacity}`);
  if (connectedSoFar >= roomCapacity) {
    lobbyLog('Full match assembled - starting');
    hostConnections.forEach((c) => c.send({ type: 'matchStart' }));
    startGame();
  }
}
