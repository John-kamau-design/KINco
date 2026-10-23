import { Router } from 'express';
import { generatePayoutCycle, getPayoutHistory } from '../controllers/paymentController';
import { authenticateToken as verifyToken } from '../middleware/auth';

const router = Router();

// Route endpoints protected by JWT authentication
router.post('/generate', verifyToken, generatePayoutCycle);
router.get('/history', verifyToken, getPayoutHistory);

export default router;