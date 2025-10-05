const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));

let messages = []; // In-memory storage

// File upload endpoint
app.post('/upload', upload.array('files'), (req, res) => {
  if (!req.files) return res.json({ ok: false });
  const files = req.files.map(f => ({
    name: f.originalname,
    type: f.mimetype,
    url: `/uploads/${f.filename}`
  }));
  res.json({ ok: true, files });
});

// Socket.IO events
io.on('connection', socket => {
  // Send existing messages to new client
  socket.on('requestInit', () => {
    socket.emit('initMessages', messages);
  });

  // New message
  socket.on('sendMessage', (msg, cb) => {
    messages.push(msg);
    io.emit('messageCreated', msg);
    cb({ ok: true });
  });

  // Edit message
  socket.on('editMessage', ({ messageId, userId, newText }, cb) => {
    const msg = messages.find(m => m.id === messageId && m.userId === userId);
    if (!msg) return cb({ ok: false, error: 'Message not found or not yours' });
    msg.text = newText;
    msg.edited = true;
    io.emit('messageEdited', msg);
    cb({ ok: true });
  });

  // Delete message
  socket.on('deleteMessage', ({ messageId, userId }, cb) => {
    const index = messages.findIndex(m => m.id === messageId && m.userId === userId);
    if (index === -1) return cb({ ok: false, error: 'Message not found or not yours' });
    const [deleted] = messages.splice(index, 1);
    io.emit('messageDeleted', { id: deleted.id });
    cb({ ok: true });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`
));
