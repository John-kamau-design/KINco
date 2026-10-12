function renderAdminDashboard() {
  const container = document.getElementById('role-dashboard-container') || document.getElementById('dashboard-view');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- DASHBOARD HEADER -->
      <div class="flex justify-between items-center bg-white p-4 rounded-lg shadow border-l-4 border-sky-500">
        <div>
          <h2 class="text-xl font-bold text-gray-800">Admin Control Panel</h2>
          <p class="text-xs text-gray-500">Manage farmers, clerks, and cooperative collections</p>
        </div>
        <span class="bg-sky-100 text-sky-800 text-xs font-bold px-3 py-1 rounded-full">ADMIN</span>
      </div>

      <!-- FARMER REGISTRATION CARD -->
      <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 class="text-md font-bold text-sky-700 mb-4 border-b pb-2 flex items-center gap-2">
          <span>🌾 Register New Farmer</span>
        </h3>

        <form id="farmer-registration-form" onsubmit="submitFarmerForm(event)" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">Full Name *</label>
              <input type="text" id="reg-farmer-name" required placeholder="e.g. John Kamau" class="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-sky-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">Phone Number *</label>
              <input type="text" id="reg-farmer-phone" required placeholder="e.g. 0712345678" class="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-sky-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">National ID Number</label>
              <input type="text" id="reg-farmer-id" placeholder="e.g. 12345678" class="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-sky-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">Collection Route / Zone</label>
              <input type="text" id="reg-farmer-route" placeholder="e.g. Kinyona Route A" class="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-sky-500">
            </div>
          </div>

          <div id="farmer-form-alert" class="hidden text-xs font-bold p-3 rounded"></div>

          <button type="submit" class="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded shadow transition">
            Save & Register Farmer
          </button>
        </form>
      </div>
    </div>
  `;
}

async function submitFarmerForm(e) {
  e.preventDefault();
  const alertBox = document.getElementById('farmer-form-alert');
  alertBox.classList.add('hidden');

  const token = localStorage.getItem('token');
  const payload = {
    full_name: document.getElementById('reg-farmer-name').value,
    phone_number: document.getElementById('reg-farmer-phone').value,
    id_number: document.getElementById('reg-farmer-id').value,
    route: document.getElementById('reg-farmer-route').value
  };

  try {
    const res = await fetch('/api/farmers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      alertBox.className = 'text-xs font-bold p-3 rounded bg-green-100 text-green-700 block';
      alertBox.textContent = `Farmer registered successfully! Assigned Code: ${data.farmer.farmer_code}`;
      document.getElementById('farmer-registration-form').reset();
    } else {
      alertBox.className = 'text-xs font-bold p-3 rounded bg-red-100 text-red-700 block';
      alertBox.textContent = data.error || 'Failed to register farmer.';
    }
  } catch (err) {
    alertBox.className = 'text-xs font-bold p-3 rounded bg-red-100 text-red-700 block';
    alertBox.textContent = 'Server connection failed. Please check network.';
  }
}