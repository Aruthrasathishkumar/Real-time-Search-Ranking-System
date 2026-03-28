const { LRUCache } = require('lru-cache');
const { LRU_MAX_SIZE, LRU_TTL_MS } = require('./constants');

const cache = new LRUCache({
  max: LRU_MAX_SIZE,  // max 200 entries
  ttl: LRU_TTL_MS,   // each entry lives for 30 seconds
});

module.exports = cache;