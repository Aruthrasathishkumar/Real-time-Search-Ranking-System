require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const clicksRouter = require('./routes/clicks');
const logger = require('../shared/logger');
const { COLLECTION_API_PORT } = require('../shared/constants');

const app = express();

app.use(cors({
  origin: 'http://127.0.0.1:5500',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use('/api', clicksRouter);

app.listen(COLLECTION_API_PORT, () => {
  logger.info(`Collection API running on port ${COLLECTION_API_PORT}`);
});