import { Router } from 'express';
import { 
  getFarmerPayoutSummary, 
  processFarmerPayout, 
  getPayoutHistory 
} from '../controllers/paymentController';
import { authenticateToken as verifyToken } from '../middleware/auth'; // Added curly braces for named export

const router = Router();

// Secure all payment routes with authentication middleware
router.use(verifyToken);

// Fetch a specific farmer's milk intake records and payment summary
router.get('/farmer-summary/:code', getFarmerPayoutSummary);

// Process and disburse payout for unbilled collections of a selected farmer
router.post('/process-farmer-payout', processFarmerPayout);

// Fetch completed historical payout ledger statements
router.get('/history', getPayoutHistory);

export default router;