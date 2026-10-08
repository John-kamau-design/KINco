import { Router } from 'express';
import { getFarmerByDetail, submitDriverIntake, getDriverHistory } from '../controllers/driverController';
import { reconcileIntakeTank } from '../controllers/clerkController';
import { addAgrovetItem, processPayment } from '../controllers/agrovetPaymentController';

const router = Router();

// Driver Endpoints
router.get('/driver/farmer/:identifier', getFarmerByDetail);
router.post('/driver/intake', submitDriverIntake);
router.get('/driver/history/:driverId', getDriverHistory);

// Clerk Endpoints
router.post('/clerk/tank-reconcile', reconcileIntakeTank);

// Agrovet & Payment Endpoints
router.post('/agrovet/add', addAgrovetItem);
router.post('/payments/process', processPayment);

export default router;