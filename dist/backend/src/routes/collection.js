"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const collectionController_1 = require("../controllers/collectionController");
const router = (0, express_1.Router)();
router.get('/farmer/:code', collectionController_1.getFarmerByCode);
router.post('/record', collectionController_1.recordCollection);
router.get('/summary', collectionController_1.getDriverDailySummary);
exports.default = router;
