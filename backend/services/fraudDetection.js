/**
 * Fraud Detection Service
 * Scores tickets 0-100 based on multiple weighted factors.
 * Tickets scoring >= 70 are auto-flagged.
 */

/**
 * Fraud Detection Service
 * Scores tickets 0-100 by calling Python AI Fraud Detection Model API
 */

async function calculateFraudScore(ticket, seller, allTickets) {
  // We still compute the heuristics as the "features" for the python model
  const priceAnomaly = calculatePriceAnomaly(ticket, allTickets);
  const accountRisk = calculateAccountRisk(seller);
  const sellerRisk = calculateSellerHistoryRisk(seller);
  const patternRisk = calculateListingPatternRisk(seller, allTickets);
  
  // Package features as expected by the python API (which expects an array of 4 features)
  const features = [priceAnomaly, accountRisk, sellerRisk, patternRisk];

  try {
    const response = await fetch('http://127.0.0.1:8002/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features })
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const aiData = await response.json();
    
    // Map the python response (fraud_prediction, fraud_probability, seller_trust_score)
    // The existing app expects `totalScore` which goes from 0 (good) to 100 (bad).
    // So totalScore = 100 - seller_trust_score
    const totalScore = 100 - aiData.seller_trust_score;

    return {
      totalScore: Math.round(totalScore),
      breakdown: {
        priceAnomaly: Math.round(priceAnomaly),
        accountAge: Math.round(accountRisk),
        sellerHistory: Math.round(sellerRisk),
        listingPattern: Math.round(patternRisk),
      },
      isFlagged: aiData.fraud_prediction === 1,
      riskLevel: aiData.fraud_prediction === 1 ? 'high' : (totalScore > 40 ? 'medium' : 'low'),
    };
  } catch (error) {
    console.error('Error calling Python Fraud API:', error);
    
    // Fallback if API fails
    const fallbackScore = (priceAnomaly * 0.4) + (accountRisk * 0.25) + (sellerRisk * 0.2) + (patternRisk * 0.15);
    return {
      totalScore: Math.round(Math.min(100, Math.max(0, fallbackScore))),
      breakdown: {
        priceAnomaly: Math.round(priceAnomaly),
        accountAge: Math.round(accountRisk),
        sellerHistory: Math.round(sellerRisk),
        listingPattern: Math.round(patternRisk),
      },
      isFlagged: fallbackScore >= 70,
      riskLevel: fallbackScore >= 70 ? 'high' : (fallbackScore >= 40 ? 'medium' : 'low'),
    };
  }
}

/**
 * Price Anomaly Detection using z-score approach
 * Compares listing price against category average
 */
function calculatePriceAnomaly(ticket, allTickets) {
  const categoryTickets = allTickets.filter(
    (t) => t.category === ticket.category && t.id !== ticket.id
  );

  if (categoryTickets.length < 2) {
    // Not enough data: check if price is wildly above original
    const ratio = ticket.listing_price / ticket.original_price;
    if (ratio > 3) return 80;
    if (ratio > 2) return 50;
    if (ratio < 0.2) return 60; // suspiciously low
    return 10;
  }

  const prices = categoryTickets.map((t) => t.listing_price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(
    prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length
  );

  if (stdDev === 0) return 0;

  const zScore = Math.abs((ticket.listing_price - mean) / stdDev);

  // z-score -> risk mapping
  if (zScore > 3) return 95;
  if (zScore > 2.5) return 80;
  if (zScore > 2) return 60;
  if (zScore > 1.5) return 40;
  if (zScore > 1) return 20;
  return 5;
}

/**
 * Account Age Risk: newer accounts are riskier
 */
function calculateAccountRisk(seller) {
  if (!seller || !seller.created_at) return 50;

  const accountAgeMs = Date.now() - new Date(seller.created_at).getTime();
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

  if (accountAgeDays < 1) return 95;
  if (accountAgeDays < 7) return 75;
  if (accountAgeDays < 30) return 50;
  if (accountAgeDays < 90) return 25;
  return 5;
}

/**
 * Seller History Risk: past fraud flags and low sales count
 */
function calculateSellerHistoryRisk(seller) {
  if (!seller) return 50;

  let risk = 0;

  // High existing fraud score
  if (seller.fraud_score > 60) risk += 60;
  else if (seller.fraud_score > 30) risk += 30;

  // Low total sales (less trust)
  if (seller.total_sales === 0) risk += 30;
  else if (seller.total_sales < 3) risk += 15;
  else if (seller.total_sales >= 10) risk -= 10;

  return Math.min(100, Math.max(0, risk));
}

/**
 * Listing Pattern Risk: multiple expensive listings in short time
 */
function calculateListingPatternRisk(seller, allTickets) {
  if (!seller) return 30;

  const sellerTickets = allTickets.filter((t) => t.seller_id === seller.id);
  const recentTickets = sellerTickets.filter((t) => {
    const ageMs = Date.now() - new Date(t.created_at).getTime();
    return ageMs < 24 * 60 * 60 * 1000; // last 24 hours
  });

  let risk = 0;

  // Many listings in 24 hours
  if (recentTickets.length > 10) risk += 80;
  else if (recentTickets.length > 5) risk += 50;
  else if (recentTickets.length > 3) risk += 25;

  // High-value burst: multiple expensive listings
  const expensiveRecent = recentTickets.filter((t) => t.listing_price > 500);
  if (expensiveRecent.length > 3) risk += 30;

  return Math.min(100, Math.max(0, risk));
}

module.exports = { calculateFraudScore };
