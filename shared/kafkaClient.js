require('dotenv').config({ path: './.env' });
const { Kafka } = require('kafkajs');
const logger = require('./logger');

const kafka = new Kafka({
  clientId: 'recommendation-system',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();
let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    logger.info('Kafka producer connected');
  }
};

const publishMessage = async (topic, key, value) => {
  await connectProducer();
  await producer.send({
    topic,
    messages: [{
      key: String(key),
      value: JSON.stringify(value),
    }],
  });
};

module.exports = { publishMessage };