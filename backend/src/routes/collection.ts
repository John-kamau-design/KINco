import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { 
  getFarmerByCode, 
  recordCollection, 
  getDriverDailySummary 
} from '../controllers/collectionController';

const router = Router();

/**
 * Authentication Middleware
 * Decodes the Bearer token, normalizes the user object, and attaches it to req.user
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

    // Normalize user payload so controllers can reliably read req.user.id and req.user.role
    (req as any).user = {
      id: decoded.id || decoded.user_id || decoded.sub || decoded.userId,
      role: (decoded.role || 'DRIVER').toUpperCase(),
      email: decoded.email
    };

    if (!(req as any).user.id) {
      return res.status(401).json({ message: 'Invalid token: User ID context missing.' });
    }

    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

// Apply authentication middleware to all protected collection routes
router.get('/farmer/:code', authenticateToken, getFarmerByCode);
router.post('/record', authenticateToken, recordCollection);
router.get('/summary', authenticateToken, getDriverDailySummary);
router.get('/driver-summary', authenticateToken, getDriverDailySummary); // Alias route for redundancy

export default router;