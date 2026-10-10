"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const router = (0, express_1.Router)();
// Routes mounted under /api/auth
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.post('/check-signin', authController_1.signInCheck);
exports.default = router;
