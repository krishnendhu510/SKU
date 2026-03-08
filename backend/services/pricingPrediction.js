/**
 * Pricing Prediction Service
 * Predicts fair market price using category baselines, time decay, and demand factors.
 */

// Category baseline prices in ₹ (average ticket prices by category)
const CATEGORY_BASELINES = {
  concert: 2500,
  sports: 800,
  theater: 500,
  comedy: 600,
  festival: 3000,
  conference: 1000,
  movies: 200,
  travel: 500,
  hackathon: 400,
  general: 500,
};

/**
 * Predict fair market price for a ticket via python API
 */
async function predictFairPrice(ticket, similarTickets = []) {
  const categoryBase = CATEGORY_BASELINES[ticket.category] || CATEGORY_BASELINES.general;
  const originalPrice = ticket.original_price || categoryBase;
  const listedPrice = ticket.listing_price || originalPrice;
  
  // Calculate a mock "days before event" or "event popularity" based on similarTickets if we wanted to
  // For now, let's just properly map the inputs the python API expects.
  
  const now = new Date();
  const event = new Date(ticket.event_date);
  const daysUntil = Math.max(0, (event - now) / (1000 * 60 * 60 * 24));
  
  // The python API expects: event_popularity, days_before_event, seat_location, original_price, listed_price
  const payload = {
    event_popularity: 1.0, // Fixed default for now
    days_before_event: daysUntil,
    seat_location: 1.0, // Fixed default
    original_price: originalPrice,
    listed_price: listedPrice
  };

  try {
    const response = await fetch('http://127.0.0.1:8001/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const aiData = await response.json();

    // Map the python API response (predicted_fair_price, listed_price, difference_percent, status, emoji)
    // to the format the frontend currently expects, or close to it.
    
    return {
      predictedFairPrice: aiData.predicted_fair_price,
      priceConfidence: 0.8, // Fixed confidence as python API doesn't return one
      statusLabel: aiData.status, // Fair Price, Overpriced, Great Deal
      emoji: aiData.emoji,
      priceRange: {
        low: Math.round(aiData.predicted_fair_price * 0.85),
        high: Math.round(aiData.predicted_fair_price * 1.15)
      }
    };
  } catch (error) {
    console.error('Error calling Python ticket.ai API:', error);
    
    // Fallback to a dumb heuristic if API fails
    return {
      predictedFairPrice: originalPrice,
      priceConfidence: 0.1,
      statusLabel: "Unknown",
      emoji: "❓",
      priceRange: {
        low: Math.round(originalPrice * 0.85),
        high: Math.round(originalPrice * 1.15)
      }
    };
  }
}

/**
 * Time Factor: adjusts price based on days until event
 * - Events far away: slight discount (less urgency)
 * - Events 1-2 weeks out: premium (peak demand)
 * - Events very close: discount (last-minute)
 */
function calculateTimeFactor(eventDate) {
  const now = new Date();
  const event = new Date(eventDate);
  const daysUntil = (event - now) / (1000 * 60 * 60 * 24);

  if (daysUntil < 0) return 0.2; // Past event
  if (daysUntil < 1) return 0.5; // Day of event
  if (daysUntil < 3) return 0.7; // Last minute
  if (daysUntil < 7) return 0.9; // This week
  if (daysUntil < 14) return 1.15; // Sweet spot - peak demand
  if (daysUntil < 30) return 1.1; // Coming soon
  if (daysUntil < 60) return 1.0; // Normal
  if (daysUntil < 90) return 0.95; // Mildly early
  return 0.9; // Very far out
}

/**
 * Demand Factor: supply/demand proxy based on number of similar listings
 * More listings = more supply = lower price
 */
function calculateDemandFactor(similarTickets) {
  const count = similarTickets.length;

  if (count === 0) return 1.2; // No competition, higher value
  if (count <= 2) return 1.1;
  if (count <= 5) return 1.0;
  if (count <= 10) return 0.9;
  if (count <= 20) return 0.8;
  return 0.7; // Lots of supply, lower value
}

module.exports = { predictFairPrice, CATEGORY_BASELINES };
