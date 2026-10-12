const API_BASE = '/api';

function showView(viewId) {
  const views = ['welcome-view', 'signin-view', 'login-view', 'dashboard-view'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

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

    // Pass role to route function
    routeUserByRole(data.role, data.token, data.user);
  } catch (err) {
    if (errorEl) {
      errorEl.innerText = 'Server connection failed';
      errorEl.classList.remove('hidden');
    }
  }
}

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

    const token = data.token;
    const user = data.user || { role: data.role };

    localStorage.setItem('kinco_token', token);
    localStorage.setItem('kinco_user', JSON.stringify(user));
    localStorage.setItem('token', token); // Fallback for farmer route calls

    routeUserByRole(user.role || data.role, token, user);
  } catch (err) {
    if (errorEl) {
      errorEl.innerText = 'Server connection failed';
      errorEl.classList.remove('hidden');
    }
  }
}

function routeUserByRole(role, token, user) {
  const normalizedRole = (role || '').toUpperCase();

  if (normalizedRole === 'ADMIN' || normalizedRole === 'CLERK') {
    showView('dashboard-view');
    
    // Show logout button in header
    const logoutBtn = document.getElementById('logout-nav-btn');
    if (logoutBtn) logoutBtn.classList.remove('hidden');

    // Update role badge display
    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) roleBadge.textContent = normalizedRole;

    // Trigger dynamic dashboard renders if scripts are present
    if (normalizedRole === 'ADMIN' && typeof renderAdminDashboard === 'function') {
      renderAdminDashboard();
    } else if (normalizedRole === 'CLERK' && typeof renderClerkDashboard === 'function') {
      renderClerkDashboard();
    }
  } else if (normalizedRole === 'DRIVER') {
    showView('dashboard-view');
    const logoutBtn = document.getElementById('logout-nav-btn');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (typeof renderDriverDashboard === 'function') {
      renderDriverDashboard();
    }
  } else {
    alert('Farmer portal access restricted to Mobile App');
  }
}

function handleLogout() {
  localStorage.removeItem('kinco_token');
  localStorage.removeItem('kinco_user');
  localStorage.removeItem('token');
  
  const logoutBtn = document.getElementById('logout-nav-btn');
  if (logoutBtn) logoutBtn.classList.add('hidden');

  showView('welcome-view');
}