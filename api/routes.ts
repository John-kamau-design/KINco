import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

import authRoutes from '../backend/src/routes/auth';
import farmerRoutes from '../backend/src/routes/farmers';
import milkRoutes from '../backend/src/routes/milk';
import apiRoutes from '../backend/src/routes/api';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/milk', milkRoutes);
app.use('/api', apiRoutes);

app.get('/api-health', (_req, res) => {
  res.json({ status: 'ok', message: 'KINco API operational' });
});

export default app;