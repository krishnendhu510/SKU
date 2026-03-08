/**
 * Dashboard Page — User's recent posts and purchases
 */
import { fetchAPI, isLoggedIn, getCurrentUser } from './api.js';
import { navigate, showToast } from './main.js';

export async function renderDashboard() {
  if (!isLoggedIn()) {
    showToast('Please sign in to view your dashboard', 'error');
    navigate('/login');
    return;
  }

  const app = document.getElementById('app');
  app.innerHTML = '<div class="page-section fade-in"><div class="spinner"></div><p class="loading-text">Loading dashboard...</p></div>';

  const user = getCurrentUser() || JSON.parse(localStorage.getItem('sku_user') || '{}');
  const purchases = JSON.parse(localStorage.getItem('sku_purchases') || '[]');

  let myTickets = [];
  try {
    const data = await fetchAPI('/tickets?status=available');
    const allData = data.tickets || [];
    // Also get flagged tickets
    let flaggedTickets = [];
    try {
      const flagged = await fetchAPI('/tickets?status=flagged');
      flaggedTickets = flagged.tickets || [];
    } catch {}
    const allTickets = [...allData, ...flaggedTickets];
    myTickets = allTickets.filter((t) => t.seller_id === user.id || t.seller_name === user.username);
  } catch {}

  const totalListings = myTickets.length;
  const totalPurchases = purchases.length;
  const totalSpent = purchases.reduce((sum, p) => sum + (p.price || 0), 0);

  app.innerHTML = `
    <div class="page-section fade-in">
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Welcome back, ${escapeHTML(user.username || 'User')}</p>
      </div>

      <!-- Stats -->
      <div class="dashboard-stat-row">
        <div class="stat-card">
          <div class="stat-value">${totalListings}</div>
          <div class="stat-label">Active Listings</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalPurchases}</div>
          <div class="stat-label">Purchases</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">₹${totalSpent.toFixed(0)}</div>
          <div class="stat-label">Total Spent</div>
        </div>
      </div>

      <!-- Grid: My Listings + My Purchases -->
      <div class="dashboard-grid">
        <!-- My Listings -->
        <div class="dashboard-section">
          <h3 class="dashboard-section-title">📤 My Listings</h3>
          ${myTickets.length === 0
            ? '<p style="color: var(--gray-500); font-size: 0.85rem;">No listings yet. <a href="#/sell" style="color:var(--red); font-weight:600;">Sell a ticket</a></p>'
            : myTickets.map((t) => `
              <div class="dashboard-item">
                <div class="dashboard-item-info">
                  <h4>${escapeHTML(t.event_name)}</h4>
                  <p>${new Date(t.event_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} · ${escapeHTML(t.venue)}</p>
                </div>
                <div style="text-align: right;">
                  <div class="dashboard-item-price">₹${Number(t.listing_price).toFixed(0)}</div>
                  <span class="status-pill status-${t.status}">${t.status}</span>
                </div>
              </div>
            `).join('')
          }
        </div>

        <!-- My Purchases -->
        <div class="dashboard-section">
          <h3 class="dashboard-section-title">📥 My Purchases</h3>
          ${purchases.length === 0
            ? '<p style="color: var(--gray-500); font-size: 0.85rem;">No purchases yet. <a href="#/browse" style="color:var(--red); font-weight:600;">Browse events</a></p>'
            : [...purchases].reverse().map((p) => `
              <div class="dashboard-item">
                <div class="dashboard-item-info">
                  <h4>${escapeHTML(p.eventName)}</h4>
                  <p>${new Date(p.eventDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} · ${p.txnId}</p>
                </div>
                <div style="text-align: right;">
                  <div class="dashboard-item-price">₹${Number(p.price).toFixed(0)}</div>
                  <span class="status-pill status-purchased">purchased</span>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
