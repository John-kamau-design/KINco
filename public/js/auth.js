const API_BASE = '/api';

// Toggle password visibility helper
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

// Single-Page View Switcher Helper
function showView(viewId) {
  const views = ['welcome-view', 'signin-view', 'login-view', 'dashboard-view'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');
}

// Handler for Sign In / Check ID Endpoint
async function handleSignInCheck(e) {
  e.preventDefault();
  const nationalId = document.getElementById('signin-id').value.trim();
  const errorEl = document.getElementById('signin-error');
  if (errorEl) errorEl.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/auth/signin-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId })
    });

    const data = await res.json();

    if (!res.ok) {
      if (errorEl) {
        errorEl.innerText = data.message || 'ID number not yet registered';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Save tokens and route user by role
    if (data.token) {
      localStorage.setItem('kinco_token', data.token);
      localStorage.setItem('token', data.token);
    }
    if (data.user) {
      localStorage.setItem('kinco_user', JSON.stringify(data.user));
    }

    routeUserByRole(data.role || (data.user && data.user.role));
  } catch (err) {
    if (errorEl) {
      errorEl.innerText = 'Server connection failed';
      errorEl.classList.remove('hidden');
    }
  }
}

// Handler for User Login Endpoint
async function handleLogin(e) {
  e.preventDefault();
  const nationalId = document.getElementById('login-id').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId, password })
    });

    const data = await res.json();

    if (!res.ok) {
      if (errorEl) {
        errorEl.innerText = data.message || 'Invalid credentials';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Store token and user data across all key conventions
    const token = data.token;
    const user = data.user || { role: data.role };

    localStorage.setItem('kinco_token', token);
    localStorage.setItem('token', token);
    localStorage.setItem('kinco_user', JSON.stringify(user));

    // Redirect user to their dedicated portal view
    routeUserByRole(user.role || data.role);
  } catch (err) {
    if (errorEl) {
      errorEl.innerText = 'Server connection failed';
      errorEl.classList.remove('hidden');
    }
  }
}

// Role-Based Router to Static HTML Dashboards
function routeUserByRole(role) {
  const normalizedRole = (role || '').toUpperCase();

  if (normalizedRole === 'ADMIN') {
    window.location.href = '/admin.html';
  } else if (normalizedRole === 'CLERK') {
    window.location.href = '/clerk.html';
  } else if (normalizedRole === 'DRIVER') {
    window.location.href = '/driver.html';
  } else {
    alert('Farmer portal access restricted to Mobile App');
  }
}

// Global Logout Handler
function handleLogout() {
  localStorage.removeItem('kinco_token');
  localStorage.removeItem('kinco_user');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  window.location.href = '/index.html';
}