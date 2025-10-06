const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'messages.json');
const MAX_MESSAGES = 500;

// Load messages
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

// Create HTTP server **after** app
const server = http.createServer(app);

// Socket.IO server
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Helper to cap messages
function capMessages() {
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(messages.length - MAX_MESSAGES);
  }
}

// Socket.IO logic...
io.on('connection', (socket) => {
  // Same code as before for requestInit, sendMessage, editMessage, deleteMessage
  // ...
});

// **Start server at the end**
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
