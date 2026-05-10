// EJ_EVENTS loaded from data/events.js via <script> tag in calendar.html

(function () {

  // Navigation bounds: May–July 2026 only
  var MIN_MONTH = 4; // May (0-indexed)
  var MAX_MONTH = 6; // July
  var currentYear  = 2026;
  var currentMonth = 4; // Start on May

  var BOROUGH_COLORS = {
    'Bronx':         '#d4660a',
    'Brooklyn':      '#3b4db5',
    'Manhattan':     '#b52060',
    'Queens':        '#097b8a',
    'Staten Island': '#6b2d99',
    'All':           '#7a8c82'
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function formatLongDate(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    renderNav();
    renderGrid();
  }

  function renderNav() {
    var label = new Date(currentYear, currentMonth, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('cal-month-label').textContent = label;

    var prevBtn = document.getElementById('cal-prev');
    var nextBtn = document.getElementById('cal-next');
    prevBtn.disabled = currentMonth <= MIN_MONTH;
    nextBtn.disabled = currentMonth >= MAX_MONTH;
  }

  function renderGrid() {
    var grid     = document.getElementById('cal-grid');
    var todayStr = new Date().toISOString().slice(0, 10);
    var firstDay    = new Date(currentYear, currentMonth, 1).getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var daysInPrev  = new Date(currentYear, currentMonth, 0).getDate();

    // Build date → events lookup for this month
    var byDate = {};
    EJ_EVENTS.forEach(function (ev) {
      if (!ev.date) return;
      var p = ev.date.split('-');
      if (+p[0] === currentYear && (+p[1] - 1) === currentMonth) {
        if (!byDate[ev.date]) byDate[ev.date] = [];
        byDate[ev.date].push(ev);
      }
    });

    // Build 42 cells (6 rows × 7 cols)
    var cells = [];
    for (var i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: daysInPrev - i, current: false, dateStr: null });
    }
    for (var d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        current: true,
        dateStr: currentYear + '-' + pad(currentMonth + 1) + '-' + pad(d)
      });
    }
    var trailing = 42 - cells.length;
    for (var t = 1; t <= trailing; t++) {
      cells.push({ day: t, current: false, dateStr: null });
    }

    grid.innerHTML = cells.map(function (cell) {
      var events  = cell.dateStr ? (byDate[cell.dateStr] || []) : [];
      var isToday = cell.dateStr === todayStr;

      var classes = ['cal-cell'];
      if (!cell.current) classes.push('other-month');
      if (isToday)       classes.push('today');
      if (events.length) classes.push('has-events');

      // Up to 2 event rows; "+N more" if overflow
      var evHtml = events.slice(0, 2).map(function (ev) {
        var color = BOROUGH_COLORS[ev.borough] || '#7a8c82';
        return '<div class="cal-event" data-id="' + ev.id + '" role="button" tabindex="0" aria-label="' + ev.title + '">' +
          '<span class="cal-dot" style="background:' + color + '"></span>' +
          '<span class="cal-event-title">' + ev.title + '</span>' +
          '</div>';
      }).join('');

      if (events.length > 2) {
        evHtml += '<div class="cal-overflow">+' + (events.length - 2) + ' more</div>';
      }

      return '<div class="' + classes.join(' ') + '">' +
        '<div class="cal-day-num">' + cell.day + '</div>' +
        evHtml +
        '</div>';
    }).join('');

    // Attach click + keyboard handlers to each event row
    grid.querySelectorAll('.cal-event').forEach(function (el) {
      function activate() {
        var id = parseInt(el.dataset.id, 10);
        var ev = EJ_EVENTS.find(function (e) { return e.id === id; });
        if (ev) openPopup(ev);
      }
      el.addEventListener('click', function (e) { e.stopPropagation(); activate(); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });
  }

  // ── Popup ──────────────────────────────────────────────────────
  function openPopup(ev) {
    var color = BOROUGH_COLORS[ev.borough] || '#7a8c82';

    document.getElementById('cal-popup-content').innerHTML =
      '<div class="popup-bar" style="background:' + color + '"></div>' +
      '<button class="popup-close" id="popup-close-btn" aria-label="Close">&times;</button>' +
      '<div class="popup-inner">' +
        '<span class="popup-cat">' + ev.category + '</span>' +
        '<h3 class="popup-title">' + ev.title + '</h3>' +
        '<ul class="popup-meta">' +
          '<li>&#128197; ' + formatLongDate(ev.date) + ' &middot; ' + ev.time + '</li>' +
          '<li>&#128205; ' + ev.location + '</li>' +
          '<li>&#127970; ' + ev.organizer + '</li>' +
        '</ul>' +
        '<p class="popup-desc">' + ev.description + '</p>' +
        '<a class="popup-rsvp" href="' + ev.url + '">RSVP / Learn more &rarr;</a>' +
      '</div>';

    document.getElementById('cal-popup-overlay').classList.add('open');
    document.getElementById('popup-close-btn').addEventListener('click', closePopup);
    document.getElementById('popup-close-btn').focus();
  }

  function closePopup() {
    document.getElementById('cal-popup-overlay').classList.remove('open');
  }

  // Close on backdrop click or Escape
  document.getElementById('cal-popup-overlay').addEventListener('click', function (e) {
    if (e.target === this) closePopup();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePopup();
  });

  // ── Navigation ────────────────────────────────────────────────
  document.getElementById('cal-prev').addEventListener('click', function () {
    if (currentMonth > MIN_MONTH) { currentMonth--; render(); }
  });
  document.getElementById('cal-next').addEventListener('click', function () {
    if (currentMonth < MAX_MONTH) { currentMonth++; render(); }
  });

  render();

}());
