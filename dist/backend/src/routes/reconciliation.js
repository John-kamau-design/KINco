"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const reconciliationController_1 = require("../controllers/reconciliationController");
const router = (0, express_1.Router)();
/**
 * Shared Authentication Middleware
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. Token missing.' });
    }
    try {
        const secret = process.env.JWT_SECRET || 'kinco_secret_key_2026';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = {
            id: decoded.id || decoded.user_id || decoded.sub || decoded.userId,
            role: (decoded.role || 'CLERK').toUpperCase(),
            email: decoded.email
        };
        if (!req.user.id) {
            return res.status(401).json({ message: 'Invalid token: User ID context missing.' });
        }
        next();
    }
    catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};
router.post('/process', authenticateToken, reconciliationController_1.processOffloadReconciliation);
router.get('/history', authenticateToken, reconciliationController_1.getReconciliationHistory);
exports.default = router;
