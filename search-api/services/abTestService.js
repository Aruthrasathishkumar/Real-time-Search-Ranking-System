const redis = require('../../shared/redisClient');
const logger = require('../../shared/logger');
const { REDIS_VARIANT_TTL } = require('../../shared/constants');
const crypto = require('crypto');

// Assigns user to variant A or B deterministically
// Same userId ALWAYS gets the same variant
const getVariant = async (userId) => {
  const redisKey = `exp:${userId}`;

  // Check if user already has an assignment stored in Redis
  const existing = await redis.get(redisKey);
  if (existing) {
    return existing; // return their existing assignment
  }

  // First time this user is seen — assign them a variant
  // crypto.createHash gives us a consistent number from any string
  const hash = crypto.createHash('md5').update(userId).digest('hex');

  // Convert first 8 chars of hex to a number, then mod 2
  // This gives 0 or 1 — 0 = A, 1 = B
  const num = parseInt(hash.substring(0, 8), 16);
  const variant = num % 2 === 0 ? 'A' : 'B';

  // Store in Redis with 7-day TTL
  // Same user gets same variant for 7 days
  await redis.set(redisKey, variant, 'EX', REDIS_VARIANT_TTL);

  logger.info(`Assigned variant ${variant} to user ${userId}`);
  return variant;
};

// Called on every search — increments search counter for variant
const trackSearch = async (variant) => {
  await redis.hincrby(`ctr:${variant}`, 'searches', 1);
  await redis.expire(`ctr:${variant}`, REDIS_VARIANT_TTL);
};

// Called on every click — increments click counter for variant
const trackClick = async (variant) => {
  await redis.hincrby(`ctr:${variant}`, 'clicks', 1);
  await redis.expire(`ctr:${variant}`, REDIS_VARIANT_TTL);
};

// Read current CTR for both variants — useful for checking results
const getCTR = async () => {
  const a = await redis.hgetall('ctr:A') || {};
  const b = await redis.hgetall('ctr:B') || {};

  const aSearches = parseInt(a.searches || 0);
  const aClicks   = parseInt(a.clicks   || 0);
  const bSearches = parseInt(b.searches || 0);
  const bClicks   = parseInt(b.clicks   || 0);

  const ctrA = aSearches > 0
    ? ((aClicks / aSearches) * 100).toFixed(2)
    : '0.00';
  const ctrB = bSearches > 0
    ? ((bClicks / bSearches) * 100).toFixed(2)
    : '0.00';

  return {
    A: { searches: aSearches, clicks: aClicks, ctr: `${ctrA}%` },
    B: { searches: bSearches, clicks: bClicks, ctr: `${ctrB}%` },
  };
};

module.exports = { getVariant, trackSearch, trackClick, getCTR };