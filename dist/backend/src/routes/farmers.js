"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const farmerController_1 = require("../controllers/farmerController");
const router = (0, express_1.Router)();
router.post('/register', farmerController_1.registerFarmer);
router.get('/', farmerController_1.getFarmers);
exports.default = router;
