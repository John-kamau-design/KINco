function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');
}

async function registerFarmer(e) {
  e.preventDefault();
  const fullName = document.getElementById('reg-name').value;
  const phoneNumber = document.getElementById('reg-phone').value;
  const nationalId = document.getElementById('reg-id').value;
  const isShareholder = document.getElementById('reg-shareholder').checked;

  const res = await fetch('/api/farmers/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, phoneNumber, nationalId, isShareholder })
  });

  if (res.ok) {
    alert('Farmer Registered Successfully!');
    e.target.reset();
  } else {
    alert('Failed to register farmer');
  }
}

async function submitReconcile(e) {
  e.preventDefault();
  const driverId = document.getElementById('driver-id-input').value;
  const intakeAmount = document.getElementById('offload-amount').value;
  const userObj = JSON.parse(localStorage.getItem('kinco_user') || '{}');

  const res = await fetch('/api/clerk/tank-reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clerkId: userObj.id || 1, driverId, intakeAmount })
  });

  const data = await res.json();
  if (res.ok) {
    alert(`Reconciliation Saved! Margin: ${data.record.margin}L, Variation: ${data.record.variation_percentage}%`);
  } else {
    alert('Error recording reconciliation');
  }
}

async function addAgrovetItem(e) {
  e.preventDefault();
  const itemName = document.getElementById('item-name').value;
  const quantity = document.getElementById('item-qty').value;
  const receivedFrom = document.getElementById('item-source').value;

  const res = await fetch('/api/agrovet/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemName, quantity, receivedFrom })
  });

  if (res.ok) alert('Agrovet Item Added!');
}

async function processPayAll() {
  const farmerId = document.getElementById('pay-farmer-id').value;
  if (!farmerId) return alert('Enter Farmer ID');

  const res = await fetch('/api/payments/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmerId })
  });

  if (res.ok) alert('All pending payments cleared at 45 KSh/Litre!');
}

function logout() {
  localStorage.clear();
  window.location.href = '/index.html';
}