const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { calculateFraudScore } = require('../services/fraudDetection');
const { predictFairPrice, CATEGORY_BASELINES } = require('../services/pricingPrediction');
const { calculateRescuePrice } = require('../services/lastMinuteRescue');

const router = express.Router();

module.exports = function (db) {
  // ========== GET PRICING PREDICTION ==========
  router.post('/predict-price', optionalAuth, async (req, res) => {
    try {
      const { category, original_price, event_date } = req.body;

      if (!category || !original_price || !event_date) {
        return res.status(400).json({ error: 'Category, original price, and event date are required' });
      }

      const similarTickets = db
        .prepare("SELECT * FROM tickets WHERE category = ? AND status = 'available'")
        .all(category);

      const prediction = await predictFairPrice(
        { category, original_price, event_date },
        similarTickets
      );

      res.json(prediction);
    } catch (err) {
      console.error('Price prediction error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== GET FRAUD ANALYSIS FOR A TICKET ==========
  router.get('/fraud-check/:ticketId', authenticateToken, async (req, res) => {
    try {
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.ticketId);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(ticket.seller_id);
      const allTickets = db.prepare("SELECT * FROM tickets WHERE status = 'available'").all();

      const fraudResult = await calculateFraudScore(ticket, seller, allTickets);

      res.json({
        ticketId: ticket.id,
        ...fraudResult,
      });
    } catch (err) {
      console.error('Fraud check error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== GET LAST MINUTE RESCUE PRICE ==========
  router.get('/rescue/:ticketId', optionalAuth, async (req, res) => {
    try {
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.ticketId);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const rescueData = await calculateRescuePrice(ticket);
      res.json(rescueData);
    } catch (err) {
      console.error('Rescue price error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== GET CATEGORY BASELINES ==========
  router.get('/categories', (req, res) => {
    res.json({ categories: CATEGORY_BASELINES });
  });

  return router;
};
