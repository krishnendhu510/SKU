/**
 * Last Minute Rescue Service
 * Calls the quicktick1 AI API for rescue price predictions.
 * Falls back to local exponential-decay formula if the API is unavailable.
 * Activates for events within 48 hours.
 */

/**
 * Map category to genre string expected by quicktick1 API
 */
function mapCategoryToGenre(category) {
  const mapping = {
    concert: 'Concert',
    sports: 'Sports',
    theater: 'Theater',
    comedy: 'Comedy',
    festival: 'Festival',
    conference: 'Conference',
    movies: 'Movies',
    travel: 'Travel',
    hackathon: 'Hackathon',
    general: 'Concert', // default fallback
  };
  return mapping[category] || 'Concert';
}

/**
 * Map category to popularity estimate
 */
function estimatePopularity(category) {
  const highPop = ['concert', 'sports', 'festival'];
  const medPop = ['theater', 'comedy', 'movies'];
  if (highPop.includes(category)) return 'high';
  if (medPop.includes(category)) return 'medium';
  return 'low';
}

/**
 * Calculate rescue pricing for a ticket close to its event date.
 * Calls quicktick1 Flask API (port 5000) first, falls back to local formula.
 */
async function calculateRescuePrice(ticket) {
  const now = new Date();
  const eventDate = new Date(ticket.event_date);
  const hoursRemaining = (eventDate - now) / (1000 * 60 * 60);

  // Only activate for events within 48 hours
  if (hoursRemaining > 48) {
    return {
      isEligible: false,
      message: 'Event is more than 48 hours away. Last Minute Rescue not applicable.',
      hoursRemaining: Math.round(hoursRemaining),
    };
  }

  // Past events
  if (hoursRemaining < 0) {
    return {
      isEligible: false,
      message: 'Event has already passed.',
      hoursRemaining: 0,
    };
  }

  const originalPrice = ticket.original_price;
  const listingPrice = ticket.listing_price;

  // ── Try quicktick1 AI API first ──────────────────────────────
  try {
    const payload = {
      genre: mapCategoryToGenre(ticket.category),
      popularity: estimatePopularity(ticket.category),
      hours_left: hoursRemaining,
      original_price: originalPrice,
      seat_quality: 2,          // default mid-range
      seller_score: 75,         // default decent score
      day_of_week: now.getDay(),
      listed_price: listingPrice,
    };

    const response = await fetch('http://127.0.0.1:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`quicktick1 API returned status ${response.status}`);
    }

    const aiData = await response.json();

    // Map urgency from API
    let urgencyLevel, urgencyLabel;
    if (aiData.urgency === 'CRITICAL') {
      urgencyLevel = 'critical';
      urgencyLabel = '🔴 Critical — Event imminent!';
    } else if (aiData.urgency === 'URGENT') {
      urgencyLevel = 'high';
      urgencyLabel = '🟠 High — Sell now!';
    } else {
      urgencyLevel = 'medium';
      urgencyLabel = '🟡 Medium — Price dropping';
    }

    const rescuePrice = aiData.rescue_price;
    const floorPrice = Math.round(originalPrice * 0.2 * 100) / 100;

    return {
      isEligible: true,
      rescuePrice: rescuePrice,
      originalPrice,
      currentListingPrice: listingPrice,
      decayFactor: Math.round((rescuePrice / originalPrice) * 100) / 100,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      urgencyLevel,
      urgencyLabel,
      buyerSavingsPercent: Math.max(0, aiData.discount_pct || 0),
      trustScore: aiData.trust_score,
      floorPrice,
      recommendation: `List at ₹${rescuePrice} for a quick sale. Floor price: ₹${floorPrice}.`,
      source: 'quicktick1-ai',
    };
  } catch (error) {
    console.error('Error calling quicktick1 API, using local fallback:', error.message);
  }

  // ── Fallback: local exponential-decay formula ────────────────
  const decayFactor = 0.2 + 0.65 * (1 - Math.exp(-hoursRemaining / 18));
  let rescuePrice = originalPrice * decayFactor;
  const floorPrice = originalPrice * 0.2;
  rescuePrice = Math.max(rescuePrice, floorPrice);

  let urgencyLevel, urgencyLabel;
  if (hoursRemaining <= 2) {
    urgencyLevel = 'critical';
    urgencyLabel = '🔴 Critical — Event imminent!';
  } else if (hoursRemaining <= 6) {
    urgencyLevel = 'high';
    urgencyLabel = '🟠 High — Sell now!';
  } else if (hoursRemaining <= 24) {
    urgencyLevel = 'medium';
    urgencyLabel = '🟡 Medium — Price dropping';
  } else {
    urgencyLevel = 'low';
    urgencyLabel = '🟢 Low — Still time';
  }

  const buyerSavings = Math.round(((listingPrice - rescuePrice) / listingPrice) * 100);

  return {
    isEligible: true,
    rescuePrice: Math.round(rescuePrice * 100) / 100,
    originalPrice,
    currentListingPrice: listingPrice,
    decayFactor: Math.round(decayFactor * 100) / 100,
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    urgencyLevel,
    urgencyLabel,
    buyerSavingsPercent: Math.max(0, buyerSavings),
    floorPrice: Math.round(floorPrice * 100) / 100,
    recommendation: `List at $${Math.round(rescuePrice * 100) / 100} for a quick sale. Floor price: $${Math.round(floorPrice * 100) / 100}.`,
    source: 'local-fallback',
  };
}

module.exports = { calculateRescuePrice };
