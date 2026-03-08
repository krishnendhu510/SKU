/**
 * Purchase Page — Ticket detail with AI insights + Transaction flow
 */
import { fetchAPI, isLoggedIn } from './api.js';
import { navigate, showToast } from './main.js';

export async function renderPurchase(ticketId) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="page-section fade-in"><div class="spinner"></div><p class="loading-text">Loading ticket details...</p></div>';

  try {
    const data = await fetchAPI(`/tickets/${ticketId}`);
    const { ticket, aiInsights } = data;
    const eventDate = new Date(ticket.event_date);
    const dateStr = eventDate.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const fraudScore = ticket.fraud_risk_score || 0;
    const trustScore = 100 - fraudScore;
    let trustClass = 'trust-high', trustLabel = 'High Trust';
    if (trustScore < 70) { trustClass = 'trust-medium'; trustLabel = 'Medium Trust'; }
    if (trustScore < 40) { trustClass = 'trust-low'; trustLabel = 'Low Trust'; }

    let priceBarWidth = 50, priceBarColor = 'var(--success)', priceLabel = 'Fair';
    if (aiInsights.pricing) {
      const ratio = ticket.listing_price / aiInsights.pricing.predictedFairPrice;
      priceBarWidth = Math.min(100, ratio * 50);
      
      if (aiInsights.pricing.statusLabel === 'Great Deal') { priceBarColor = 'var(--success)'; priceLabel = 'Great Deal!'; }
      else if (aiInsights.pricing.statusLabel === 'Overpriced') { priceBarColor = 'var(--danger)'; priceLabel = 'Above Fair Price'; }
      else if (aiInsights.pricing.statusLabel === 'Fair Price') { priceBarColor = 'var(--primary)'; priceLabel = 'Fair Price'; }
      else {
        // Fallback ratio logic just in case
        if (ratio < 0.85) { priceBarColor = 'var(--success)'; priceLabel = 'Great Deal!'; }
        else if (ratio > 1.3) { priceBarColor = 'var(--danger)'; priceLabel = 'Above Fair Price'; }
        else if (ratio > 1.1) { priceBarColor = 'var(--warning)'; priceLabel = 'Slightly Above'; }
        else { priceBarColor = 'var(--success)'; priceLabel = 'Fair Price'; }
      }
    }

    let rescueHTML = '';
    if (aiInsights.lastMinuteRescue) {
      const r = aiInsights.lastMinuteRescue;
      rescueHTML = `
        <div class="rescue-banner">
          <div class="rescue-title">⚡ Last Minute Rescue</div>
          <div class="rescue-price">Suggested: ₹${r.rescuePrice.toFixed(0)}</div>
          <div class="rescue-detail">${r.urgencyLabel} — ${r.hoursRemaining}h remaining</div>
          <div class="rescue-detail">Save up to ${r.buyerSavingsPercent}% off listing price</div>
        </div>
      `;
    }

    app.innerHTML = `
      <div class="purchase-layout fade-in">
        <div class="purchase-main">
          <a href="#/browse" style="color: var(--gray-600); font-size: 0.88rem; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 6px;">← Back to Browse</a>
          <div>
            <span class="ticket-category" style="margin-bottom: 10px; display: inline-block;">${ticket.category}</span>
            <h1 class="purchase-event-title">${escapeHTML(ticket.event_name)}</h1>
          </div>
          <div class="purchase-meta">
            <div class="purchase-meta-item"><div class="purchase-meta-icon">📅</div><div><div style="font-weight:600; color:var(--black);">${dateStr}</div><div style="font-size:0.82rem; color:var(--gray-600);">${timeStr}</div></div></div>
            <div class="purchase-meta-item"><div class="purchase-meta-icon">📍</div><div><div style="font-weight:600; color:var(--black);">${escapeHTML(ticket.venue)}</div></div></div>
            <div class="purchase-meta-item"><div class="purchase-meta-icon">👤</div><div><div style="font-weight:600; color:var(--black);">Sold by ${escapeHTML(ticket.seller_name)}</div></div></div>
          </div>
          ${ticket.description ? `<div class="card"><div class="card-body"><h3 style="font-size:0.95rem; font-weight:600; margin-bottom:6px;">Description</h3><p style="color:var(--gray-600); font-size:0.88rem; line-height:1.7;">${escapeHTML(ticket.description)}</p></div></div>` : ''}
          <div class="card"><div class="card-body">
            <h3 style="font-size:0.95rem; font-weight:600; margin-bottom:14px; display:flex; align-items:center; gap:6px;">✨ AI Analysis</h3>
            ${aiInsights.pricing ? `
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
              <div style="text-align:center; padding:14px; background:var(--gray-50); border-radius:var(--radius-sm);"><div style="font-size:0.7rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Fair Price</div><div style="font-size:1.2rem; font-weight:800;">₹${aiInsights.pricing.predictedFairPrice.toFixed(0)}</div></div>
              <div style="text-align:center; padding:14px; background:var(--gray-50); border-radius:var(--radius-sm);"><div style="font-size:0.7rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Confidence</div><div style="font-size:1.2rem; font-weight:800;">${Math.round(aiInsights.pricing.priceConfidence * 100)}%</div></div>
              <div style="text-align:center; padding:14px; background:var(--gray-50); border-radius:var(--radius-sm);"><div style="font-size:0.7rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Trust Score</div><div style="font-size:1.2rem; font-weight:800;">${trustScore}%</div></div>
            </div>` : ''}
          </div></div>
        </div>
        <div class="purchase-sidebar">
          <div class="purchase-price-card">
            <div class="purchase-price-big"><span class="currency-symbol">₹</span>${Number(ticket.listing_price).toFixed(0)}</div>
            <div class="purchase-price-label">Listing Price</div>
            <div class="ai-trust-score"><div class="trust-meter ${trustClass}">${trustScore}</div><div class="trust-info"><h4>${trustLabel}</h4><p>AI verified safety score</p></div></div>
            ${aiInsights.pricing ? `<div class="fair-price-comparison"><h4>Fair Price: ₹${aiInsights.pricing.predictedFairPrice.toFixed(0)}</h4><div class="price-bar"><div class="price-bar-fill" style="width:${priceBarWidth}%; background:${priceBarColor};"></div></div><p style="font-size:0.78rem; color:${priceBarColor}; font-weight:600;">${priceLabel}</p></div>` : ''}
            ${rescueHTML}
            <button class="btn btn-primary" style="width:100%; padding:14px; font-size:1rem;" id="purchase-btn">Purchase Ticket</button>
            <p style="text-align:center; font-size:0.72rem; color:var(--gray-500); margin-top:10px;">Secured with end-to-end encryption</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('purchase-btn').addEventListener('click', () => {
      if (!isLoggedIn()) {
        showToast('Please sign in to purchase tickets', 'error');
        navigate('/login');
        return;
      }
      renderTransactionPage(ticket, aiInsights);
    });
  } catch {
    app.innerHTML = `<div class="page-section"><div class="empty-state"><div class="empty-state-icon">😔</div><h3 class="empty-state-title">Ticket not found</h3><p>This ticket may have been sold or removed.</p><a href="#/browse" class="btn btn-primary" style="margin-top:16px;">Browse Events</a></div></div>`;
  }
}

function renderTransactionPage(ticket, aiInsights) {
  const app = document.getElementById('app');
  const txnId = 'TXN' + Date.now().toString(36).toUpperCase();
  const serviceFee = Math.round(ticket.listing_price * 0.05);
  const total = ticket.listing_price + serviceFee;
  const eventDate = new Date(ticket.event_date);
  const dateStr = eventDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

  // Save purchase to localStorage for dashboard
  const purchases = JSON.parse(localStorage.getItem('sku_purchases') || '[]');
  
  app.innerHTML = `
    <div class="transaction-layout fade-in">
      <div class="transaction-card">
        <div class="transaction-icon">🧾</div>
        <h2 class="transaction-title">Confirm Your Purchase</h2>
        <p class="transaction-subtitle">Review the details below before completing your transaction</p>

        <div class="transaction-details">
          <div class="transaction-row"><span class="label">Transaction ID</span><span class="value">${txnId}</span></div>
          <div class="transaction-row"><span class="label">Event</span><span class="value">${escapeHTML(ticket.event_name)}</span></div>
          <div class="transaction-row"><span class="label">Date</span><span class="value">${dateStr}</span></div>
          <div class="transaction-row"><span class="label">Venue</span><span class="value">${escapeHTML(ticket.venue)}</span></div>
          <div class="transaction-row"><span class="label">Seller</span><span class="value">${escapeHTML(ticket.seller_name)}</span></div>
          <div class="transaction-row"><span class="label">AI Trust Score</span><span class="value">${100 - (ticket.fraud_risk_score || 0)}%</span></div>
          <div class="transaction-row"><span class="label">Ticket Price</span><span class="value">₹${ticket.listing_price.toFixed(0)}</span></div>
          <div class="transaction-row"><span class="label">Service Fee (5%)</span><span class="value">₹${serviceFee}</span></div>
          <div class="transaction-total"><span>Total</span><span>₹${total}</span></div>
        </div>

        <div class="transaction-actions">
          <button class="btn btn-secondary" id="txn-cancel">Cancel</button>
          <button class="btn btn-primary" id="txn-confirm">Confirm & Pay ₹${total}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('txn-cancel').addEventListener('click', () => {
    navigate(`/purchase/${ticket.id}`);
  });

  document.getElementById('txn-confirm').addEventListener('click', () => {
    const btn = document.getElementById('txn-confirm');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    setTimeout(() => {
      // Save purchase record
      purchases.push({
        txnId,
        ticketId: ticket.id,
        eventName: ticket.event_name,
        venue: ticket.venue,
        eventDate: ticket.event_date,
        price: total,
        purchasedAt: new Date().toISOString(),
      });
      localStorage.setItem('sku_purchases', JSON.stringify(purchases));

      // Show success
      app.innerHTML = `
        <div class="transaction-layout fade-in">
          <div class="transaction-card">
            <div class="transaction-icon">✅</div>
            <h2 class="transaction-title">Purchase Successful!</h2>
            <p class="transaction-subtitle">Your ticket has been confirmed. Enjoy the event!</p>

            <div class="transaction-details">
              <div class="transaction-row"><span class="label">Transaction ID</span><span class="value">${txnId}</span></div>
              <div class="transaction-row"><span class="label">Event</span><span class="value">${escapeHTML(ticket.event_name)}</span></div>
              <div class="transaction-row"><span class="label">Amount Paid</span><span class="value">₹${total}</span></div>
              <div class="transaction-row"><span class="label">Status</span><span class="value" style="color: var(--success);">Confirmed</span></div>
            </div>

            <div class="transaction-actions">
              <a href="#/dashboard" class="btn btn-secondary">Go to Dashboard</a>
              <a href="#/browse" class="btn btn-primary">Browse More</a>
            </div>
          </div>
        </div>
      `;

      showToast('Purchase confirmed!', 'success');
    }, 1500);
  });
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
