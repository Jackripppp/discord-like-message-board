const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
<<<<<<< HEAD
const sqlite3 = require('sqlite3').verbose();
=======
>>>>>>> 712ac6404d8931928abd421469d501e6f49f8cd7

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

<<<<<<< HEAD
// Multer setup for file uploads
=======
>>>>>>> 712ac6404d8931928abd421469d501e6f49f8cd7
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
<<<<<<< HEAD

app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));
app.get('/health', (req, res) => res.send('OK'));

// --- SQLite setup ---
const db = new sqlite3.Database(path.join(__dirname, 'messages.db'), (err) => {
  if (err) console.error(err);
  else console.log('Connected to SQLite database');
});

// Create messages table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT,
    text TEXT,
    time TEXT,
    attachments TEXT,
    replyTo TEXT,
    deleted INTEGER DEFAULT 0,
    edited INTEGER DEFAULT 0,
    editTime TEXT,
    deleteTime TEXT
  )
`);

// --- File upload endpoint ---
=======

app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/health', (req, res) => {
  res.send('OK');
});

let messages = []; // In-memory storage

// File upload endpoint
>>>>>>> 712ac6404d8931928abd421469d501e6f49f8cd7
app.post('/upload', upload.array('files'), (req, res) => {
  if (!req.files) return res.json({ ok: false });
  const files = req.files.map(f => ({
    name: f.originalname,
    type: f.mimetype,
    url: `/uploads/${f.filename}`
  }));
  res.json({ ok: true, files });
});

<<<<<<< HEAD
// --- Socket.IO events ---
io.on('connection', socket => {

  // Send last 500 non-deleted messages to new client
=======
// Socket.IO events
io.on('connection', socket => {
  // Send existing messages to new client
>>>>>>> 712ac6404d8931928abd421469d501e6f49f8cd7
  socket.on('requestInit', () => {
    db.all('SELECT * FROM messages WHERE deleted = 0 ORDER BY time ASC LIMIT 500', (err, rows) => {
      if (err) return console.error(err);
      const messages = rows.map(r => ({
        ...r,
        attachments: r.attachments ? JSON.parse(r.attachments) : [],
        replyTo: r.replyTo ? JSON.parse(r.replyTo) : null,
        deleted: !!r.deleted,
        edited: !!r.edited
      }));
      socket.emit('initMessages', messages);
    });
  });

  // New message
  socket.on('sendMessage', (msg, cb) => {
<<<<<<< HEAD
    const stmt = db.prepare(`
      INSERT INTO messages (id, userId, name, text, time, attachments, replyTo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      msg.id,
      msg.userId,
      msg.name,
      msg.text,
      msg.time,
      JSON.stringify(msg.attachments || []),
      msg.replyTo ? JSON.stringify(msg.replyTo) : null,
      (err) => {
        if (err) return cb({ ok: false });
        io.emit('messageCreated', msg);
        cb({ ok: true });

        // Enforce 500-message cap (delete oldest messages)
        db.get('SELECT COUNT(*) as count FROM messages WHERE deleted = 0', (err, row) => {
          if (err) return console.error(err);
          const excess = row.count - 500;
          if (excess > 0) {
            db.run(`
              DELETE FROM messages WHERE id IN (
                SELECT id FROM messages WHERE deleted = 0 ORDER BY time ASC LIMIT ?
              )
            `, [excess], (err) => {
              if (err) console.error(err);
            });
          }
        });
      }
    );
  });

  // Edit message
  socket.on('editMessage', ({ id, text, userId }, cb) => {
    db.run(`
      UPDATE messages
      SET text = ?, edited = 1, editTime = ?
      WHERE id = ? AND userId = ?
    `, [text, new Date().toISOString(), id, userId], function(err) {
      if (err || this.changes === 0) return cb({ ok: false, error: 'Message not found or not yours' });
      db.get('SELECT * FROM messages WHERE id = ?', [id], (err, row) => {
        if (err) return console.error(err);
        const msg = {
          ...row,
          attachments: row.attachments ? JSON.parse(row.attachments) : [],
          replyTo: row.replyTo ? JSON.parse(row.replyTo) : null,
          deleted: !!row.deleted,
          edited: !!row.edited
        };
        io.emit('messageEdited', msg);
        cb({ ok: true });
      });
    });
  });

  // Delete message
  socket.on('deleteMessage', ({ id, userId }, cb) => {
    db.run(`
      UPDATE messages
      SET deleted = 1, deleteTime = ?
      WHERE id = ? AND userId = ?
    `, [new Date().toISOString(), id, userId], function(err) {
      if (err || this.changes === 0) return cb({ ok: false, error: 'Message not found or not yours' });
      io.emit('messageDeleted', { id });
      cb({ ok: true });
    });
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
=======
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
>>>>>>> 712ac6404d8931928abd421469d501e6f49f8cd7
