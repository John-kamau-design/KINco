import express from 'express';
import cors from 'cors';
import path from 'path';
import * as dotenv from 'dotenv';

// Import route modules directly from backend/src/routes
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

// Serve static UI files from public/
const publicPath = path.resolve(process.cwd(), 'public');
app.use(express.static(publicPath));

// Fallback to index.html for root or direct navigation
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

export default app;