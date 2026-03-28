const redis = require('../../shared/redisClient');
const lru = require('../../shared/lruCache');
const logger = require('../../shared/logger');
const products = require('../../data/products.json');
const { REDIS_RANKING_TTL } = require('../../shared/constants');

// Filter products that match the query by name or category
const filterProducts = (query) => {
  const q = query.toLowerCase();
  return products.filter(p =>
    p.category.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q)
  );
};

const getRankedResults = async (query, variant) => {
  const redisKey = `${query}:${variant}`;

  // LEVEL 1: Check local LRU cache
  const cached = lru.get(redisKey);
  if (cached) {
    logger.info('local_hit', { query, variant });
    return cached;
  }

  // LEVEL 2: Check Redis sorted set
  const itemIds = await redis.zrevrange(redisKey, 0, 9);

  if (itemIds && itemIds.length > 0) {
    const results = itemIds
      .map(id => products.find(p => p.id === id))
      .filter(Boolean);

    lru.set(redisKey, results);
    logger.info('redis_hit', { query, variant, count: results.length });
    return results;
  }

  // LEVEL 3: Fallback — filter by query instead of returning everything
  logger.info('fallback', { query, variant });
  const filtered = filterProducts(query);

  // Save filtered results to Redis and LRU
  if (filtered.length > 0) {
    await redis.zadd(
      redisKey,
      ...filtered.flatMap((p, i) => [filtered.length - i, p.id])
    );
    await redis.expire(redisKey, REDIS_RANKING_TTL);
  }

  lru.set(redisKey, filtered);
  return filtered;
};

module.exports = { getRankedResults };