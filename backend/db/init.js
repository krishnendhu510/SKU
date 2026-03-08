const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'database.sqlite');

// Encryption key derived from a secret (in production, use env variable)
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.DB_SECRET || 'sadhanam-kayyil-undo-secret-key-2026',
  'salt-for-sku-app',
  32
);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return text;
  const parts = text.split(':');
  if (parts.length < 2) return text;
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts.slice(1).join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function initializeDatabase() {
  const db = new Database(DB_PATH);

  // Security: enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  // Security: enforce foreign key constraints
  db.pragma('foreign_keys = ON');
  // Security: zero-fill deleted data to prevent data leaks
  db.pragma('secure_delete = ON');
  // Security: disable untrusted schema extensions
  db.pragma('trusted_schema = OFF');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      upi_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_sales INTEGER DEFAULT 0,
      fraud_score REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Create tickets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_date DATETIME NOT NULL,
      venue TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      original_price REAL NOT NULL,
      listing_price REAL NOT NULL,
      predicted_fair_price REAL DEFAULT 0,
      fraud_risk_score REAL DEFAULT 0,
      status TEXT DEFAULT 'available' CHECK(status IN ('available', 'sold', 'flagged', 'removed')),
      description TEXT,
      seller_upi_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create refresh_tokens table for secure token management
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
    CREATE INDEX IF NOT EXISTS idx_tickets_event_date ON tickets(event_date);
    CREATE INDEX IF NOT EXISTS idx_tickets_seller ON tickets(seller_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
  `);

  // Cleanup function: remove expired/revoked tokens to prevent waste
  const cleanupTokens = db.prepare(`
    DELETE FROM refresh_tokens 
    WHERE revoked = 1 OR expires_at < datetime('now')
  `);

  // Run cleanup on init
  cleanupTokens.run();

  console.log('✅ Database initialized successfully');
  return db;
}

module.exports = { initializeDatabase, encrypt, decrypt };
