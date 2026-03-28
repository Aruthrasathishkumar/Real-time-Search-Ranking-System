const logger = require('../../shared/logger');
const { publishMessage } = require('../../shared/kafkaClient');
const { KAFKA_TOPIC } = require('../../shared/constants');

const publishClicks = async (events) => {
  for (const event of events) {

    event.serverTimestamp = Date.now();

    if (!event.userId || !event.itemId || !event.query) {
      logger.warn('Skipping invalid event — missing fields', event);
      continue;
    }

    try {
      await publishMessage(KAFKA_TOPIC, event.userId, event);
      logger.info('Published to Kafka', {
        userId: event.userId,
        itemId: event.itemId,
        query:  event.query,
      });
    } catch (err) {
      logger.error('Failed to publish to Kafka', err.message);
    }
  }
};

module.exports = { publishClicks };