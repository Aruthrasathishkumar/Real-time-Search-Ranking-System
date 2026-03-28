const express = require('express');
const router = express.Router();
const { publishClicks } = require('../services/clickPublisher');
const logger = require('../../shared/logger');
const redis = require('../../shared/redisClient');
const { REDIS_VARIANT_TTL } = require('../../shared/constants');

router.post('/clicks', async (req, res) => {
  const { events } = req.body;

  if (!events || !Array.isArray(events) || events.length === 0) {
    logger.warn('Invalid request — missing events array');
    return res.status(400).json({ error: 'events array is required' });
  }

  logger.info(`Received ${events.length} click events`);

  await publishClicks(events);

  // Track clicks in CTR counters directly using Redis
  for (const event of events) {
    if (event.variant) {
      await redis.hincrby(`ctr:${event.variant}`, 'clicks', 1);
      await redis.expire(`ctr:${event.variant}`, REDIS_VARIANT_TTL);
      logger.info(`Tracked click for variant ${event.variant}`);
    }
  }

  res.status(200).json({ received: events.length });
});

module.exports = router;