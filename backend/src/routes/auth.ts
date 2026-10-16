import { Router } from 'express';
import { register, login, signInCheck, getDrivers } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/check-signin', signInCheck);
router.get('/drivers', getDrivers);
router.get('/users', getDrivers); // Alias endpoint for legacy client calls

export default router;