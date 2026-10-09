const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Require compiled backend routes or TS runtime fallback
let authRoutes, farmerRoutes, milkRoutes, apiRoutes;
try {
  authRoutes = require('../dist/backend/src/routes/auth').default || require('../dist/backend/src/routes/auth');
  farmerRoutes = require('../dist/backend/src/routes/farmers').default || require('../dist/backend/src/routes/farmers');
  milkRoutes = require('../dist/backend/src/routes/milk').default || require('../dist/backend/src/routes/milk');
  apiRoutes = require('../dist/backend/src/routes/api').default || require('../dist/backend/src/routes/api');
} catch (e) {
  authRoutes = require('../backend/src/routes/auth');
  farmerRoutes = require('../backend/src/routes/farmers');
  milkRoutes = require('../backend/src/routes/milk');
  apiRoutes = require('../backend/src/routes/api');
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/milk', milkRoutes);
app.use('/api', apiRoutes);

app.get('/api-health', (_req, res) => {
  res.json({ status: 'ok', message: 'KINco API operational' });
});

module.exports = app;