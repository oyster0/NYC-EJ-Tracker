/* Shared utilities */

export async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export function formatDate(isoString) {
  const [y, m, d] = isoString.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

export function formatMonthDay(isoString) {
  const [y, m, d] = isoString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day:   date.getDate()
  };
}

export function boroughClass(borough) {
  const map = {
    'Bronx': 'bronx',
    'Brooklyn': 'brooklyn',
    'Manhattan': 'manhattan',
    'Queens': 'queens',
    'Staten Island': 'staten',
    'All': 'all'
  };
  return map[borough] ?? 'all';
}

export function categorySlug(category) {
  return category.toLowerCase().replace(/\s+/g, '-');
}

/* Mark active nav link */
export function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}
