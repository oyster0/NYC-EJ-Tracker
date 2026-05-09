import { fetchJSON, boroughClass, categorySlug, setActiveNav } from './main.js';

setActiveNav();

let allEvents = [];
let currentYear, currentMonth;
let activeCategory = 'All';

async function init() {
  allEvents = await fetchJSON('data/events.json');
  const today = new Date();
  currentYear  = today.getFullYear();
  currentMonth = today.getMonth(); // 0-indexed
  renderFilters();
  renderCalendar();
  renderEventList();
}

/* ── Category filters ───────────────────────────────────────── */
function renderFilters() {
  const categories = ['All', 'Volunteer', 'Public Hearing', 'Town Hall', 'Workshop'];
  const bar = document.getElementById('cal-filter-bar');
  bar.innerHTML = categories.map(c => `
    <button class="filter-btn ${c === activeCategory ? 'active' : ''}" data-cat="${c}">
      ${c}
    </button>
  `).join('');

  bar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    bar.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderCalendar();
    renderEventList();
  });
}

/* ── Calendar grid ──────────────────────────────────────────── */
function renderCalendar() {
  const monthName = new Date(currentYear, currentMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('cal-month-label').textContent = monthName;

  const grid = document.getElementById('cal-grid');
  const todayStr = new Date().toISOString().slice(0, 10);

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev  = new Date(currentYear, currentMonth, 0).getDate();

  const filtered = filteredEvents();

  const cells = [];
  /* leading cells from prev month */
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, current: false });
  }
  /* current month */
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  /* trailing cells */
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ day: d, current: false });
  }

  grid.innerHTML = cells.map(({ day, current }) => {
    const dateStr = current
      ? `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      : null;
    const dayEvents = dateStr ? filtered.filter(e => e.date === dateStr) : [];
    const isToday = dateStr === todayStr;

    const dotHtml = dayEvents.slice(0, 3).map(e => {
      const slug = categorySlug(e.category);
      return `<div class="cal-event-dot ${slug}" title="${e.title}">${e.title}</div>`;
    }).join('');

    return `<div class="cal-cell ${current ? '' : 'other-month'} ${isToday ? 'today' : ''} ${dayEvents.length ? 'has-events' : ''}"
                 data-date="${dateStr ?? ''}">
      <div class="cal-day-num">${day}</div>
      ${dotHtml}
    </div>`;
  }).join('');

  grid.addEventListener('click', e => {
    const cell = e.target.closest('.cal-cell.has-events');
    if (!cell || !cell.dataset.date) return;
    scrollToEvent(cell.dataset.date);
  });
}

function scrollToEvent(dateStr) {
  const card = document.querySelector(`.event-card[data-date="${dateStr}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Event list ─────────────────────────────────────────────── */
function renderEventList() {
  const panel = document.getElementById('event-list');
  const items = filteredEvents().sort((a, b) => a.date.localeCompare(b.date));

  if (!items.length) {
    panel.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>No events match this filter.</p></div>`;
    return;
  }

  panel.innerHTML = items.map(e => `
    <div class="event-card" data-date="${e.date}">
      <div class="event-card-header">
        <span class="borough-badge ${boroughClass(e.borough)}">${e.borough}</span>
        <span class="category-badge">${e.category}</span>
      </div>
      <h3>${e.title}</h3>
      <div class="event-meta">
        <span class="time">${e.date} · ${e.time}</span>
        <span class="place">${e.location}</span>
        <span class="org">${e.organizer}</span>
      </div>
      <p>${e.description}</p>
      <a class="rsvp-btn" href="${e.rsvp}">RSVP / Learn more</a>
    </div>
  `).join('');
}

function filteredEvents() {
  return activeCategory === 'All'
    ? allEvents
    : allEvents.filter(e => e.category === activeCategory);
}

/* ── Month navigation ───────────────────────────────────────── */
document.getElementById('cal-prev').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

init().catch(console.error);
