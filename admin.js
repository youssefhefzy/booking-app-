// ============================================================
// BOOKLY — admin.js
// Admin dashboard: login, bookings CRUD, real-time, export
// ============================================================

// ── ADMIN PASSWORD — Change this before deploying! ───────────
const ADMIN_PASSWORD = 'admin123';

// ── State ─────────────────────────────────────────────────────
let allBookings  = [];
let allServices  = [];
let activeFilter = 'all';
let activeModal  = null;
let calAdminYear  = new Date().getFullYear();
let calAdminMonth = new Date().getMonth();

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// ── Login ──────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', attemptLogin);
document.getElementById('admin-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') attemptLogin();
});

function attemptLogin() {
  const pw = document.getElementById('admin-password').value;
  if (pw === ADMIN_PASSWORD) {
    document.getElementById('login-overlay').style.display = 'none';
    sessionStorage.setItem('bookly-admin', '1');
    initAdmin();
  } else {
    toast('Incorrect password.', 'error');
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  }
}

// Auto-login if session still active
if (sessionStorage.getItem('bookly-admin')) {
  document.getElementById('login-overlay').style.display = 'none';
  initAdmin();
}

document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.removeItem('bookly-admin');
  location.reload();
});

// ── Init admin ─────────────────────────────────────────────────
async function initAdmin() {
  await Promise.all([loadBookings(), loadServicesAdmin()]);
  setupRealtime();
  setupSidebarNav();
  setupFilters();
  setupSearch();
  setupExport();
  renderCalendarAdmin(calAdminYear, calAdminMonth);
}

// ── Sidebar navigation ─────────────────────────────────────────
function setupSidebarNav() {
  document.querySelectorAll('.sidebar__item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      document.querySelectorAll('.sidebar__item[data-view]').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      ['bookings','services','calendar'].forEach(v => {
        document.getElementById(`view-${v}`)?.classList.toggle('hidden', v !== view);
      });
      if (view === 'calendar') renderCalendarAdmin(calAdminYear, calAdminMonth);
    });
  });
}

// ── Load bookings ──────────────────────────────────────────────
async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, services(name, duration_minutes, price)`)
    .order('booking_date', { ascending: false })
    .order('booking_time', { ascending: false });

  if (error) { toast('Failed to load bookings.', 'error'); return; }
  allBookings = data || [];
  renderStats();
  renderTable();
}

// ── Stats ──────────────────────────────────────────────────────
function renderStats() {
  const total     = allBookings.length;
  const pending   = allBookings.filter(b => b.status === 'pending').length;
  const confirmed = allBookings.filter(b => b.status === 'confirmed').length;
  const revenue   = allBookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.services?.price || 0), 0);

  document.getElementById('stats-row').innerHTML = `
    <div class="card stat-card">
      <div class="stat-card__value">${total}</div>
      <div class="stat-card__label">Total Bookings</div>
    </div>
    <div class="card stat-card">
      <div class="stat-card__value">${pending}</div>
      <div class="stat-card__label">Pending</div>
      ${pending > 0 ? '<div class="stat-card__delta">⚡ Needs attention</div>' : ''}
    </div>
    <div class="card stat-card">
      <div class="stat-card__value">${confirmed}</div>
      <div class="stat-card__label">Confirmed</div>
    </div>
    <div class="card stat-card">
      <div class="stat-card__value">$${revenue.toFixed(0)}</div>
      <div class="stat-card__label">Total Revenue</div>
    </div>
  `;
}

// ── Table rendering ────────────────────────────────────────────
function renderTable() {
  const search    = document.getElementById('search-input')?.value.toLowerCase() || '';
  const dateFilter = document.getElementById('date-filter')?.value || '';

  const filtered = allBookings.filter(b => {
    const matchStatus = activeFilter === 'all' || b.status === activeFilter;
    const matchSearch = !search ||
      b.client_name.toLowerCase().includes(search) ||
      b.client_email.toLowerCase().includes(search);
    const matchDate = !dateFilter || b.booking_date === dateFilter;
    return matchStatus && matchSearch && matchDate;
  });

  const tbody = document.getElementById('bookings-tbody');

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <p>📭</p>
        <span class="text-muted">No bookings found</span>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    const dt = new Date(`${b.booking_date}T${b.booking_time}`);
    const dateStr = dt.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    const timeStr = dt.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
    const created = new Date(b.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' });

    return `<tr data-id="${b.id}">
      <td>
        <div class="client-name">${escHtml(b.client_name)}</div>
        <div class="text-sm text-muted">${escHtml(b.client_email)}</div>
        ${b.client_phone ? `<div class="text-sm text-muted">${escHtml(b.client_phone)}</div>` : ''}
      </td>
      <td>${escHtml(b.services?.name || '—')}</td>
      <td>
        <div>${dateStr}</div>
        <div class="text-sm text-muted">${timeStr}</div>
      </td>
      <td><span class="badge badge--${b.status}">${b.status}</span></td>
      <td class="text-muted">${created}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn--ghost btn--sm" onclick="openModal('${b.id}')">View</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Filters ────────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.status;
      renderTable();
    });
  });
}

function setupSearch() {
  document.getElementById('search-input')?.addEventListener('input', renderTable);
  document.getElementById('date-filter')?.addEventListener('change', renderTable);
}

// ── Services Admin ─────────────────────────────────────────────
async function loadServicesAdmin() {
  const { data } = await supabase.from('services').select('*').order('price');
  allServices = data || [];
  renderServicesAdmin();
}

function renderServicesAdmin() {
  const list = document.getElementById('services-admin-list');
  list.innerHTML = allServices.map(s => `
    <div class="card">
      <div class="flex-between mb-1">
        <h3>${escHtml(s.name)}</h3>
        <span class="${s.is_active ? 'text-gold' : 'text-muted'}">
          ${s.is_active ? '● Active' : '○ Inactive'}
        </span>
      </div>
      <p class="text-sm" style="margin-bottom:0.75rem;">${escHtml(s.description || '—')}</p>
      <div class="flex gap-2">
        <span class="text-sm text-muted">⏱ ${s.duration_minutes} min</span>
        <span class="text-sm text-gold">$${Number(s.price || 0).toFixed(2)}</span>
      </div>
    </div>
  `).join('');
}

// ── Booking detail modal ───────────────────────────────────────
function openModal(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;
  activeModal = b;

  const dt = new Date(`${b.booking_date}T${b.booking_time}`);
  const dtStr = dt.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' }) +
                ' at ' + dt.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });

  document.getElementById('modal-client').textContent = b.client_name;
  document.getElementById('modal-body').innerHTML = `
    <div style="display:grid; gap:0.75rem;">
      <div class="flex-between">
        <span class="text-muted text-sm">Email</span>
        <a href="mailto:${escHtml(b.client_email)}" style="color:var(--gold)">${escHtml(b.client_email)}</a>
      </div>
      ${b.client_phone ? `<div class="flex-between">
        <span class="text-muted text-sm">Phone</span>
        <span>${escHtml(b.client_phone)}</span>
      </div>` : ''}
      <div class="flex-between">
        <span class="text-muted text-sm">Service</span>
        <span>${escHtml(b.services?.name || '—')}</span>
      </div>
      <div class="flex-between">
        <span class="text-muted text-sm">Date &amp; Time</span>
        <span>${dtStr}</span>
      </div>
      <div class="flex-between">
        <span class="text-muted text-sm">Status</span>
        <span class="badge badge--${b.status}">${b.status}</span>
      </div>
      ${b.notes ? `<div>
        <span class="text-muted text-sm">Notes</span>
        <p class="text-sm mt-1">${escHtml(b.notes)}</p>
      </div>` : ''}
    </div>
  `;

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  activeModal = null;
}

// Status actions
document.getElementById('modal-confirm').addEventListener('click', () => updateStatus('confirmed'));
document.getElementById('modal-complete').addEventListener('click', () => updateStatus('completed'));
document.getElementById('modal-cancel').addEventListener('click', () => updateStatus('cancelled'));

async function updateStatus(status) {
  if (!activeModal) return;
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', activeModal.id);

  if (error) { toast('Failed to update status.', 'error'); return; }
  toast(`Booking marked as ${status}.`, 'success');
  closeModal();
  loadBookings();
}

// ── Real-time subscription ─────────────────────────────────────
function setupRealtime() {
  supabase
    .channel('bookings-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
      loadBookings();
    })
    .subscribe();
}

// ── CSV Export ─────────────────────────────────────────────────
function setupExport() {
  document.getElementById('btn-export')?.addEventListener('click', exportCSV);
}

function exportCSV() {
  const headers = ['Name','Email','Phone','Service','Date','Time','Status','Notes','Created'];
  const rows = allBookings.map(b => [
    b.client_name,
    b.client_email,
    b.client_phone || '',
    b.services?.name || '',
    b.booking_date,
    b.booking_time,
    b.status,
    (b.notes || '').replace(/\n/g, ' '),
    new Date(b.created_at).toLocaleDateString()
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `bookly-export-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported to CSV ✓', 'success');
}

// ── Admin Calendar view ────────────────────────────────────────
function renderCalendarAdmin(year, month) {
  const label = document.getElementById('cal-admin-label');
  const grid  = document.getElementById('cal-admin-grid');
  if (!label || !grid) return;

  label.textContent = `${MONTHS[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  // Build booking count map for this month
  const countMap = {};
  allBookings.forEach(b => {
    const d = b.booking_date;
    if (d.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)) {
      countMap[d] = (countMap[d] || 0) + 1;
    }
  });

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count = countMap[dateStr] || 0;
    const date = new Date(year, month, d);
    const isToday = date.getTime() === today.getTime();
    const isPast  = date < today;

    html += `<div style="
      border-radius:8px;
      padding:0.5rem;
      background:${count > 0 ? 'rgba(201,168,76,0.06)' : 'var(--bg-raised)'};
      border:1px solid ${isToday ? 'var(--gold-dim)' : 'var(--border-soft)'};
      min-height:60px;
      opacity:${isPast ? '0.5' : '1'};
      cursor:${count > 0 ? 'pointer' : 'default'};
    ">
      <div style="font-size:0.8rem; color:${isToday ? 'var(--gold)' : 'var(--text-secondary)'}; font-weight:${isToday ? '600' : '400'};">${d}</div>
      ${count > 0 ? `<div style="font-size:0.7rem; color:var(--gold); margin-top:4px;">${count} appt${count > 1 ? 's' : ''}</div>` : ''}
    </div>`;
  }

  grid.innerHTML = html;
}

document.getElementById('cal-admin-prev').addEventListener('click', () => {
  calAdminMonth--;
  if (calAdminMonth < 0) { calAdminMonth = 11; calAdminYear--; }
  renderCalendarAdmin(calAdminYear, calAdminMonth);
});
document.getElementById('cal-admin-next').addEventListener('click', () => {
  calAdminMonth++;
  if (calAdminMonth > 11) { calAdminMonth = 0; calAdminYear++; }
  renderCalendarAdmin(calAdminYear, calAdminMonth);
});

// ── Utility ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
