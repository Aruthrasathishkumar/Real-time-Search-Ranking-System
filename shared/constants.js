module.exports = {
  // Ports
  COLLECTION_API_PORT: 3001,
  SEARCH_API_PORT: 3000,

  // Kafka — we will use these in Phase 2
  KAFKA_TOPIC: 'user-clicks',
  KAFKA_GROUP_ID: 'click-processor',

  // Redis TTL values — we will use these in Phase 3
  REDIS_RANKING_TTL: 3600,      // 1 hour in seconds
  REDIS_VARIANT_TTL: 604800,    // 7 days in seconds

  // LRU cache — we will use this in Phase 3
  LRU_MAX_SIZE: 200,
  LRU_TTL_MS: 30000,            // 30 seconds in ms

  // A/B testing — we will use this in Phase 6
  EXPERIMENT_IGNORE_HOURS: 48,
};