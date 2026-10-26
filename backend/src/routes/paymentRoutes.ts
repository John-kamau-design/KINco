import { Router } from 'express';
import { 
  getFarmerPayoutSummary, 
  processFarmerPayout, 
  markPayoutPaid,
  getPayoutHistory 
} from '../controllers/paymentController';
import { authenticateToken as verifyToken } from '../middleware/auth';

const router = Router();

router.use(verifyToken);

router.get('/farmer-summary/:code', getFarmerPayoutSummary);
router.post('/process-farmer-payout', processFarmerPayout);
router.post('/pay/:id', markPayoutPaid);
router.get('/history', getPayoutHistory);

export default router;