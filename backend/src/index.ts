import express from 'express';
import cors from 'cors';
import path from 'path';
import * as dotenv from 'dotenv';
import authRoutes from './routes/auth';
import farmerRoutes from './routes/farmers';
import milkRoutes from './routes/milk';
import apiRoutes from './routes/api';
import collectionRoutes from './routes/collection';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. API Routes & Health Check
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/milk', milkRoutes);
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/collection', collectionRoutes);

app.get('/api-health', (_req, res) => {
  res.json({ status: 'ok', message: 'KINco API operational' });
});

// 2. Serve Static Frontend Files from public/
const publicPath = path.resolve(process.cwd(), 'public');
app.use(express.static(publicPath));

// 3. Fallback Route: Serve index.html for root domain and direct page navigation
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[SERVER ACTIVE] KINco Backend live on port ${PORT}`);
  });
}

export default app;