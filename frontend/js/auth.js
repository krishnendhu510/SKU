/**
 * Auth Pages — Login & Register
 */
import { fetchAPI, setTokens } from './api.js';
import { navigate, showToast, updateNav } from './main.js';

export function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="form-container fade-in">
      <div class="form-card">
        <h1 class="form-title">Welcome Back</h1>
        <p class="form-subtitle">Sign in to your account to buy and sell tickets</p>
        
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-username">Username</label>
            <input class="form-input" type="text" id="login-username" placeholder="Enter your username" required autocomplete="username">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input class="form-input" type="password" id="login-password" placeholder="Enter your password" required autocomplete="current-password">
          </div>
          
          <div id="login-error" class="form-error" style="display:none; margin-bottom: 16px;"></div>
          
          <button type="submit" class="btn btn-primary" id="login-submit" style="width:100%; margin-top: 8px;">
            Sign In
          </button>
        </form>
        
        <p class="form-footer">
          Don't have an account? <a href="#/register">Create one</a>
        </p>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

export function renderRegister() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="form-container fade-in">
      <div class="form-card">
        <h1 class="form-title">Create Account</h1>
        <p class="form-subtitle">Join the marketplace to buy and sell event tickets</p>
        
        <form id="register-form">
          <div class="form-group">
            <label class="form-label" for="reg-email">Email Address</label>
            <input class="form-input" type="email" id="reg-email" placeholder="your@email.com" required autocomplete="email">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="reg-username">Username</label>
            <input class="form-input" type="text" id="reg-username" placeholder="Choose a username" required autocomplete="username" minlength="3">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="reg-password">Password</label>
            <input class="form-input" type="password" id="reg-password" placeholder="Min. 6 characters" required autocomplete="new-password" minlength="6">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="reg-confirm">Confirm Password</label>
            <input class="form-input" type="password" id="reg-confirm" placeholder="Repeat your password" required autocomplete="new-password">
          </div>
          
          <div id="register-error" class="form-error" style="display:none; margin-bottom: 16px;"></div>
          
          <button type="submit" class="btn btn-primary" id="register-submit" style="width:100%; margin-top: 8px;">
            Create Account
          </button>
        </form>
        
        <p class="form-footer">
          Already have an account? <a href="#/login">Sign in</a>
        </p>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', handleRegister);
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-submit');

  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const data = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    setTokens(data.accessToken, data.refreshToken);
    localStorage.setItem('sku_user', JSON.stringify(data.user));
    updateNav();
    showToast('Welcome back, ' + data.user.username + '!', 'success');
    navigate('/browse');
  } catch (err) {
    errorEl.textContent = err.error || 'Login failed. Please try again.';
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('register-submit');

  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    const data = await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });

    setTokens(data.accessToken, data.refreshToken);
    localStorage.setItem('sku_user', JSON.stringify(data.user));
    updateNav();
    showToast('Account created! Welcome, ' + data.user.username + '!', 'success');
    navigate('/browse');
  } catch (err) {
    errorEl.textContent = err.error || 'Registration failed. Please try again.';
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}
