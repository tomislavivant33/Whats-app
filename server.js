const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

// Zadnjih N poruka drži se u memoriji da ih novi igrač vidi kad se spoji
const HISTORY_LIMIT = 100;
const history = [];

let nextId = 1;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function broadcastUserList() {
  const users = [];
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.username) {
      users.push({ id: client.id, name: client.username, color: client.color });
    }
  });
  broadcast({ type: 'users', users });
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

wss.on('connection', (ws) => {
  ws.id = 'u' + (nextId++);
  ws.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  ws.username = null;

  ws.send(JSON.stringify({ type: 'history', messages: history }));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (msg.type === 'join') {
      const name = (msg.name || '').toString().trim().slice(0, 30);
      ws.username = name || 'Gost';
      broadcastUserList();
      broadcast({
        type: 'system',
        text: `${ws.username} se pridružio/la chatu`,
        ts: Date.now(),
      });
      return;
    }

    if (msg.type === 'chat') {
      if (!ws.username) return;
      const text = (msg.text || '').toString().trim().slice(0, 2000);
      if (!text) return;

      const chatMsg = {
        type: 'chat',
        id: ws.id,
        name: ws.username,
        color: ws.color,
        text,
        ts: Date.now(),
      };

      history.push(chatMsg);
      if (history.length > HISTORY_LIMIT) history.shift();

      broadcast(chatMsg);
    }
  });

  ws.on('close', () => {
    if (ws.username) {
      broadcastUserList();
      broadcast({
        type: 'system',
        text: `${ws.username} je napustio/la chat`,
        ts: Date.now(),
      });
    }
  });
});

console.log(`Chat WebSocket server pokrenut na portu ${PORT}`);
