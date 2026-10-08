import { Router } from 'express';
import { recordIntake } from '../controllers/milkController';

const router = Router();
router.post('/intake', recordIntake);

export default router;