const mongoose = require('mongoose');
const logger = require('../utils/logger');

const dbUri = process.env.DB_URI;

mongoose.connect(dbUri);

const db = mongoose.connection;

db.on('connected', () => {
logger.success('Database connected to:', db.name);
});

db.on('error', (err) => {
  logger.error('Database connection error:', err);
});

module.exports = { connected: true, db };