import { Router } from 'express';
import { registerFarmer, getFarmers } from '../controllers/farmerController';

const router = Router();
router.post('/register', registerFarmer);
router.get('/', getFarmers);

export default router;