import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import farmerRoutes from './routes/farmers';
import milkRoutes from './routes/milk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/milk', milkRoutes);

app.get('/', (req, res) => {
  res.send('KINco API operational');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[SERVER ACTIVE] KINco Backend live on port ${PORT}`);
});