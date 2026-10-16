import { Router } from 'express';
import { processOffloadReconciliation, getReconciliationHistory } from '../controllers/reconciliationController';

const router = Router();

router.post('/process', processOffloadReconciliation);
router.get('/history', getReconciliationHistory);

export default router;