import express from 'express';
import cors from 'cors';
import path from 'path';
import * as dotenv from 'dotenv';
import authRoutes from './routes/auth';
import farmerRoutes from './routes/farmers';
import milkRoutes from './routes/milk';
import apiRoutes from './routes/api';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/milk', milkRoutes);
app.use('/api', apiRoutes);

app.get('/api-health', (req, res) => {
  res.send('KINco API operational');
});

// 2. Serve Frontend Static Files
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// 3. Fallback route to serve index.html for root page
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[SERVER ACTIVE] KINco Backend live on port ${PORT}`);
  });
}

export default app;