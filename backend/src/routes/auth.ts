import { Router } from 'express';
import { register, login, signInCheck } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/check-signin', signInCheck);

export default router;