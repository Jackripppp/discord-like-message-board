// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'messages.json');
const MAX_MESSAGES = 500;

// load messages from disk (if any)
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

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve static files in "public"
app.use(express.static(path.join(__dirname, 'public')));

// simple health route
app.get('/health', (req, res) => res.send('OK'));

// helper to trim messages
function capMessages() {
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(messages.length - MAX_MESSAGES);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  // On connection we expect client to request initial data
  // We'll send the current message list
  socket.on('requestInit', () => {
    socket.emit('initMessages', messages);
  });

  // New message received
  socket.on('sendMessage', (msg, ack) => {
    try {
      // msg should include: id, userId, name, text, time, attachments[]
      // Basic validation:
      if (!msg || !msg.id || !msg.userId) {
        return ack && ack({ ok: false, error: 'Invalid message payload' });
      }
      // enforce small limits (prevent huge payloads)
      if (typeof msg.text === 'string' && msg.text.length > 20000) msg.text = msg.text.slice(0, 20000);

      // attachments: keep but sanitize: only store name, type, data (dataURL)
      if (!Array.isArray(msg.attachments)) msg.attachments = [];

      msg.deleted = false; // deleted flag
      msg.edited = false;  // edited flag

      messages.push(msg);
      capMessages();
      persist();

      // broadcast to everyone
      io.emit('messageCreated', msg);
      ack && ack({ ok: true });
    } catch (err) {
      console.error('sendMessage error', err);
      ack && ack({ ok: false, error: 'server error' });
    }
  });

  // Edit a message
  socket.on('editMessage', (payload, ack) => {
    // payload: { messageId, userId, newText }
    try {
      const { messageId, userId, newText } = payload || {};
      const idx = messages.findIndex(m => m.id === messageId);
      if (idx === -1) return ack && ack({ ok: false, error: 'Message not found' });

      const msg = messages[idx];

      // permission check: only owner can edit
      if (msg.userId !== userId) return ack && ack({ ok: false, error: 'Not allowed' });

      // apply edit
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

  // Delete a message
  socket.on('deleteMessage', (payload, ack) => {
    // payload: { messageId, userId }
    try {
      const { messageId, userId } = payload || {};
      const idx = messages.findIndex(m => m.id === messageId);
      if (idx === -1) return ack && ack({ ok: false, error: 'Message not found' });

      const msg = messages[idx];

      // permission: only owner can delete
      if (msg.userId !== userId) return ack && ack({ ok: false, error: 'Not allowed' });

      // Instead of fully removing, mark deleted (so clients that already have it can show "deleted")
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

  // For debugging: expose messages count on disconnect
  socket.on('disconnect', () => {});
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
