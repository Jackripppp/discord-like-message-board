// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'messages.json');
const MAX_MESSAGES = 500;

// Load messages from disk
let messages = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    messages = JSON.parse(raw) || [];
  }
} catch (err) {
  console.warn('Could not read messages.json:', err);
  messages = [];
}

function persist() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to persist messages:', e);
  }
}

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files in "public"
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Helper to trim messages
function capMessages() {
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(messages.length - MAX_MESSAGES);
  }
}

// Socket.IO connection
io.on('connection', (socket) => {
  socket.on('requestInit', () => {
    socket.emit('initMessages', messages);
  });

  socket.on('sendMessage', (msg, ack) => {
    try {
      if (!msg || !msg.id || !msg.userId) return ack && ack({ ok: false, error: 'Invalid message payload' });

      if (typeof msg.text === 'string' && msg.text.length > 20000) msg.text = msg.text.slice(0, 20000);
      if (!Array.isArray(msg.attachments)) msg.attachments = [];

      msg.deleted = false;
      msg.edited = false;

      messages.push(msg);
      capMessages();
      persist();

      io.emit('messageCreated', msg);
      ack && ack({ ok: true });
    } catch (err) {
      console.error('sendMessage error', err);
      ack && ack({ ok: false, error: 'server error' });
    }
  });

  socket.on('editMessage', (payload, ack) => {
    try {
      const { messageId, userId, newText } = payload || {};
      const idx = messages.findIndex(m => m.id === messageId);
      if (idx === -1) return ack && ack({ ok: false, error: 'Message not found' });

      const msg = messages[idx];
      if (msg.userId !== userId) return ack && ack({ ok: false, error: 'Not allowed' });

      msg.text = typeof newText === 'string' ? newText : msg.text;
      msg.edited = true;
      msg.editTime = new Date().toISOString();

      messages[idx] = msg;
      persist();

      io.emit('messageEdited', msg);
      ack && ack({ ok: true, msg });
    } catch (err) {
      console.error('editMessage err', err);
      ack && ack({ ok: false, error: 'server error' });
    }
  });

  socket.on('deleteMessage', (payload, ack) => {
    try {
      const { messageId, userId } = payload || {};
      const idx = messages.findIndex(m => m.id === messageId);
      if (idx === -1) return ack && ack({ ok: false, error: 'Message not found' });

      const msg = messages[idx];
      if (msg.userId !== userId) return ack && ack({ ok: false, error: 'Not allowed' });

      msg.deleted = true;
      msg.deleteTime = new Date().toISOString();

      messages[idx] = msg;
      persist();

      io.emit('messageDeleted', { id: messageId, deleteTime: msg.deleteTime });
      ack && ack({ ok: true });
    } catch (err) {
      console.error('deleteMessage err', err);
      ack && ack({ ok: false, error: 'server error' });
    }
  });

  socket.on('disconnect', () => {});
});

// START SERVER AT THE END
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
