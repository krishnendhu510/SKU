/**
 * Sell Ticket Page — Auth-gated form with live AI pricing
 */
import { fetchAPI, isLoggedIn } from './api.js';
import { navigate, showToast } from './main.js';

let priceTimeout = null;

export function renderSell() {
  if (!isLoggedIn()) {
    showToast('Please sign in to sell tickets', 'error');
    navigate('/login');
    return;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="sell-container fade-in">
      <div class="page-header" style="text-align:center; margin-bottom: 28px;">
        <h1 class="page-title">Sell Your Ticket</h1>
        <p class="page-subtitle">List your ticket and let AI help you price it right</p>
      </div>

      <div class="form-card">
        <form id="sell-form">
          <div class="sell-form-grid">
            <div class="sell-form-full">
              <div class="form-group">
                <label class="form-label" for="sell-event">Event Name *</label>
                <input class="form-input" type="text" id="sell-event" placeholder="e.g. AR Rahman Live Concert" required>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="sell-date">Event Date *</label>
              <input class="form-input" type="datetime-local" id="sell-date" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="sell-category">Category *</label>
              <select class="form-select" id="sell-category" required>
                <option value="concert">Concert</option>
                <option value="sports">Sports</option>
                <option value="theater">Theater</option>
                <option value="comedy">Comedy</option>
                <option value="festival">Festival</option>
                <option value="conference">Conference</option>
                <option value="movies">Movies</option>
                <option value="travel">Travel</option>
                <option value="hackathon">Hackathon</option>
                <option value="general">General</option>
              </select>
            </div>

            <div class="sell-form-full">
              <div class="form-group">
                <label class="form-label" for="sell-venue">Venue / Route *</label>
                <input class="form-input" type="text" id="sell-venue" placeholder="e.g. Jawaharlal Nehru Stadium, Chennai" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="sell-original-price">Original Price (₹) *</label>
              <input class="form-input" type="number" id="sell-original-price" placeholder="0" min="1" step="1" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="sell-listing-price">Your Listing Price (₹) *</label>
              <input class="form-input" type="number" id="sell-listing-price" placeholder="0" min="1" step="1" required>
            </div>

            <div class="sell-form-full">
              <div class="form-group">
                <label class="form-label" for="sell-description">Description</label>
                <textarea class="form-textarea" id="sell-description" placeholder="Add details about seat, coach, section, transfer method etc." rows="3"></textarea>
              </div>
            </div>

            <div class="sell-form-full">
              <div class="form-group">
                <label class="form-label" for="sell-upi-id">UPI ID (for payment)</label>
                <input class="form-input" type="text" id="sell-upi-id" placeholder="e.g. yourname@upi or 9876543210@paytm" pattern="[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}">
                <small style="color: var(--gray-500); font-size: 0.75rem; margin-top: 4px; display: block;">Buyers will use this to pay you directly. Format: username@bankname</small>
              </div>
            </div>
          </div>

          <div class="ai-price-preview" id="ai-price-preview" style="display: none; margin-top: 16px; padding: 16px; border: 1px solid var(--gray-200); border-radius: var(--radius-md); background: linear-gradient(145deg, #ffffff, #f8fafc);">
            <div class="ai-price-preview-title" style="font-weight: 700; margin-bottom: 12px; color: var(--primary);">✨ AI Analysis Results</div>
            <div id="ai-price-content">
              <div class="spinner" style="margin: 8px auto; width: 24px; height: 24px;"></div>
            </div>
          </div>

          <div id="sell-error" class="form-error" style="display:none; margin-top: 14px;"></div>

          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" id="analyze-ai-btn" style="flex: 1; display:flex; align-items:center; justify-content:center; gap:8px;">
              <span style="font-size: 1.1rem;">✨</span> Analyze with AI
            </button>
            <button type="submit" class="btn btn-primary" id="sell-submit" style="flex: 2;">
              List Ticket for Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const dateInput = document.getElementById('sell-date');
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  dateInput.min = now.toISOString().slice(0, 16);

  document.getElementById('sell-form').addEventListener('submit', handleSellSubmit);
  document.getElementById('analyze-ai-btn').addEventListener('click', loadAIAnalysis);
}

async function loadAIAnalysis() {
  const category = document.getElementById('sell-category').value;
  const originalPrice = parseFloat(document.getElementById('sell-original-price').value);
  const eventDate = document.getElementById('sell-date').value;
  const listingPrice = parseFloat(document.getElementById('sell-listing-price').value);
  const preview = document.getElementById('ai-price-preview');
  const content = document.getElementById('ai-price-content');
  const btn = document.getElementById('analyze-ai-btn');

  if (!category || !originalPrice || !eventDate || !listingPrice) {
    showToast('Please fill out Category, Date, Original Price, and Listing Price first', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> Analyzing...';
  preview.style.display = 'block';
  content.innerHTML = '<div class="spinner" style="margin: 8px auto; width: 24px; height: 24px;"></div>';

  try {
    // 1. Fetch Price Prediction
    const priceData = await fetchAPI('/ai/predict-price', {
      method: 'POST',
      body: JSON.stringify({ category, original_price: originalPrice, event_date: eventDate, listing_price: listingPrice }),
    });

    let statusColor = 'var(--success)';
    if (priceData.statusLabel === 'Overpriced') statusColor = 'var(--danger)';
    if (priceData.statusLabel === 'Unknown') statusColor = 'var(--gray-500)';

    content.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px;">
        <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <div style="font-size: 0.75rem; color: var(--gray-500); text-transform: uppercase;">💰 Predicted Fair Price</div>
          <div style="font-size: 1.4rem; font-weight: 800; margin: 4px 0;">₹${priceData.predictedFairPrice.toFixed(0)}</div>
          <div style="font-size: 0.85rem; color: ${statusColor}; font-weight: 600;">${priceData.emoji} ${priceData.statusLabel}</div>
        </div>
        
        <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <div style="font-size: 0.75rem; color: var(--gray-500); text-transform: uppercase;">🛡️ Fraud Detection API</div>
          <div style="font-size: 0.85rem; color: var(--gray-600); margin-top: 8px;">
            Analyzing seller history, price anomaly, and listing patterns in the background when ticket is creating.
          </div>
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary); margin-top: 8px;">
            ✓ Real-time checks active
          </div>
        </div>
      </div>
      <p style="font-size: 0.8rem; color: var(--gray-500); text-align: center; margin-top: 8px;">Note: Final fraud risk and trust score will be calculated and visible after listing.</p>
    `;

  } catch (err) {
    content.innerHTML = '<p style="color: var(--danger); font-size: 0.85rem; text-align: center;">Could not load AI analysis. Please check if services are running.</p>';
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span style="font-size: 1.1rem;">✨</span> Analyze with AI';
  }
}

async function handleSellSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('sell-error');
  const btn = document.getElementById('sell-submit');

  const payload = {
    event_name: document.getElementById('sell-event').value.trim(),
    event_date: document.getElementById('sell-date').value,
    venue: document.getElementById('sell-venue').value.trim(),
    category: document.getElementById('sell-category').value,
    original_price: parseFloat(document.getElementById('sell-original-price').value),
    listing_price: parseFloat(document.getElementById('sell-listing-price').value),
    description: document.getElementById('sell-description').value.trim(),
    upi_id: document.getElementById('sell-upi-id').value.trim() || null,
  };

  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Listing ticket...';

  try {
    const data = await fetchAPI('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (data.ticket.status === 'flagged') {
      showToast('Ticket listed but flagged for review (fraud score: ' + data.aiAnalysis.fraudScore + ')', 'info');
    } else {
      showToast('Ticket listed successfully!', 'success');
    }

    navigate('/browse');
  } catch (err) {
    errorEl.textContent = err.error || 'Failed to list ticket. Please try again.';
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'List Ticket for Sale';
  }
}
