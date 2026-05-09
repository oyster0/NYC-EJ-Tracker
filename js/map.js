import { fetchJSON, boroughClass, setActiveNav } from './main.js';

setActiveNav();

const BOROUGHS = [
  { id: 'bronx',    label: 'Bronx',         color: '#ff9800' },
  { id: 'brooklyn', label: 'Brooklyn',       color: '#5c6bc0' },
  { id: 'manhattan',label: 'Manhattan',      color: '#e91e63' },
  { id: 'queens',   label: 'Queens',         color: '#00acc1' },
  { id: 'staten',   label: 'Staten Island',  color: '#9c27b0' },
];

const BOROUGH_BLURBS = {
  bronx:    'The Bronx faces disproportionate exposure to highway pollution, industrial facilities, and flooding. The South Bronx has long been an epicenter of environmental justice organizing.',
  brooklyn: 'Brooklyn communities including Red Hook, Sunset Park, and Greenpoint live near superfund sites, waterfront industrial zones, and face growing climate flood risk.',
  manhattan:'Upper Manhattan neighborhoods like East Harlem and Washington Heights experience urban heat island effects and lack equitable access to green space.',
  queens:   'Queens spans diverse ecosystems and communities, from Jamaica Bay wetlands to the Newtown Creek corridor — a federally designated Superfund site.',
  staten:   'Staten Island\'s North Shore faces air quality and flood risk challenges, while the Greenbelt provides critical green infrastructure under threat from development.'
};

let allNews = [];
let activeBorough = null;

async function init() {
  allNews = await fetchJSON('data/news.json');
  renderLegend();
  renderMap();
  updateInfo(null);
}

/* ── Borough legend panel ───────────────────────────────────── */
function renderLegend() {
  const list = document.getElementById('borough-btn-list');
  list.innerHTML = BOROUGHS.map(b => {
    const count = allNews.filter(n => boroughClass(n.borough) === b.id).length;
    return `
      <button class="borough-btn" data-id="${b.id}" aria-label="Filter by ${b.label}">
        <span class="swatch" style="background:${b.color}"></span>
        ${b.label}
        <span class="count">${count}</span>
      </button>`;
  }).join('');

  list.addEventListener('click', e => {
    const btn = e.target.closest('.borough-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    setActiveBorough(activeBorough === id ? null : id);
  });
}

function setActiveBorough(id) {
  activeBorough = id;

  document.querySelectorAll('.borough-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.id === id);
  });
  document.querySelectorAll('.borough-path').forEach(path => {
    if (!id) {
      path.classList.remove('active', 'dimmed');
    } else {
      path.classList.toggle('active',  path.dataset.id === id);
      path.classList.toggle('dimmed',  path.dataset.id !== id);
    }
  });
  updateInfo(id);
}

/* ── SVG map ────────────────────────────────────────────────── */
function renderMap() {
  const svg = document.getElementById('nyc-map');

  /* Simplified NYC borough paths (schematic, not geo-accurate) */
  const paths = {
    manhattan: 'M 290 60 L 320 55 L 340 80 L 345 120 L 350 160 L 345 200 L 335 240 L 320 270 L 300 280 L 285 260 L 280 220 L 278 180 L 280 140 L 282 100 Z',
    bronx:     'M 320 55 L 390 40 L 440 50 L 460 80 L 450 110 L 420 130 L 380 130 L 350 130 L 345 120 L 340 80 Z',
    queens:    'M 350 130 L 380 130 L 420 130 L 470 140 L 510 160 L 520 200 L 500 230 L 460 250 L 420 260 L 380 255 L 345 200 L 350 160 Z',
    brooklyn:  'M 300 280 L 320 270 L 345 200 L 380 255 L 420 260 L 430 290 L 410 330 L 380 360 L 340 370 L 300 360 L 275 330 L 270 300 Z',
    staten:    'M 180 320 L 230 290 L 265 310 L 270 350 L 255 390 L 220 420 L 180 420 L 155 390 L 150 355 L 160 330 Z',
  };

  BOROUGHS.forEach(b => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', paths[b.id]);
    path.setAttribute('class', `borough-path ${b.id}`);
    path.setAttribute('data-id', b.id);
    path.setAttribute('aria-label', b.label);
    path.setAttribute('role', 'button');
    path.setAttribute('tabindex', '0');

    path.addEventListener('click', () => {
      setActiveBorough(activeBorough === b.id ? null : b.id);
    });
    path.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActiveBorough(activeBorough === b.id ? null : b.id);
      }
    });

    svg.appendChild(path);
  });

  /* Borough labels */
  const labels = {
    manhattan:  [310, 170, 'Manhattan'],
    bronx:      [385,  90, 'Bronx'],
    queens:     [430, 195, 'Queens'],
    brooklyn:   [350, 320, 'Brooklyn'],
    staten:     [205, 365, 'Staten\nIsland'],
  };

  Object.entries(labels).forEach(([id, [x, y, text]]) => {
    const lines = text.split('\n');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.pointerEvents = 'none';

    lines.forEach((line, i) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', y + i * 14);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '11');
      t.setAttribute('font-weight', '600');
      t.setAttribute('fill', '#fff');
      t.setAttribute('font-family', 'Segoe UI, system-ui, sans-serif');
      t.textContent = line;
      g.appendChild(t);
    });

    svg.appendChild(g);
  });
}

/* ── Info panel ─────────────────────────────────────────────── */
function updateInfo(id) {
  const panel = document.getElementById('map-info');
  if (!id) {
    panel.innerHTML = `<p>Click a borough to see related news and environmental context.</p>`;
    return;
  }
  const borough = BOROUGHS.find(b => b.id === id);
  const items = allNews.filter(n => boroughClass(n.borough) === id).slice(0, 3);
  const linksHtml = items.length
    ? `<div class="news-links">${items.map(n => `<a href="${n.url}">${n.headline}</a>`).join('')}</div>`
    : '<p style="margin-top:.5rem;font-size:.85rem;color:#666">No recent stories.</p>';

  panel.innerHTML = `
    <h3>${borough.label}</h3>
    <p>${BOROUGH_BLURBS[id]}</p>
    ${linksHtml}
  `;
}

init().catch(console.error);
