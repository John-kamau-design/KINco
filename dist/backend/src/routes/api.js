"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const driverController_1 = require("../controllers/driverController");
const clerkController_1 = require("../controllers/clerkController");
const agrovetPaymentController_1 = require("../controllers/agrovetPaymentController");
const router = (0, express_1.Router)();
// Driver Endpoints
router.get('/driver/farmer/:identifier', driverController_1.getFarmerByDetail);
router.post('/driver/intake', driverController_1.submitDriverIntake);
router.get('/driver/history/:driverId', driverController_1.getDriverHistory);
// Clerk Endpoints
router.post('/clerk/tank-reconcile', clerkController_1.reconcileIntakeTank);
// Agrovet & Payment Endpoints
router.post('/agrovet/add', agrovetPaymentController_1.addAgrovetItem);
router.post('/payments/process', agrovetPaymentController_1.processPayment);
exports.default = router;
