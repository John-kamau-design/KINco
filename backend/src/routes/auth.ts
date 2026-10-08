import { Router } from 'express';
import { signInCheck, login } from '../controllers/authController';

const router = Router();
router.post('/signin-check', signInCheck);
router.post('/login', login);

export default router;