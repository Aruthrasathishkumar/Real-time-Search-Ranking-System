const http = require('http');

const COLLECTION_API_HOST = 'localhost';
const COLLECTION_API_PORT = 3001;

// Fake click data — weighted so some items get more clicks
const clickData = [
  { query: 'headphones', itemId: 'sony-wh1000',   weight: 40 },
  { query: 'headphones', itemId: 'bose-qc45',      weight: 25 },
  { query: 'headphones', itemId: 'apple-airpods',  weight: 15 },
  { query: 'tv',         itemId: 'lg-oled',        weight: 30 },
  { query: 'tv',         itemId: 'samsung-tv55',   weight: 20 },
  { query: 'phones',     itemId: 'iphone15',       weight: 35 },
  { query: 'phones',     itemId: 'pixel8',         weight: 15 },
  { query: 'shoes',      itemId: 'nike-air',       weight: 25 },
  { query: 'shoes',      itemId: 'adidas-ultra',   weight: 20 },
  { query: 'laptops',    itemId: 'macbook-air',    weight: 30 },
];

// Build a weighted list — items with higher weight appear more often
const weightedList = [];
clickData.forEach(item => {
  for (let i = 0; i < item.weight; i++) {
    weightedList.push(item);
  }
});

// Send one click event
function sendClick(event) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ events: [event] });
    const options = {
      hostname: COLLECTION_API_HOST,
      port: COLLECTION_API_PORT,
      path: '/api/clicks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      res.resume();
      resolve();
    });

    req.on('error', () => resolve()); // skip errors, keep going
    req.write(body);
    req.end();
  });
}

// Main simulation — send 100 clicks with small delays
async function simulate() {
  console.log('Starting simulation — sending 100 click events...');
  console.log('Make sure collection-api is running on port 3001\n');

  let sent = 0;

  for (let i = 0; i < 100; i++) {
    // Pick a random item from the weighted list
    const item = weightedList[Math.floor(Math.random() * weightedList.length)];

    const event = {
      userId:   `sim-user-${Math.floor(Math.random() * 20)}`,
      itemId:   item.itemId,
      query:    item.query,
      position: Math.floor(Math.random() * 5) + 1,
      clientTimestamp: Date.now(),
    };

    await sendClick(event);
    sent++;

    if (sent % 10 === 0) {
      console.log(`Sent ${sent}/100 events...`);
    }

    // Small delay between clicks — 100ms
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\nSimulation complete!');
  console.log('Wait 30 seconds for Flink to process the window');
  console.log('Then check Redis: ZREVRANGE headphones:A 0 9 WITHSCORES');
  console.log('Or visit: http://localhost:3000/api/search?q=headphones&userId=user1');
}

simulate();