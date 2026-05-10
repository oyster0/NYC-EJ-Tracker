// EJ_NEWS loaded from data/news.js, EJ_EVENTS from data/events.js

(function () {

  // Coordinates for each news article, keyed by article id
  var NEWS_COORDS = {
    1: [40.8135, -73.8929],  // Hunts Point, Bronx
    2: [40.6765, -74.0094],  // Red Hook, Brooklyn
    3: [40.8116, -73.9537],  // West Harlem, Manhattan
    4: [40.7261, -73.9085],  // Maspeth, Queens
    5: [40.6758, -73.9893],  // Gowanus Canal, Brooklyn
    6: [40.6318, -74.1369],  // Port Richmond, Staten Island
    7: [40.8060, -73.8947],  // Port Morris, Bronx
    8: [40.6674, -73.8878],  // East New York, Brooklyn
  };

  // Init Leaflet map centered on NYC
  var map = L.map('map', { zoomControl: true }).setView([40.7128, -73.9742], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(map);

  // ── Popup builder ──────────────────────────────────────────────
  function newsPopup(article) {
    return '<div class="ej-popup">' +
      '<div class="ej-popup-type ej-popup-type--news">&#9679; News Article</div>' +
      '<strong class="ej-popup-title">' + article.headline + '</strong>' +
      '<div class="ej-popup-meta">' + article.borough + ' &middot; ' + article.topic + '</div>' +
      '<div class="ej-popup-meta">' + article.source + ' &middot; ' + article.date + '</div>' +
      '<a class="ej-popup-link" href="' + article.url + '" target="_blank" rel="noopener noreferrer">Read article &rarr;</a>' +
      '</div>';
  }

  function eventPopup(ev) {
    return '<div class="ej-popup">' +
      '<div class="ej-popup-type ej-popup-type--event">&#9632; Upcoming Event</div>' +
      '<strong class="ej-popup-title">' + ev.title + '</strong>' +
      '<div class="ej-popup-meta">' + ev.date + ' &middot; ' + ev.time + '</div>' +
      '<div class="ej-popup-meta">' + ev.location + '</div>' +
      '<div class="ej-popup-meta">Org: ' + ev.organizer + '</div>' +
      '<a class="ej-popup-link" href="' + ev.url + '" target="_blank" rel="noopener noreferrer">RSVP / Learn more &rarr;</a>' +
      '</div>';
  }

  // ── News article markers (circles) ────────────────────────────
  EJ_NEWS.forEach(function (article) {
    var coords = NEWS_COORDS[article.id];
    if (!coords) return;

    L.circleMarker(coords, {
      radius: 9,
      fillColor: '#174d2e',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.92
    })
      .bindPopup(newsPopup(article), { maxWidth: 260 })
      .addTo(map);
  });

  // ── Event markers (squares via divIcon) ───────────────────────
  var squareIcon = L.divIcon({
    className: '',
    html: '<div class="event-pin"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });

  EJ_EVENTS.forEach(function (ev) {
    if (!ev.lat || !ev.lng) return; // skip online events

    L.marker([ev.lat, ev.lng], { icon: squareIcon })
      .bindPopup(eventPopup(ev), { maxWidth: 260 })
      .addTo(map);
  });

  // ── Legend control ────────────────────────────────────────────
  var legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    var div = L.DomUtil.create('div', 'ej-legend');
    div.innerHTML =
      '<div class="ej-legend-title">Map Key</div>' +
      '<div class="ej-legend-row">' +
        '<svg width="18" height="18" style="flex-shrink:0">' +
          '<circle cx="9" cy="9" r="7" fill="#174d2e" stroke="#fff" stroke-width="2"/>' +
        '</svg>' +
        '<span>News Article</span>' +
      '</div>' +
      '<div class="ej-legend-row">' +
        '<div class="event-pin-sm"></div>' +
        '<span>Upcoming Event</span>' +
      '</div>';
    return div;
  };
  legend.addTo(map);

}());
