// ============================================================
// BOOKLY — app.js
// Core logic: Supabase client, booking wizard, calendar, slots
// ============================================================

// ── 1. CONFIG — Replace with your Supabase project values ────
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';

// ── 2. Init Supabase ─────────────────────────────────────────
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 3. Register Service Worker ────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.warn);
  });
}

// ── 4. Toast helper ──────────────────────────────────────────
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ── 5. PWA Install prompt ─────────────────────────────────────
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  }
});
document.addEventListener('click', (e) => {
  if (e.target.id === 'btn-install' && deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
      document.getElementById('install-banner')?.remove();
    });
  }
  if (e.target.id === 'btn-install-dismiss') {
    document.getElementById('install-banner')?.remove();
  }
});

// ──────────────────────────────────────────────────────────────
// BOOKING WIZARD (only runs on index.html)
// ──────────────────────────────────────────────────────────────
if (document.getElementById('step-1')) {
  initBookingWizard();
}

function initBookingWizard() {

  // ── State ─────────────────────────────────────────────────
  let state = {
    currentStep: 1,
    selectedService: null,
    selectedDate: null,      // JS Date object
    selectedTime: null,      // "HH:MM" string
    bookedSlots: [],         // [{booking_time, duration_minutes}]
    services: [],
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
  };

  // ── Step navigation ───────────────────────────────────────
  function goToStep(n) {
    document.getElementById(`step-${state.currentStep}`)?.classList.add('hidden');
    document.getElementById(`step-${n}`)?.classList.remove('hidden');
    // Update stepper dots
    for (let i = 1; i <= 4; i++) {
      const dot = document.getElementById(`step-dot-${i}`);
      if (!dot) continue;
      dot.classList.remove('active', 'done');
      if (i < n) dot.classList.add('done');
      else if (i === n) dot.classList.add('active');
    }
    state.currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Load services ─────────────────────────────────────────
  async function loadServices() {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('price');

    if (error) { toast('Failed to load services. Check your Supabase config.', 'error'); return; }
    state.services = data;
    renderServices(data);
  }

  function renderServices(services) {
    const grid = document.getElementById('services-grid');
    if (!services.length) {
      grid.innerHTML = '<p class="text-muted">No services available.</p>';
      return;
    }
    grid.innerHTML = services.map(s => `
      <div class="card card--service fade-up" data-id="${s.id}">
        <div class="flex-between mb-1">
          <h3>${s.name}</h3>
          <span class="text-gold" style="font-family:var(--font-display); font-size:1.1rem;">
            ${s.price ? '$' + Number(s.price).toFixed(0) : 'Free'}
          </span>
        </div>
        <p class="text-sm" style="margin-bottom:0.5rem;">${s.description || ''}</p>
        <span class="text-sm text-muted">⏱ ${s.duration_minutes} min</span>
      </div>
    `).join('');

    grid.querySelectorAll('.card--service').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.card--service').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedService = state.services.find(s => s.id === card.dataset.id);
        document.getElementById('btn-step1-next').disabled = false;
      });
    });
  }

  document.getElementById('btn-step1-next').addEventListener('click', () => {
    if (!state.selectedService) return;
    goToStep(2);
    renderCalendar(state.calendarYear, state.calendarMonth);
  });

  // ── Calendar ──────────────────────────────────────────────
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  function renderCalendar(year, month) {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('cal-month-label');
    label.textContent = `${MONTHS[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    let html = DAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('');
    // Empty cells before month start
    for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayOfWeek = date.getDay();
      const isPast = date < today;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = date.getTime() === today.getTime();
      const isSelected = state.selectedDate && date.getTime() === state.selectedDate.getTime();

      let cls = 'cal-day';
      if (isPast || isWeekend) cls += ' disabled';
      if (isToday) cls += ' today';
      if (isSelected) cls += ' selected';

      html += `<div class="${cls}" data-date="${date.toISOString()}">${d}</div>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.cal-day:not(.disabled):not(.empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = new Date(cell.dataset.date);
        state.selectedDate = date;
        state.selectedTime = null;
        document.getElementById('btn-step2-next').disabled = true;
        renderCalendar(year, month); // re-render to highlight
        loadTimeSlots(date);
      });
    });
  }

  document.getElementById('cal-prev').addEventListener('click', () => {
    state.calendarMonth--;
    if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
    renderCalendar(state.calendarYear, state.calendarMonth);
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    state.calendarMonth++;
    if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
    renderCalendar(state.calendarYear, state.calendarMonth);
  });

  // ── Time slots ────────────────────────────────────────────
  async function loadTimeSlots(date) {
    const wrapper = document.getElementById('time-slots-wrapper');
    wrapper.innerHTML = '<div class="skeleton" style="height:120px; border-radius:8px;"></div>';

    const dateStr = date.toISOString().slice(0, 10);
    const { data: booked, error } = await supabase.rpc('get_booked_slots', { target_date: dateStr });
    if (error) { toast('Could not load time slots.', 'error'); return; }
    state.bookedSlots = booked || [];
    renderTimeSlots(date);
  }

  function generateSlots(workStart = 9, workEnd = 18, interval = 30) {
    const slots = [];
    for (let h = workStart; h < workEnd; h++) {
      for (let m = 0; m < 60; m += interval) {
        slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
      }
    }
    return slots;
  }

  function isSlotTaken(slotTime) {
    const [sh, sm] = slotTime.split(':').map(Number);
    const slotStart = sh * 60 + sm;
    const duration = state.selectedService?.duration_minutes || 30;
    const slotEnd = slotStart + duration;

    return state.bookedSlots.some(b => {
      const [bh, bm] = b.booking_time.slice(0,5).split(':').map(Number);
      const bookedStart = bh * 60 + bm;
      const bookedEnd = bookedStart + (b.duration_minutes || 30);
      return slotStart < bookedEnd && slotEnd > bookedStart;
    });
  }

  function renderTimeSlots(date) {
    const wrapper = document.getElementById('time-slots-wrapper');
    const slots = generateSlots();
    const now = new Date();

    const html = `
      <p class="section-title" style="margin-bottom:0.5rem;">
        ${date.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}
      </p>
      <div class="time-slots">
        ${slots.map(slot => {
          const [h, m] = slot.split(':').map(Number);
          const slotDate = new Date(date);
          slotDate.setHours(h, m, 0, 0);
          const isPast = slotDate <= now;
          const taken = isSlotTaken(slot) || isPast;
          const isSelected = slot === state.selectedTime;
          const display = slotDate.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
          return `<div class="time-slot ${taken ? 'taken' : ''} ${isSelected ? 'selected' : ''}"
                       data-time="${slot}" ${taken ? 'title="Not available"' : ''}>${display}</div>`;
        }).join('')}
      </div>`;

    wrapper.innerHTML = html;
    wrapper.querySelectorAll('.time-slot:not(.taken)').forEach(slot => {
      slot.addEventListener('click', () => {
        state.selectedTime = slot.dataset.time;
        wrapper.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
        slot.classList.add('selected');
        document.getElementById('btn-step2-next').disabled = false;
      });
    });
  }

  document.getElementById('btn-step2-back').addEventListener('click', () => goToStep(1));
  document.getElementById('btn-step2-next').addEventListener('click', () => {
    if (!state.selectedDate || !state.selectedTime) return;
    goToStep(3);
    updateSummary();
  });

  // ── Step 3 summary ────────────────────────────────────────
  function updateSummary() {
    const svc = state.selectedService;
    const [h, m] = state.selectedTime.split(':').map(Number);
    const dt = new Date(state.selectedDate);
    dt.setHours(h, m);

    document.getElementById('summary-service').textContent = svc.name;
    document.getElementById('summary-price').textContent = svc.price ? `$${Number(svc.price).toFixed(2)}` : 'Free';
    document.getElementById('summary-datetime').textContent =
      dt.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) +
      ', ' + dt.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
  }

  document.getElementById('btn-step3-back').addEventListener('click', () => goToStep(2));

  // ── Submit booking ─────────────────────────────────────────
  document.getElementById('btn-step3-submit').addEventListener('click', async () => {
    const name  = document.getElementById('input-name').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const phone = document.getElementById('input-phone').value.trim();
    const notes = document.getElementById('input-notes').value.trim();

    if (!name || !email) { toast('Please fill in your name and email.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Please enter a valid email address.', 'error'); return; }

    const btn = document.getElementById('btn-step3-submit');
    btn.disabled = true;
    btn.textContent = 'Booking…';

    const dateStr = state.selectedDate.toISOString().slice(0, 10);
    const { error } = await supabase.from('bookings').insert({
      service_id:   state.selectedService.id,
      client_name:  name,
      client_email: email,
      client_phone: phone || null,
      booking_date: dateStr,
      booking_time: state.selectedTime,
      notes:        notes || null,
      status:       'pending',
    });

    if (error) {
      toast('Booking failed — please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Confirm Booking →';
      return;
    }

    // Show success
    document.getElementById('step-3').classList.add('hidden');
    document.getElementById('stepper').classList.add('hidden');
    const success = document.getElementById('success-screen');
    success.classList.add('visible');

    const dt = new Date(state.selectedDate);
    const [h, m] = state.selectedTime.split(':').map(Number);
    dt.setHours(h, m);

    document.getElementById('success-name').textContent = name;
    document.getElementById('success-service').textContent = state.selectedService.name;
    document.getElementById('success-datetime').textContent =
      dt.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' }) +
      ' at ' + dt.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });

    toast('Booking confirmed! 🎉', 'success');
  });

  // ── Boot ──────────────────────────────────────────────────
  loadServices();
}
