let selectedFarmerId = null;

document.addEventListener('DOMContentLoaded', () => {
  populateLitres();
  loadHistory();
});

function populateLitres() {
  const select = document.getElementById('litres-select');
  select.innerHTML = '';
  for (let l = 0.5; l <= 100.0; l += 0.25) {
    const opt = document.createElement('option');
    opt.value = l.toFixed(2);
    opt.innerText = `${l.toFixed(2)} L`;
    select.appendChild(opt);
  }
}

async function verifyFarmer() {
  const query = document.getElementById('farmer-id-input').value.trim();
  if (!query) return alert('Enter ID or KID');

  try {
    const res = await fetch(`/api/driver/farmer/${query}`);
    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Farmer not found');
      document.getElementById('farmer-info').classList.add('hidden');
      selectedFarmerId = null;
      return;
    }

    selectedFarmerId = data.farmer_id;
    document.getElementById('farmer-name-display').innerText = `${data.full_name} (${data.kid})`;
    document.getElementById('farmer-info').classList.remove('hidden');
  } catch (err) {
    alert('Error connecting to server');
  }
}

async function confirmAndSubmitIntake(e) {
  e.preventDefault();
  if (!selectedFarmerId) return alert('Please FETCH and verify Farmer first!');

  const litres = document.getElementById('litres-select').value;
  const shift = document.getElementById('shift-select').value;

  if (!confirm(`Confirm intake of ${litres}L for selected farmer?`)) return;

  const userObj = JSON.parse(localStorage.getItem('kinco_user') || '{}');

  try {
    const res = await fetch('/api/driver/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId: userObj.id || 1,
        farmerId: selectedFarmerId,
        quantityLitres: parseFloat(litres),
        shift: shift
      })
    });

    if (res.ok) {
      alert('Intake recorded successfully!');
      loadHistory();
    } else {
      alert('Failed to submit intake.');
    }
  } catch (err) {
    alert('Server error.');
  }
}

async function loadHistory() {
  const tf = document.getElementById('timeframe-select').value;
  const userObj = JSON.parse(localStorage.getItem('kinco_user') || '{}');
  const driverId = userObj.id || 1;

  try {
    const res = await fetch(`/api/driver/history/${driverId}?timeframe=${tf}`);
    const data = await res.json();

    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';

    if (Array.isArray(data)) {
      data.forEach(item => {
        const row = `
          <tr class="border-b">
            <td class="p-1">${new Date(item.created_at).toLocaleDateString()}</td>
            <td class="p-1">${item.farmers?.users?.full_name || 'N/A'}</td>
            <td class="p-1 font-bold">${item.quantity_litres} L</td>
            <td class="p-1">${item.shift}</td>
          </tr>
        `;
        tbody.innerHTML += row;
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function logout() {
  localStorage.clear();
  window.location.href = '/index.html';
}