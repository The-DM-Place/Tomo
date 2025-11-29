const mongoose = require('mongoose');

const dbUri = process.env.DB_URI;

mongoose.connect(dbUri);

const db = mongoose.connection;

db.on('connected', () => {
  console.log('Database connected to:', dbUri);
});

db.on('error', (err) => {
  console.error('Database connection error:', err);
});

module.exports = { connected: true, db };