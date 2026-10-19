import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Token missing.' });
  }

  try {
    // Standardized JWT secret matching authController.ts
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
    console.error('JWT Verification Error:', err.message);
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};