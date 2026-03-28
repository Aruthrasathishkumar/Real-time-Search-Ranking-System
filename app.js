// ── Config ───────────────────────────────────────────────
// When running locally with backend servers, set this to true
const IS_LOCAL = window.location.hostname === '127.0.0.1'
              || window.location.hostname === 'localhost';

const COLLECTION_API = 'http://localhost:3001';
const SEARCH_API     = 'http://localhost:3000';

const USER_ID = 'user' + Math.floor(Math.random() * 1000);

let clickBuffer   = [];
let currentQuery  = '';
let currentVariant = '';

// ── Static demo data (used on GitHub Pages) ───────────────
const DEMO_PRODUCTS = {
  headphones: [
    { id: 'sony-wh1000',  name: 'Sony WH-1000XM5',       category: 'headphones', price: 349 },
    { id: 'bose-qc45',    name: 'Bose QuietComfort 45',   category: 'headphones', price: 329 },
    { id: 'apple-airpods',name: 'Apple AirPods Pro',      category: 'headphones', price: 249 },
  ],
  tv: [
    { id: 'lg-oled',      name: 'LG OLED C3 65inch',      category: 'tv',         price: 1499 },
    { id: 'samsung-tv55', name: 'Samsung 55inch 4K TV',   category: 'tv',         price: 799 },
  ],
  phones: [
    { id: 'iphone15',     name: 'iPhone 15 Pro',          category: 'phones',     price: 999 },
    { id: 'pixel8',       name: 'Google Pixel 8',         category: 'phones',     price: 699 },
  ],
  shoes: [
    { id: 'nike-air',     name: 'Nike Air Max 270',       category: 'shoes',      price: 150 },
    { id: 'adidas-ultra', name: 'Adidas Ultraboost 23',   category: 'shoes',      price: 180 },
  ],
  laptops: [
    { id: 'macbook-air',  name: 'MacBook Air M2',         category: 'laptops',    price: 1099 },
  ],
};

const DEMO_CTR = {
  A: { searches: 142, clicks: 18, ctr: '12.68%' },
  B: { searches: 138, clicks: 23, ctr: '16.67%' },
};

// ── Emoji map ─────────────────────────────────────────────
const EMOJI = {
  headphones: '🎧', tv: '📺', phones: '📱',
  shoes: '👟', laptops: '💻',
};

function getEmoji(category) {
  const c = category.toLowerCase();
  for (const [k, e] of Object.entries(EMOJI)) {
    if (c.includes(k) || k.includes(c)) return e;
  }
  return '📦';
}

// ── Quick search from category tabs ──────────────────────
function quickSearch(query, btn) {
  document.getElementById('search-input').value = query;
  document.querySelectorAll('.cat').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  search(query);
}

// ── Search ────────────────────────────────────────────────
async function search(query) {
  if (!query.trim()) return;
  currentQuery = query.trim();

  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent =
    currentQuery.charAt(0).toUpperCase() + currentQuery.slice(1);

  if (IS_LOCAL) {
    // Real mode — call the actual backend
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
      showDemoFallback(query);
    }
  } else {
    // Demo mode — use static data
    currentVariant = parseInt(USER_ID.replace('user','')) % 2 === 0 ? 'A' : 'B';
    const key = Object.keys(DEMO_PRODUCTS).find(k =>
      query.toLowerCase().includes(k) || k.includes(query.toLowerCase())
    );
    const results = key ? DEMO_PRODUCTS[key] : [];
    renderResults(results, currentQuery, currentVariant);
    loadCTR();
  }
}

function showDemoFallback(query) {
  currentVariant = 'A';
  const key = Object.keys(DEMO_PRODUCTS).find(k =>
    query.toLowerCase().includes(k) || k.includes(query.toLowerCase())
  );
  renderResults(key ? DEMO_PRODUCTS[key] : [], currentQuery, currentVariant);
}

// ── Render results ────────────────────────────────────────
function renderResults(results, query, variant) {
  const grid = document.getElementById('results-grid');
  const meta = document.getElementById('meta');

  const modeNote = IS_LOCAL ? '' : ' · demo mode';
  meta.textContent = `${results.length} results · variant ${variant} · ${USER_ID}${modeNote}`;

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

// ── Click capture ─────────────────────────────────────────
function handleCardClick(card) {
  const itemId   = card.getAttribute('data-item-id');
  const position = parseInt(card.getAttribute('data-position'));

  card.classList.add('clicked');
  setTimeout(() => card.classList.remove('clicked'), 700);

  if (!IS_LOCAL) {
    // Demo mode — just show visual feedback, no real tracking
    console.log(`Demo click: ${itemId} at position ${position}`);
    return;
  }

  clickBuffer.push({
    userId: USER_ID, itemId,
    query: currentQuery, position,
    variant: currentVariant,
    clientTimestamp: Date.now(),
  });

  console.log(`Click buffered: ${itemId} at position ${position}`);
  flushBuffer();
}

// ── Flush ─────────────────────────────────────────────────
function flushBuffer() {
  if (!IS_LOCAL || clickBuffer.length === 0) return;

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

// ── CTR ───────────────────────────────────────────────────
async function loadCTR() {
  let data;

  if (IS_LOCAL) {
    try {
      const res = await fetch(`${SEARCH_API}/api/ctr`);
      data = await res.json();
    } catch {
      data = DEMO_CTR;
    }
  } else {
    data = DEMO_CTR;
  }

  const set  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setW = (id, w)   => { const el = document.getElementById(id); if (el) el.style.width = w; };

  set('ctr-a-val',   data.A.ctr);
  set('ctr-b-val',   data.B.ctr);
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
    if (ctrB > ctrA) {
      winner.textContent = `🏆 Variant B is winning — ${data.B.ctr} CTR`;
      winner.classList.add('visible', 'winner-b');
    } else if (ctrA > ctrB) {
      winner.textContent = `🏆 Variant A is winning — ${data.A.ctr} CTR`;
      winner.classList.add('visible', 'winner-a');
    }
  }
}

// ── Event listeners ───────────────────────────────────────
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

// Auto-load on start
quickSearch('headphones', document.querySelector('.cat.active'));
loadCTR();

window.handleCardClick = handleCardClick;
window.loadCTR        = loadCTR;
window.quickSearch    = quickSearch;