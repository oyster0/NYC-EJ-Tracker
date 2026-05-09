// EJ_NEWS is loaded from data/news.js via a <script> tag in map.html

(function () {

  var BOROUGHS = [
    { id: 'bronx',     label: 'Bronx',        color: '#ff9800' },
    { id: 'brooklyn',  label: 'Brooklyn',      color: '#5c6bc0' },
    { id: 'manhattan', label: 'Manhattan',     color: '#e91e63' },
    { id: 'queens',    label: 'Queens',        color: '#00acc1' },
    { id: 'staten',    label: 'Staten Island', color: '#9c27b0' },
  ];

  var BLURBS = {
    bronx:     'The Bronx faces disproportionate exposure to highway pollution, industrial facilities, and flooding. The South Bronx has long been an epicenter of environmental justice organizing.',
    brooklyn:  'Brooklyn communities including Red Hook, Sunset Park, and Greenpoint live near superfund sites, waterfront industrial zones, and face growing climate flood risk.',
    manhattan: 'Upper Manhattan neighborhoods like East Harlem and Washington Heights experience urban heat island effects and lack equitable access to green space.',
    queens:    'Queens spans diverse ecosystems and communities, from Jamaica Bay wetlands to the Newtown Creek corridor — a federally designated Superfund site.',
    staten:    'Staten Island\'s North Shore faces air quality and flood risk challenges, while the Greenbelt provides critical green infrastructure under threat from development.'
  };

  var PATHS = {
    manhattan: 'M 290 60 L 320 55 L 340 80 L 345 120 L 350 160 L 345 200 L 335 240 L 320 270 L 300 280 L 285 260 L 280 220 L 278 180 L 280 140 L 282 100 Z',
    bronx:     'M 320 55 L 390 40 L 440 50 L 460 80 L 450 110 L 420 130 L 380 130 L 350 130 L 345 120 L 340 80 Z',
    queens:    'M 350 130 L 380 130 L 420 130 L 470 140 L 510 160 L 520 200 L 500 230 L 460 250 L 420 260 L 380 255 L 345 200 L 350 160 Z',
    brooklyn:  'M 300 280 L 320 270 L 345 200 L 380 255 L 420 260 L 430 290 L 410 330 L 380 360 L 340 370 L 300 360 L 275 330 L 270 300 Z',
    staten:    'M 180 320 L 230 290 L 265 310 L 270 350 L 255 390 L 220 420 L 180 420 L 155 390 L 150 355 L 160 330 Z',
  };

  var LABELS = {
    manhattan: [310, 170, 'Manhattan'],
    bronx:     [385,  90, 'Bronx'],
    queens:    [430, 195, 'Queens'],
    brooklyn:  [350, 320, 'Brooklyn'],
    staten:    [205, 365, 'Staten Island'],
  };

  var activeBorough = null;

  function boroughClass(borough) {
    var map = {
      'Bronx': 'bronx', 'Brooklyn': 'brooklyn', 'Manhattan': 'manhattan',
      'Queens': 'queens', 'Staten Island': 'staten'
    };
    return map[borough] || 'all';
  }

  /* ── Legend ─────────────────────────────────────────────────── */
  function renderLegend() {
    var list = document.getElementById('borough-btn-list');
    list.innerHTML = BOROUGHS.map(function (b) {
      var count = EJ_NEWS.filter(function (n) { return boroughClass(n.borough) === b.id; }).length;
      return '<button class="borough-btn" data-id="' + b.id + '" aria-label="Filter by ' + b.label + '">' +
        '<span class="swatch" style="background:' + b.color + '"></span>' +
        b.label +
        '<span class="count">' + count + '</span>' +
        '</button>';
    }).join('');

    list.addEventListener('click', function (e) {
      var btn = e.target.closest('.borough-btn');
      if (!btn) return;
      var id = btn.dataset.id;
      setActiveBorough(activeBorough === id ? null : id);
    });
  }

  function setActiveBorough(id) {
    activeBorough = id;
    document.querySelectorAll('.borough-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.id === id);
    });
    document.querySelectorAll('.borough-path').forEach(function (path) {
      if (!id) {
        path.classList.remove('active', 'dimmed');
      } else {
        path.classList.toggle('active', path.dataset.id === id);
        path.classList.toggle('dimmed', path.dataset.id !== id);
      }
    });
    updateInfo(id);
  }

  /* ── SVG map ────────────────────────────────────────────────── */
  function renderMap() {
    var svg = document.getElementById('nyc-map');

    BOROUGHS.forEach(function (b) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', PATHS[b.id]);
      path.setAttribute('class', 'borough-path ' + b.id);
      path.setAttribute('data-id', b.id);
      path.setAttribute('aria-label', b.label);
      path.setAttribute('role', 'button');
      path.setAttribute('tabindex', '0');

      path.addEventListener('click', function () {
        setActiveBorough(activeBorough === b.id ? null : b.id);
      });
      path.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActiveBorough(activeBorough === b.id ? null : b.id);
        }
      });
      svg.appendChild(path);
    });

    // Borough labels
    Object.keys(LABELS).forEach(function (id) {
      var coords = LABELS[id];
      var x = coords[0], y = coords[1], text = coords[2];
      var lines = text.split(' ');
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.pointerEvents = 'none';

      // Single-line label
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', y);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '11');
      t.setAttribute('font-weight', '600');
      t.setAttribute('fill', '#fff');
      t.setAttribute('font-family', 'Segoe UI, system-ui, sans-serif');
      t.textContent = text;
      g.appendChild(t);
      svg.appendChild(g);
    });
  }

  /* ── Info panel ─────────────────────────────────────────────── */
  function updateInfo(id) {
    var panel = document.getElementById('map-info');
    if (!id) {
      panel.innerHTML = '<p>Click a borough to see related news and environmental context.</p>';
      return;
    }
    var borough = BOROUGHS.find(function (b) { return b.id === id; });
    var items = EJ_NEWS.filter(function (n) { return boroughClass(n.borough) === id; }).slice(0, 3);
    var linksHtml = items.length
      ? '<div class="news-links">' + items.map(function (n) {
          return '<a href="' + n.url + '">' + n.headline + '</a>';
        }).join('') + '</div>'
      : '<p style="margin-top:.5rem;font-size:.85rem;color:#666">No recent stories.</p>';

    panel.innerHTML = '<h3>' + borough.label + '</h3><p>' + BLURBS[id] + '</p>' + linksHtml;
  }

  renderLegend();
  renderMap();
  updateInfo(null);

}());
