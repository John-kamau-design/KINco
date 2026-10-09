import { Router } from 'express';
import { 
  getFarmerByCode, 
  recordCollection, 
  getDriverDailySummary 
} from '../controllers/collectionController';

const router = Router();

router.get('/farmer/:code', getFarmerByCode);
router.post('/record', recordCollection);
router.get('/summary', getDriverDailySummary);

export default router;