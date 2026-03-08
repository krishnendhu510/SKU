const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { calculateFraudScore } = require('../services/fraudDetection');
const { predictFairPrice } = require('../services/pricingPrediction');
const { calculateRescuePrice } = require('../services/lastMinuteRescue');

const router = express.Router();

module.exports = function (db) {
  // ========== GET ALL TICKETS (with search & filter) ==========
  router.get('/', optionalAuth, async (req, res) => {
    try {
      const { q, category, minPrice, maxPrice, date, status, sort } = req.query;

      let query = 'SELECT t.*, u.username as seller_name FROM tickets t JOIN users u ON t.seller_id = u.id WHERE t.status = ?';
      let params = [status || 'available'];

      // Full-text search on event name, venue, description
      if (q) {
        query += ' AND (t.event_name LIKE ? OR t.venue LIKE ? OR t.description LIKE ?)';
        const searchTerm = `%${q}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Category filter
      if (category && category !== 'all') {
        query += ' AND t.category = ?';
        params.push(category);
      }

      // Price range filter
      if (minPrice) {
        query += ' AND t.listing_price >= ?';
        params.push(parseFloat(minPrice));
      }
      if (maxPrice) {
        query += ' AND t.listing_price <= ?';
        params.push(parseFloat(maxPrice));
      }

      // Date filter
      if (date) {
        query += ' AND DATE(t.event_date) = DATE(?)';
        params.push(date);
      }

      // Sorting
      switch (sort) {
        case 'price_asc':
          query += ' ORDER BY t.listing_price ASC';
          break;
        case 'price_desc':
          query += ' ORDER BY t.listing_price DESC';
          break;
        case 'date_asc':
          query += ' ORDER BY t.event_date ASC';
          break;
        case 'date_desc':
          query += ' ORDER BY t.event_date DESC';
          break;
        default:
          query += ' ORDER BY t.created_at DESC';
      }

      const tickets = db.prepare(query).all(...params);

      // Add rescue price info for near-event tickets
      const enrichedTickets = await Promise.all(tickets.map(async (ticket) => {
        const rescue = await calculateRescuePrice(ticket);
        return {
          ...ticket,
          lastMinuteRescue: rescue.isEligible ? rescue : null,
        };
      }));

      res.json({ tickets: enrichedTickets, total: enrichedTickets.length });
    } catch (err) {
      console.error('Get tickets error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== GET AI RECOMMENDED TICKETS ==========
  router.get('/recommended', optionalAuth, async (req, res) => {
    try {
      // Get all available tickets
      const allTickets = db
        .prepare(
          `SELECT t.*, u.username as seller_name 
           FROM tickets t JOIN users u ON t.seller_id = u.id 
           WHERE t.status = 'available' AND t.event_date > datetime('now')
           ORDER BY t.created_at DESC`
        )
        .all();

      // Best Value: tickets priced significantly below fair price
      const bestValue = allTickets
        .filter((t) => t.predicted_fair_price > 0 && t.listing_price < t.predicted_fair_price * 0.85)
        .sort((a, b) => {
          const aRatio = a.listing_price / a.predicted_fair_price;
          const bRatio = b.listing_price / b.predicted_fair_price;
          return aRatio - bRatio;
        })
        .slice(0, 4);

      // Trending: most recent listings with low fraud risk
      const trending = allTickets
        .filter((t) => t.fraud_risk_score < 40)
        .slice(0, 4);

      // Last Minute Deals: events within 48 hours
      const lastMinuteCandidates = allTickets
        .filter((t) => {
          const hours = (new Date(t.event_date) - new Date()) / (1000 * 60 * 60);
          return hours > 0 && hours <= 48;
        })
        .slice(0, 4);

      const lastMinute = await Promise.all(lastMinuteCandidates.map(async (t) => ({
        ...t,
        lastMinuteRescue: await calculateRescuePrice(t),
      })));

      res.json({
        bestValue,
        trending,
        lastMinute,
      });
    } catch (err) {
      console.error('Recommended error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== GET SINGLE TICKET ==========
  router.get('/:id', optionalAuth, async (req, res) => {
    try {
      const ticket = db
        .prepare(
          `SELECT t.*, u.username as seller_name 
           FROM tickets t JOIN users u ON t.seller_id = u.id 
           WHERE t.id = ?`
        )
        .get(req.params.id);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Get similar tickets for pricing context
      const similarTickets = db
        .prepare(
          `SELECT * FROM tickets 
           WHERE category = ? AND status = 'available' AND id != ?`
        )
        .all(ticket.category, ticket.id);

      // Enrich with AI data
      const pricingData = await predictFairPrice(ticket, similarTickets);
      const rescueData = await calculateRescuePrice(ticket);

      res.json({
        ticket,
        aiInsights: {
          pricing: pricingData,
          lastMinuteRescue: rescueData.isEligible ? rescueData : null,
          fraudRisk: ticket.fraud_risk_score >= 70 ? 'high' : ticket.fraud_risk_score >= 40 ? 'medium' : 'low',
        },
      });
    } catch (err) {
      console.error('Get ticket error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== CREATE TICKET (auth required) ==========
  router.post('/', authenticateToken, async (req, res) => {
    try {
      const { event_name, event_date, venue, category, original_price, listing_price, description, upi_id } = req.body;

      if (!event_name || !event_date || !venue || !original_price || !listing_price) {
        return res.status(400).json({
          error: 'Event name, date, venue, original price, and listing price are required',
        });
      }

      const ticketId = uuidv4();
      const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);

      // Get similar tickets for AI analysis
      const allTickets = db.prepare('SELECT * FROM tickets WHERE status = \'available\'').all();
      const similarTickets = allTickets.filter((t) => t.category === (category || 'general'));

      // Run AI: pricing prediction
      const pricing = await predictFairPrice(
        { category: category || 'general', original_price, event_date },
        similarTickets
      );

      // Create ticket data for fraud scoring
      const ticketData = {
        id: ticketId,
        seller_id: req.user.userId,
        category: category || 'general',
        listing_price,
        original_price,
        created_at: new Date().toISOString(),
      };

      // Run AI: fraud detection
      const fraud = await calculateFraudScore(ticketData, seller, allTickets);

      const status = fraud.isFlagged ? 'flagged' : 'available';

      db.prepare(`
        INSERT INTO tickets (id, seller_id, event_name, event_date, venue, category, original_price, listing_price, predicted_fair_price, fraud_risk_score, status, description, seller_upi_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticketId,
        req.user.userId,
        event_name,
        event_date,
        venue,
        category || 'general',
        original_price,
        listing_price,
        pricing.predictedFairPrice,
        fraud.totalScore,
        status,
        description || '',
        upi_id || null
      );

      // Update seller's total sales count
      db.prepare('UPDATE users SET total_sales = total_sales + 1 WHERE id = ?').run(req.user.userId);

      // Update seller's fraud score (running average)
      db.prepare(
        'UPDATE users SET fraud_score = (fraud_score * (total_sales - 1) + ?) / total_sales WHERE id = ?'
      ).run(fraud.totalScore, req.user.userId);

      res.status(201).json({
        message: status === 'flagged' ? 'Ticket created but flagged for review' : 'Ticket listed successfully',
        ticket: {
          id: ticketId,
          event_name,
          event_date,
          venue,
          category: category || 'general',
          original_price,
          listing_price,
          seller_upi_id: upi_id || null,
          status,
        },
        aiAnalysis: {
          predictedFairPrice: pricing.predictedFairPrice,
          priceConfidence: pricing.priceConfidence,
          fraudScore: fraud.totalScore,
          fraudBreakdown: fraud.breakdown,
          riskLevel: fraud.riskLevel,
        },
      });
    } catch (err) {
      console.error('Create ticket error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== UPDATE TICKET (auth required, owner only) ==========
  router.put('/:id', authenticateToken, (req, res) => {
    try {
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      if (ticket.seller_id !== req.user.userId) {
        return res.status(403).json({ error: 'You can only edit your own tickets' });
      }

      const { event_name, event_date, venue, category, listing_price, description } = req.body;

      db.prepare(`
        UPDATE tickets SET
          event_name = COALESCE(?, event_name),
          event_date = COALESCE(?, event_date),
          venue = COALESCE(?, venue),
          category = COALESCE(?, category),
          listing_price = COALESCE(?, listing_price),
          description = COALESCE(?, description),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        event_name || null,
        event_date || null,
        venue || null,
        category || null,
        listing_price || null,
        description || null,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
      res.json({ message: 'Ticket updated', ticket: updated });
    } catch (err) {
      console.error('Update ticket error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== DELETE TICKET (auth required, owner only) ==========
  router.delete('/:id', authenticateToken, (req, res) => {
    try {
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      if (ticket.seller_id !== req.user.userId) {
        return res.status(403).json({ error: 'You can only delete your own tickets' });
      }

      db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);

      res.json({ message: 'Ticket deleted' });
    } catch (err) {
      console.error('Delete ticket error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
