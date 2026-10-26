import { Router } from 'express';
import { 
  getFarmerPayoutSummary, 
  processFarmerPayout, 
  getPendingPayoutLogs,
  getPayoutHistory 
} from '../controllers/paymentController';
import { authenticateToken as verifyToken } from '../middleware/auth';

const router = Router();

router.use(verifyToken);

router.get('/farmer-summary/:code', getFarmerPayoutSummary);
router.post('/process-farmer-payout', processFarmerPayout);
router.get('/pending-logs', getPendingPayoutLogs);
router.get('/history', getPayoutHistory);

export default router;