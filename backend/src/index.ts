import express, { Request, Response } from 'express';
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

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Health Check
app.get('/api-health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'KINco API operational' });
});

// 2. API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/milk', milkRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api', apiRoutes);

// 3. Fallback 404 handler specifically for unhandled /api requests (Returns JSON, not HTML)
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// 4. Serve Static Frontend Files from public/
const publicPath = path.resolve(process.cwd(), 'public');
app.use(express.static(publicPath));

// 5. Fallback Route for Direct Page Navigation (HTML)
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[SERVER ACTIVE] KINco Backend live on port ${PORT}`);
  });
}

export default app;