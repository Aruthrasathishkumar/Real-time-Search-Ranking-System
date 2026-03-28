const express = require('express');
const router = express.Router();
const { getRankedResults } = require('../services/rankingService');
const { getVariant, trackSearch, getCTR } = require('../services/abTestService');
const logger = require('../../shared/logger');

// GET /api/search?q=headphones&userId=user1
router.get('/search', async (req, res) => {
  const query = req.query.q;
  const userId = req.query.userId || 'anonymous';

  if (!query) {
    return res.status(400).json({ error: 'q param is required' });
  }

  try {
    // Get variant for this user — A or B
    // Same user always gets the same variant
    const variant = await getVariant(userId);

    // Track that this user did a search
    await trackSearch(variant);

    const results = await getRankedResults(query, variant);

    logger.info(`Search: "${query}" userId:${userId} variant:${variant}`);

    res.json({ query, variant, results });
  } catch (err) {
    logger.error('Search failed', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/ctr
// Shows current CTR for both variants
// Visit this in your browser to see experiment results
router.get('/ctr', async (req, res) => {
  try {
    const ctr = await getCTR();
    res.json(ctr);
  } catch (err) {
    logger.error('CTR fetch failed', err.message);
    res.status(500).json({ error: 'CTR fetch failed' });
  }
});

module.exports = router;