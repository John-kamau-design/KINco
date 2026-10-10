import { Router } from 'express';
import { register, login, signInCheck } from '../controllers/authController';

const router = Router();

// Routes mounted under /api/auth
router.post('/register', register);
router.post('/login', login);
router.post('/check-signin', signInCheck);

export default router;