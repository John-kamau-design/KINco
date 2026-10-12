const API_BASE = '/api';

function showView(viewId) {
  document.getElementById('welcome-view').classList.add('hidden');
  document.getElementById('signin-view').classList.add('hidden');
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById(viewId).classList.remove('hidden');
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleSignInCheck(e) {
  e.preventDefault();
  const nationalId = document.getElementById('signin-id').value.trim();
  const errorEl = document.getElementById('signin-error');
  errorEl.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/auth/signin-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.innerText = data.message || 'ID number not yet registered';
      errorEl.classList.remove('hidden');
      return;
    }

    // Direct based on assigned role
    routeUserByRole(data.role);
  } catch (err) {
    errorEl.innerText = 'Server connection failed';
    errorEl.classList.remove('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const nationalId = document.getElementById('login-id').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.innerText = data.message || 'Invalid credentials';
      errorEl.classList.remove('hidden');
      return;
    }

    localStorage.setItem('kinco_token', data.token);
    localStorage.setItem('kinco_user', JSON.stringify(data.user));

    routeUserByRole(data.user.role);
  } catch (err) {
    errorEl.innerText = 'Server connection failed';
    errorEl.classList.remove('hidden');
  }
}

function routeUserByRole(role) {
  if (role === 'DRIVER') window.location.href = '/driver.html';
  else if (role === 'CLERK') window.location.href = '/clerk.html';
  else if (role === 'ADMIN') window.location.href = '/admin.html';
  else alert('Farmer portal access restricted to Mobile App');
}

// Add this helper function inside public/js/auth.js
function handleSuccessfulLogin(userData) {
  // Save token and user info
  localStorage.setItem('token', userData.token || '');
  localStorage.setItem('user', JSON.stringify(userData.user || {}));

  // Hide auth views and show dashboard view
  const views = ['welcome-view', 'signin-view', 'login-view'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const dashboard = document.getElementById('dashboard-view');
  if (dashboard) {
    dashboard.classList.remove('hidden');
  }

  // Show logout button in header
  const logoutBtn = document.getElementById('logout-nav-btn');
  if (logoutBtn) {
    logoutBtn.classList.remove('hidden');
  }

  // Set role badge if available
  const roleBadge = document.getElementById('user-role-badge');
  if (roleBadge && userData.user && userData.user.role) {
    roleBadge.textContent = userData.user.role.toUpperCase();
  }
}

function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Hide dashboard, show welcome view
  const dashboard = document.getElementById('dashboard-view');
  if (dashboard) dashboard.classList.add('hidden');

  const logoutBtn = document.getElementById('logout-nav-btn');
  if (logoutBtn) logoutBtn.classList.add('hidden');

  showView('welcome-view');
}