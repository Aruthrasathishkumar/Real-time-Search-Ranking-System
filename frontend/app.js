const COLLECTION_API = 'http://localhost:3001';
const SEARCH_API     = 'http://localhost:3000';

const USER_ID = 'user' + Math.floor(Math.random() * 1000);

let clickBuffer = [];
let currentQuery = '';
let currentVariant = '';

const categoryEmoji = {
  headphones: '🎧', tv: '📺', phones: '📱',
  shoes: '👟', laptops: '💻',
};

function getEmoji(category) {
  const c = category.toLowerCase();
  for (const [key, emoji] of Object.entries(categoryEmoji)) {
    if (c.includes(key) || key.includes(c)) return emoji;
  }
  return '📦';
}

function quickSearch(query, btn) {
  document.getElementById('search-input').value = query;
  document.querySelectorAll('.cat').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  search(query);
}

async function search(query) {
  if (!query.trim()) return;
  currentQuery = query.trim();

  const title = document.getElementById('results-title');
  if (title) title.textContent = currentQuery.charAt(0).toUpperCase() + currentQuery.slice(1);

  try {
    const res = await fetch(
      `${SEARCH_API}/api/search?q=${encodeURIComponent(currentQuery)}&userId=${USER_ID}`
    );
    const data = await res.json();
    currentVariant = data.variant;
    renderResults(data.results, data.query, data.variant);
    loadCTR();
  } catch (err) {
    console.error('Search failed:', err);
  }
}

function renderResults(results, query, variant) {
  const grid = document.getElementById('results-grid');
  const meta = document.getElementById('meta');

  meta.textContent = `${results.length} results · variant ${variant} · ${USER_ID}`;

  if (!results || results.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-ring">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <p class="empty-title">No results found</p>
        <p class="empty-sub">Try headphones, tv, phones, shoes or laptops</p>
      </div>`;
    return;
  }

  const rankClass = ['rank-1', 'rank-2', 'rank-3'];

  grid.innerHTML = results.map((product, i) => `
    <div
      class="product-card ${rankClass[i] || ''}"
      data-item-id="${product.id}"
      data-position="${i + 1}"
      onclick="handleCardClick(this)"
      style="animation-delay:${i * 48}ms"
    >
      <div class="product-img">
        <span>${getEmoji(product.category)}</span>
        <span class="rank-tag">#${i + 1}</span>
        <span class="best-tag">⭐ Best seller</span>
      </div>
      <div class="product-body">
        <div class="product-cat">${product.category}</div>
        <div class="product-name">${product.name}</div>
        <div class="product-foot">
          <div class="product-price">$${product.price}</div>
          <button class="add-btn" onclick="event.stopPropagation()">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

function handleCardClick(card) {
  const itemId   = card.getAttribute('data-item-id');
  const position = parseInt(card.getAttribute('data-position'));

  card.classList.add('clicked');
  setTimeout(() => card.classList.remove('clicked'), 700);

  clickBuffer.push({
    userId: USER_ID, itemId,
    query: currentQuery, position,
    variant: currentVariant,
    clientTimestamp: Date.now(),
  });

  console.log(`Click buffered: ${itemId} at position ${position}`);
  flushBuffer();
}

function flushBuffer() {
  if (clickBuffer.length === 0) return;

  const events = [...clickBuffer];
  clickBuffer = [];
  const body = JSON.stringify({ events });

  const sent = navigator.sendBeacon(
    `${COLLECTION_API}/api/clicks`,
    new Blob([body], { type: 'application/json' })
  );

  if (!sent) {
    fetch(`${COLLECTION_API}/api/clicks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(err => console.error('Flush failed:', err));
  }

  console.log(`Flushed ${events.length} click events`);
}

setInterval(flushBuffer, 5000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushBuffer();
});

async function loadCTR() {
  try {
    const res  = await fetch(`${SEARCH_API}/api/ctr`);
    const data = await res.json();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setW = (id, w) => { const el = document.getElementById(id); if (el) el.style.width = w; };

    set('ctr-a-val', data.A.ctr);
    set('ctr-b-val', data.B.ctr);
    set('stats-a-val', `${data.A.searches} searches · ${data.A.clicks} clicks`);
    set('stats-b-val', `${data.B.searches} searches · ${data.B.clicks} clicks`);

    const ctrA = parseFloat(data.A.ctr);
    const ctrB = parseFloat(data.B.ctr);
    const max  = Math.max(ctrA, ctrB, 1);
    setW('bar-a', `${(ctrA / max) * 100}%`);
    setW('bar-b', `${(ctrB / max) * 100}%`);

    const winner = document.getElementById('ab-winner');
    if (winner) {
      winner.classList.remove('visible', 'winner-a', 'winner-b', 'tie');
      if (ctrA === 0 && ctrB === 0) return;
      if (ctrA > ctrB) {
        winner.textContent = `🏆 Variant A is winning — ${data.A.ctr} CTR`;
        winner.classList.add('visible', 'winner-a');
      } else if (ctrB > ctrA) {
        winner.textContent = `🏆 Variant B is winning — ${data.B.ctr} CTR`;
        winner.classList.add('visible', 'winner-b');
      } else {
        winner.textContent = `Tied — more data needed`;
        winner.classList.add('visible', 'tie');
      }
    }
  } catch (err) {
    console.error('CTR load failed:', err);
  }
}

document.getElementById('search-btn').addEventListener('click', () => {
  document.querySelectorAll('.cat').forEach(b => b.classList.remove('active'));
  search(document.getElementById('search-input').value);
});

document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.querySelectorAll('.cat').forEach(b => b.classList.remove('active'));
    search(document.getElementById('search-input').value);
  }
});

document.getElementById('ctr-btn').addEventListener('click', loadCTR);

quickSearch('headphones', document.querySelector('.cat.active'));
loadCTR();

window.handleCardClick = handleCardClick;
window.loadCTR = loadCTR;
window.quickSearch = quickSearch;