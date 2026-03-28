require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const searchRouter = require('./routes/search');
const logger = require('../shared/logger');
const { SEARCH_API_PORT } = require('../shared/constants');

const app = express();

// cors() allows your browser HTML file to call this API
// Without this browsers block the request automatically
app.use(cors());
app.use(express.json());
app.use('/api', searchRouter);

app.listen(SEARCH_API_PORT, () => {
  logger.info(`Search API running on port ${SEARCH_API_PORT}`);
});