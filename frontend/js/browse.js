/**
 * Browse Events Page — Search, Filters, AI Recommendations, Ticket Grid
 */
import { fetchAPI } from './api.js';
import { navigate, showToast } from './main.js';

export async function renderBrowse() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-section fade-in">
      <div class="page-header">
        <h1 class="page-title">Browse Events</h1>
        <p class="page-subtitle">Discover tickets with AI-powered recommendations</p>
      </div>

      <div id="ai-recommendations">
        <div class="spinner"></div>
        <p class="loading-text">Loading AI recommendations...</p>
      </div>

      <div class="search-section">
        <div class="search-bar">
          <div class="search-input-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="search-input" placeholder="Search events, venues, artists...">
          </div>
          <button class="btn btn-primary btn-sm" id="search-btn">Search</button>
        </div>
        <div class="filter-row">
          <select class="filter-select" id="filter-category">
            <option value="all">All Categories</option>
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
          <input type="number" class="filter-input" id="filter-min-price" placeholder="Min ₹" min="0">
          <input type="number" class="filter-input" id="filter-max-price" placeholder="Max ₹" min="0">
          <input type="date" class="filter-input" id="filter-date">
          <select class="filter-select" id="filter-sort">
            <option value="">Latest First</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="date_asc">Date: Soonest</option>
            <option value="date_desc">Date: Furthest</option>
          </select>
        </div>
      </div>

      <div id="ticket-results">
        <div class="spinner"></div>
        <p class="loading-text">Loading tickets...</p>
      </div>
    </div>
  `;

  document.getElementById('search-btn').addEventListener('click', searchTickets);
  document.getElementById('search-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') searchTickets();
  });
  document.getElementById('filter-category').addEventListener('change', searchTickets);
  document.getElementById('filter-sort').addEventListener('change', searchTickets);
  document.getElementById('filter-min-price').addEventListener('change', searchTickets);
  document.getElementById('filter-max-price').addEventListener('change', searchTickets);
  document.getElementById('filter-date').addEventListener('change', searchTickets);

  loadRecommendations();
  searchTickets();
}

async function loadRecommendations() {
  const container = document.getElementById('ai-recommendations');
  try {
    const data = await fetchAPI('/tickets/recommended');
    let html = '';
    if (data.bestValue && data.bestValue.length > 0) {
      html += renderAISection('💎 Best Value', 'Below predicted fair price', data.bestValue);
    }
    if (data.trending && data.trending.length > 0) {
      html += renderAISection('🔥 Trending Now', 'Most popular listings', data.trending);
    }
    if (data.lastMinute && data.lastMinute.length > 0) {
      html += renderAISection('⚡ Last Minute Deals', 'Events starting soon', data.lastMinute);
    }
    container.innerHTML = html;
    attachTicketCardListeners(container);
  } catch {
    container.innerHTML = '';
  }
}

function renderAISection(title, subtitle, tickets) {
  return `
    <div class="ai-section">
      <div class="ai-section-header">
        <span class="ai-badge">✨ AI RECOMMENDED</span>
        <div>
          <h2 class="ai-section-title">${title}</h2>
          <p class="page-subtitle" style="margin:0; font-size:0.82rem;">${subtitle}</p>
        </div>
      </div>
      <div class="ai-scroll">
        ${tickets.map((t) => renderTicketCard(t)).join('')}
      </div>
    </div>
  `;
}

async function searchTickets() {
  const container = document.getElementById('ticket-results');
  const q = document.getElementById('search-input').value.trim();
  const category = document.getElementById('filter-category').value;
  const minPrice = document.getElementById('filter-min-price').value;
  const maxPrice = document.getElementById('filter-max-price').value;
  const date = document.getElementById('filter-date').value;
  const sort = document.getElementById('filter-sort').value;

  container.innerHTML = '<div class="spinner"></div><p class="loading-text">Searching...</p>';

  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category && category !== 'all') params.set('category', category);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (date) params.set('date', date);
    if (sort) params.set('sort', sort);

    const data = await fetchAPI(`/tickets?${params.toString()}`);

    if (!data.tickets || data.tickets.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎫</div>
          <h3 class="empty-state-title">No tickets found</h3>
          <p>Try adjusting your search or filters, or check back later!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <p style="color: var(--gray-600); margin-bottom: 14px; font-size: 0.88rem;">
        Showing ${data.tickets.length} ticket${data.tickets.length !== 1 ? 's' : ''}
      </p>
      <div class="ticket-grid">
        ${data.tickets.map((t) => renderTicketCard(t)).join('')}
      </div>
    `;
    attachTicketCardListeners(container);
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Failed to load tickets</h3>
        <p>Please try again later.</p>
      </div>
    `;
  }
}

function renderTicketCard(ticket) {
  const eventDate = new Date(ticket.event_date);
  const dateStr = eventDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  let fraudBadge = '';
  if (ticket.fraud_risk_score !== undefined) {
    if (ticket.fraud_risk_score < 30) fraudBadge = '<span class="badge badge-safe">✓ Verified</span>';
    else if (ticket.fraud_risk_score < 70) fraudBadge = '<span class="badge badge-warning">⚠ Review</span>';
    else fraudBadge = '<span class="badge badge-danger">⚠ Flagged</span>';
  }

  let rescueBadge = '';
  if (ticket.lastMinuteRescue && ticket.lastMinuteRescue.isEligible) {
    rescueBadge = '<span class="badge badge-rescue">⚡ Rescue</span>';
  }

  let priceIndicator = '';
  if (ticket.predicted_fair_price > 0) {
    const ratio = ticket.listing_price / ticket.predicted_fair_price;
    if (ratio < 0.85) priceIndicator = '<span style="color: var(--success); font-size: 0.78rem; font-weight: 600;">↓ Below fair price</span>';
    else if (ratio > 1.2) priceIndicator = '<span style="color: var(--warning); font-size: 0.78rem; font-weight: 600;">↑ Above fair price</span>';
  }

  return `
    <div class="card ticket-card" data-ticket-id="${ticket.id}">
      <div class="ticket-card-header">
        <span class="ticket-category">${ticket.category}</span>
        <div style="display:flex; gap:4px;">${fraudBadge}${rescueBadge}</div>
      </div>
      <h3 class="ticket-event-name">${escapeHTML(ticket.event_name)}</h3>
      <div class="ticket-details">
        <div class="ticket-detail"><span class="ticket-detail-icon">📅</span><span>${dateStr} at ${timeStr}</span></div>
        <div class="ticket-detail"><span class="ticket-detail-icon">📍</span><span>${escapeHTML(ticket.venue)}</span></div>
        <div class="ticket-detail"><span class="ticket-detail-icon">👤</span><span>${escapeHTML(ticket.seller_name || 'Unknown')}</span></div>
      </div>
      <div class="ticket-footer">
        <div>
          <div class="ticket-price"><span class="currency">₹</span>${Number(ticket.listing_price).toFixed(0)}</div>
          ${ticket.original_price !== ticket.listing_price ? `<div class="ticket-original-price">Original: ₹${Number(ticket.original_price).toFixed(0)}</div>` : ''}
          ${priceIndicator}
        </div>
        <button class="btn btn-primary btn-sm">View →</button>
      </div>
    </div>
  `;
}

function attachTicketCardListeners(container) {
  container.querySelectorAll('.ticket-card').forEach((card) => {
    card.addEventListener('click', () => navigate(`/purchase/${card.dataset.ticketId}`));
  });
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
