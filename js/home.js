// EJ_NEWS is loaded from data/news.js via a <script> tag in index.html

(function () {
  function formatDate(isoString) {
    const [y, m, d] = isoString.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function boroughClass(borough) {
    const map = {
      'Bronx': 'bronx', 'Brooklyn': 'brooklyn', 'Manhattan': 'manhattan',
      'Queens': 'queens', 'Staten Island': 'staten'
    };
    return map[borough] || 'all';
  }

  function renderDigestHeader() {
    const el = document.getElementById('digest-meta');
    if (!el) return;
    const weekOf = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
    el.textContent = 'Week of ' + weekOf;
  }

  function renderCards(stories) {
    const grid = document.getElementById('cards-grid');
    if (!grid) return;

    grid.innerHTML = stories.map(function (story, i) {
      const featured = i === 0 ? 'news-card--featured' : '';
      const bClass   = boroughClass(story.borough);
      const date     = formatDate(story.date);

      return '<article class="news-card ' + featured + '" data-borough="' + story.borough + '">' +
        '<div class="card-meta">' +
          '<span class="borough-pill ' + bClass + '">' + story.borough + '</span>' +
          '<span class="category-chip">' + story.topic + '</span>' +
          '<span class="card-date">' + date + '</span>' +
        '</div>' +
        '<h3><a href="' + story.url + '" target="_blank" rel="noopener noreferrer">' + story.headline + '</a></h3>' +
        '<p>' + story.summary + '</p>' +
        '<div class="card-footer">' +
          '<span class="card-source">' + story.source + '</span>' +
          '<a class="card-readmore" href="' + story.url + '" target="_blank" rel="noopener noreferrer">Read more</a>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  renderDigestHeader();
  renderCards(EJ_NEWS.slice(0, 5));
}());
