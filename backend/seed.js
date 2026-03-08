/**
 * Seed Script — Populates the database with relatable Indian events
 * Run: node seed.js
 */
const { initializeDatabase } = require('./db/init');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { calculateFraudScore } = require('./services/fraudDetection');
const { predictFairPrice } = require('./services/pricingPrediction');

const db = initializeDatabase();

// Create demo seller accounts
const sellers = [
  { id: uuidv4(), email: 'demo1@sku.in', username: 'rahul_kochi', password: 'demo123' },
  { id: uuidv4(), email: 'demo2@sku.in', username: 'priya_clt', password: 'demo123' },
  { id: uuidv4(), email: 'demo3@sku.in', username: 'arjun_tvm', password: 'demo123' },
];

for (const s of sellers) {
  const hash = bcrypt.hashSync(s.password, 10);
  try {
    db.prepare('INSERT INTO users (id, email, username, password_hash, total_sales) VALUES (?, ?, ?, ?, ?)').run(
      s.id, s.email, s.username, hash, 3
    );
  } catch (e) {
    // Already exists
  }
}

console.log('✅ Created demo sellers: rahul_kochi, priya_clt, arjun_tvm (password: demo123)');

// Indian events
const events = [
  {
    event_name: 'Janashatabdi Express — CLT to Kochi',
    event_date: '2026-03-15T06:30:00',
    venue: 'Calicut Railway Station → Ernakulam Jn',
    category: 'travel',
    original_price: 485,
    listing_price: 450,
    description: 'CC chair car ticket. Confirmed seat, coach C2, seat 34. PNR verified. Cannot travel due to change of plans.',
    seller_idx: 1,
  },
  {
    event_name: 'Haksus Hackathon 2026',
    event_date: '2026-04-10T09:00:00',
    venue: 'NIT Calicut, Kozhikode',
    category: 'hackathon',
    original_price: 500,
    listing_price: 400,
    description: 'Team registration pass for 3 members. Includes food, swag kit and accommodation. Selling at a discount because one teammate dropped out.',
    seller_idx: 0,
  },
  {
    event_name: 'AR Rahman Live — Jai Ho Tour',
    event_date: '2026-04-25T18:00:00',
    venue: 'Jawaharlal Nehru Stadium, Kochi',
    category: 'concert',
    original_price: 3500,
    listing_price: 3200,
    description: 'Gold category tickets (2 nos). Front section with clear stage view. AR Rahman performing his greatest hits live!',
    seller_idx: 2,
  },
  {
    event_name: 'Premam — Special Re-release Screening',
    event_date: '2026-03-20T19:30:00',
    venue: 'Aries Plex SL Cinemas, Trivandrum',
    category: 'movies',
    original_price: 200,
    listing_price: 180,
    description: 'Balcony seats for the special FDFS re-release of Premam. Dolby Atmos screen. Get ready for the Nivin nostalgia!',
    seller_idx: 0,
  },
  {
    event_name: 'Kerala Blasters vs Mohun Bagan — ISL Semifinal',
    event_date: '2026-04-05T19:00:00',
    venue: 'Jawaharlal Nehru Stadium, Kochi',
    category: 'sports',
    original_price: 800,
    listing_price: 1200,
    description: 'East stand upper gallery. Yellow Army section! ISL semifinal — expect a packed house.',
    seller_idx: 2,
  },
  {
    event_name: 'Standup Comedy ft. Basil & Aji',
    event_date: '2026-03-28T20:00:00',
    venue: 'Kochi Comedy Club, Marine Drive',
    category: 'comedy',
    original_price: 600,
    listing_price: 550,
    description: 'First row seats for Basil and Aji\'s new special. Guaranteed ab workout from laughing.',
    seller_idx: 1,
  },
  {
    event_name: 'TEDx NITC 2026 — Reimagine',
    event_date: '2026-05-15T10:00:00',
    venue: 'NITC Auditorium, Calicut',
    category: 'conference',
    original_price: 1000,
    listing_price: 850,
    description: 'Full-day pass with lunch and networking. Features speakers from ISRO, Infosys and independent creators.',
    seller_idx: 0,
  },
  {
    event_name: 'Rajdhani Express — EKM to New Delhi',
    event_date: '2026-03-10T11:15:00',
    venue: 'Ernakulam Jn → New Delhi Railway Station',
    category: 'travel',
    original_price: 2800,
    listing_price: 2500,
    description: '3A berth confirmed ticket. Includes meals. Trip cancelled, selling at discount.',
    seller_idx: 1,
  },
];

const allTickets = [];

for (const ev of events) {
  const seller = sellers[ev.seller_idx];
  const ticketId = uuidv4();

  const pricing = predictFairPrice(
    { category: ev.category, original_price: ev.original_price, event_date: ev.event_date },
    allTickets.filter((t) => t.category === ev.category)
  );

  const ticketData = {
    id: ticketId,
    seller_id: seller.id,
    category: ev.category,
    listing_price: ev.listing_price,
    original_price: ev.original_price,
    created_at: new Date().toISOString(),
  };

  const fraud = calculateFraudScore(ticketData, { ...seller, created_at: '2025-01-01', total_sales: 3, fraud_score: 10 }, allTickets);
  const status = fraud.isFlagged ? 'flagged' : 'available';

  db.prepare(`
    INSERT INTO tickets (id, seller_id, event_name, event_date, venue, category, original_price, listing_price, predicted_fair_price, fraud_risk_score, status, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ticketId, seller.id, ev.event_name, ev.event_date, ev.venue, ev.category, ev.original_price, ev.listing_price, pricing.predictedFairPrice, fraud.totalScore, status, ev.description);

  allTickets.push({ ...ticketData, status });
  console.log(`  📌 ${ev.event_name} — ₹${ev.listing_price} [${status}] (fraud: ${fraud.totalScore})`);
}

console.log(`\n✅ Seeded ${events.length} events successfully!\n`);
console.log('Demo login: username=rahul_kochi password=demo123');
console.log('            username=priya_clt   password=demo123');
console.log('            username=arjun_tvm   password=demo123');

db.close();
