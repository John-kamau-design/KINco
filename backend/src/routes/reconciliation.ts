import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { 
  processOffloadReconciliation, 
  getReconciliationHistory 
} from '../controllers/reconciliationController';

const router = Router();

/**
 * Shared Authentication Middleware
 */
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Token missing.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'kinco_secret_key_2026';
    const decoded: any = jwt.verify(token, secret);

    (req as any).user = {
      id: decoded.id || decoded.user_id || decoded.sub || decoded.userId,
      role: (decoded.role || 'CLERK').toUpperCase(),
      email: decoded.email
    };

    if (!(req as any).user.id) {
      return res.status(401).json({ message: 'Invalid token: User ID context missing.' });
    }

    next();
  } catch (err: any) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

router.post('/process', authenticateToken, processOffloadReconciliation);
router.get('/history', authenticateToken, getReconciliationHistory);

export default router;