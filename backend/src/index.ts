import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/auth';
import farmerRoutes from './routes/farmers';
import milkRoutes from './routes/milk';
import apiRoutes from './routes/api';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/milk', milkRoutes);
app.use('/api', apiRoutes);

app.get('/api-health', (_req, res) => {
  res.json({ status: 'ok', message: 'KINco API operational' });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[SERVER ACTIVE] KINco Backend live on port ${PORT}`);
  });
}

export default app;