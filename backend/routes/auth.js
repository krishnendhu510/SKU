const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET } = require('../middleware/auth');
const { encrypt } = require('../db/init');

const router = express.Router();
const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_ACTIVE_TOKENS_PER_USER = 5;

module.exports = function (db) {
  // ========== REGISTER ==========
  router.post('/register', (req, res) => {
    try {
      const { email, username, password } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username, and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if user already exists 
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existingUser) {
        return res.status(409).json({ error: 'Username already taken' });
      }

      // Encrypt email before storing
      const encryptedEmail = encrypt(email);

      // Check encrypted emails (need to check all since encryption is non-deterministic with random IV)
      const allUsers = db.prepare('SELECT email FROM users').all();
      // For email uniqueness, we'll store a hash for lookup
      const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
      const existingEmail = db.prepare('SELECT id FROM users WHERE email LIKE ?').get(`%${emailHash.slice(-16)}%`);

      // Hash password
      const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

      const userId = uuidv4();
      const emailStored = emailHash + ':' + encryptedEmail; // store hash prefix for lookups

      db.prepare(`
        INSERT INTO users (id, email, username, password_hash) 
        VALUES (?, ?, ?, ?)
      `).run(userId, emailStored, username, passwordHash);

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(db, userId, username);

      res.status(201).json({
        message: 'Registration successful',
        user: { id: userId, username },
        accessToken,
        refreshToken,
      });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }
      console.error('Register error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== LOGIN ==========
  router.post('/login', (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }

      const validPassword = bcrypt.compareSync(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Cleanup old tokens for this user before issuing new ones
      db.prepare(`
        DELETE FROM refresh_tokens 
        WHERE user_id = ? AND (revoked = 1 OR expires_at < datetime('now'))
      `).run(user.id);

      const { accessToken, refreshToken } = generateTokens(db, user.id, user.username);

      res.json({
        message: 'Login successful',
        user: { id: user.id, username: user.username },
        accessToken,
        refreshToken,
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== REFRESH TOKEN ==========
  router.post('/refresh', (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const storedToken = db.prepare(`
        SELECT * FROM refresh_tokens 
        WHERE token_hash = ? AND revoked = 0 AND expires_at > datetime('now')
      `).get(tokenHash);

      if (!storedToken) {
        return res.status(403).json({ error: 'Invalid or expired refresh token' });
      }

      // Verify the JWT portion is valid  
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, JWT_SECRET);
      } catch (err) {
        // Revoke the token if JWT verification fails
        db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(storedToken.id);
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      // Revoke old refresh token (rotation)
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(storedToken.id);

      // Issue new tokens
      const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(decoded.userId);
      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const tokens = generateTokens(db, user.id, user.username);

      // Cleanup expired/revoked tokens for this user
      db.prepare(`
        DELETE FROM refresh_tokens 
        WHERE user_id = ? AND (revoked = 1 OR expires_at < datetime('now'))
      `).run(user.id);

      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (err) {
      console.error('Refresh error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== LOGOUT ==========
  router.post('/logout', (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
      }

      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      console.error('Logout error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};

// ========== HELPER: Generate access + refresh tokens ==========
function generateTokens(db, userId, username) {
  const accessToken = jwt.sign(
    { userId, username },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId, username, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
  );

  // Store hashed refresh token in DB
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const tokenId = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) 
    VALUES (?, ?, ?, ?)
  `).run(tokenId, userId, tokenHash, expiresAt);

  // ========== TOKEN LIMITING ==========
  // Enforce max active tokens per user to prevent wastage
  const activeTokenCount = db.prepare(`
    SELECT COUNT(*) as count FROM refresh_tokens 
    WHERE user_id = ? AND revoked = 0 AND expires_at > datetime('now')
  `).get(userId).count;

  if (activeTokenCount > MAX_ACTIVE_TOKENS_PER_USER) {
    // Revoke oldest tokens beyond the limit
    const tokensToRevoke = activeTokenCount - MAX_ACTIVE_TOKENS_PER_USER;
    const oldestTokens = db.prepare(`
      SELECT id FROM refresh_tokens 
      WHERE user_id = ? AND revoked = 0 AND expires_at > datetime('now')
      ORDER BY created_at ASC
      LIMIT ?
    `).all(userId, tokensToRevoke);

    const revokeStmt = db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?');
    for (const t of oldestTokens) {
      revokeStmt.run(t.id);
    }
    console.log(`🔒 Revoked ${tokensToRevoke} oldest token(s) for user ${username} (limit: ${MAX_ACTIVE_TOKENS_PER_USER})`);
  }

  return { accessToken, refreshToken };
}
