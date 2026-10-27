"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const collectionController_1 = require("../controllers/collectionController");
const router = (0, express_1.Router)();
/**
 * Authentication Middleware
 * Decodes the Bearer token, normalizes the user object, and attaches it to req.user
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
        // Normalize user payload so controllers can reliably read req.user.id and req.user.role
        req.user = {
            id: decoded.id || decoded.user_id || decoded.sub || decoded.userId,
            role: (decoded.role || 'DRIVER').toUpperCase(),
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
// Apply authentication middleware to all protected collection routes
router.get('/farmer/:code', authenticateToken, collectionController_1.getFarmerByCode);
router.post('/record', authenticateToken, collectionController_1.recordCollection);
router.get('/summary', authenticateToken, collectionController_1.getDriverDailySummary);
router.get('/driver-summary', authenticateToken, collectionController_1.getDriverDailySummary); // Alias route for redundancy
router.get('/all', authenticateToken, collectionController_1.getAllCollections);
exports.default = router;
