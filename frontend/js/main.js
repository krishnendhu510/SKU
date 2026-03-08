/**
 * Main App — SPA Router, Nav Management, Toast Notifications
 */
import { getCurrentUser, isLoggedIn, logout } from './api.js';
import { renderLogin, renderRegister } from './auth.js';
import { renderBrowse } from './browse.js';
import { renderSell } from './sell.js';
import { renderPurchase } from './purchase.js';
import { renderDashboard } from './dashboard.js';

// ========== ROUTER ==========
function getRoute() {
  const hash = window.location.hash.slice(1) || '/';
  return hash;
}

function matchRoute(route) {
  const purchaseMatch = route.match(/^\/purchase\/(.+)$/);
  if (purchaseMatch) return { page: 'purchase', params: { id: purchaseMatch[1] } };

  const transactionMatch = route.match(/^\/transaction\/(.+)$/);
  if (transactionMatch) return { page: 'transaction', params: { id: transactionMatch[1] } };

  switch (route) {
    case '/': return { page: 'home' };
    case '/browse': return { page: 'browse' };
    case '/sell': return { page: 'sell' };
    case '/login': return { page: 'login' };
    case '/register': return { page: 'register' };
    case '/dashboard': return { page: 'dashboard' };
    default: return { page: 'home' };
  }
}

async function handleRoute() {
  const route = getRoute();
  const { page, params } = matchRoute(route);

  document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));

  switch (page) {
    case 'home':
      renderHome();
      break;
    case 'browse':
      document.getElementById('nav-browse')?.classList.add('active');
      await renderBrowse();
      break;
    case 'sell':
      document.getElementById('nav-sell')?.classList.add('active');
      renderSell();
      break;
    case 'login':
      renderLogin();
      break;
    case 'register':
      renderRegister();
      break;
    case 'purchase':
      await renderPurchase(params.id);
      break;
    case 'transaction':
      // Transaction page is rendered by purchase.js directly
      break;
    case 'dashboard':
      document.getElementById('nav-dashboard')?.classList.add('active');
      await renderDashboard();
      break;
    default:
      renderHome();
  }

  window.scrollTo(0, 0);
}

export function navigate(path) {
  window.location.hash = path;
}

// ========== HOME PAGE ==========
function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="hero">
      <div class="hero-badge">
        ✨ AI-Powered Ticket Marketplace
      </div>
      
      <h1>
        <span class="highlight">Sadhanam Kayyil</span><br>
        Undo<span style="color: var(--red);">?</span>
      </h1>
      
      <p class="hero-subtitle">
        The smartest way to buy and sell event tickets. AI-powered fraud detection, 
        fair pricing, and last-minute rescue deals — all in one place.
      </p>
      
      <div class="hero-actions">
        <a href="#/browse" class="btn btn-primary">Browse Events</a>
        <a href="#/sell" class="btn btn-secondary">Sell a Ticket</a>
      </div>

      <div class="hero-features">
        <div class="hero-feature">
          <span class="feature-icon">🛡️</span>
          <h3 class="feature-title">Fraud Detection</h3>
          <p class="feature-desc">AI analyzes every listing for pricing anomalies, suspicious patterns, and account risks</p>
        </div>
        <div class="hero-feature">
          <span class="feature-icon">📊</span>
          <h3 class="feature-title">Fair Pricing</h3>
          <p class="feature-desc">Get AI-predicted fair prices based on category, demand, and time until the event</p>
        </div>
        <div class="hero-feature">
          <span class="feature-icon">⚡</span>
          <h3 class="feature-title">Last Minute Rescue</h3>
          <p class="feature-desc">Score amazing deals on tickets close to event time with our smart pricing engine</p>
        </div>
      </div>
    </section>
  `;
}

// ========== NAV MANAGEMENT ==========
export function updateNav() {
  const authSection = document.getElementById('nav-auth');
  const userSection = document.getElementById('nav-user');
  const userBadge = document.getElementById('user-badge');
  const userName = document.getElementById('user-name');
  const dashboardLink = document.getElementById('nav-dashboard');

  if (isLoggedIn()) {
    const user = getCurrentUser() || JSON.parse(localStorage.getItem('sku_user') || '{}');
    authSection.classList.add('hidden');
    userSection.classList.remove('hidden');
    if (dashboardLink) dashboardLink.style.display = '';
    if (user.username) {
      userBadge.textContent = user.username.charAt(0).toUpperCase();
      userName.textContent = user.username;
    }
  } else {
    authSection.classList.remove('hidden');
    userSection.classList.add('hidden');
    if (dashboardLink) dashboardLink.style.display = 'none';
  }
}

// ========== TOAST NOTIFICATIONS ==========
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || icons.info}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ========== INITIALIZE ==========
function init() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
  updateNav();

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
    updateNav();
    showToast('Logged out successfully', 'info');
    navigate('/');
  });

  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.addEventListener('click', (e) => {
    if (e.target.classList.contains('nav-link')) navLinks.classList.remove('open');
  });
}

init();
