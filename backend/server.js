const express = require('express');
const { initializeDatabase } = require('./db/init');
const { helmetMiddleware, globalLimiter, authLimiter, aiLimiter, corsOptions } = require('./middleware/security');
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const db = initializeDatabase();

// ========== SECURITY MIDDLEWARE ==========
app.use(corsOptions);
app.use(helmetMiddleware);
app.use(globalLimiter);
app.use(express.json({ limit: '10kb' })); // Limit body size for security

// ========== ROUTES ==========
app.use('/api/auth', authLimiter, authRoutes(db));
app.use('/api/tickets', ticketRoutes(db));
app.use('/api/ai', aiLimiter, aiRoutes(db));

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== PERIODIC TOKEN CLEANUP ==========
// Clean expired/revoked tokens every 30 minutes to prevent waste
setInterval(() => {
  try {
    const result = db.prepare(`
      DELETE FROM refresh_tokens 
      WHERE revoked = 1 OR expires_at < datetime('now')
    `).run();
    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} expired/revoked tokens`);
    }
  } catch (err) {
    console.error('Token cleanup error:', err);
  }
}, 30 * 60 * 1000);

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   🎫 Sadhanam Kayyil Undo? — Backend Server     ║
  ║   Running on http://localhost:${PORT}              ║
  ║   Database: SQLite (WAL mode, encrypted)         ║
  ║   Security: Helmet + Rate Limiting + CORS        ║
  ╚══════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nShutting down gracefully...');
  db.close();
  process.exit(0);
});

module.exports = app;
