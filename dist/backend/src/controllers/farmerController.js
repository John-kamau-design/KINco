"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFarmers = exports.registerFarmer = void 0;
const bcrypt = __importStar(require("bcrypt"));
const supabase_1 = require("../config/supabase");
const registerFarmer = async (req, res) => {
    const { fullName, phoneNumber, nationalId, isShareholder } = req.body;
    try {
        const passwordHash = await bcrypt.hash('123456', 10);
        const { data: user, error: userError } = await supabase_1.supabase
            .from('users')
            .insert([
            {
                full_name: fullName,
                phone_number: phoneNumber,
                national_id: nationalId,
                password_hash: passwordHash,
                role: 'FARMER'
            }
        ])
            .select()
            .single();
        if (userError)
            return res.status(400).json({ error: userError.message });
        const generatedKID = 'KID-' + Math.floor(1000 + Math.random() * 9000);
        const { data: farmer, error: farmerError } = await supabase_1.supabase
            .from('farmers')
            .insert([
            {
                user_id: user.id,
                kid: generatedKID,
                is_shareholder: isShareholder || false
            }
        ])
            .select()
            .single();
        if (farmerError)
            return res.status(400).json({ error: farmerError.message });
        return res.status(201).json({ message: 'Farmer registered successfully', farmer, user });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.registerFarmer = registerFarmer;
const getFarmers = async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('farmers')
            .select(`
        id,
        kid,
        is_shareholder,
        users (
          full_name,
          phone_number,
          national_id
        )
      `);
        if (error)
            return res.status(400).json({ error: error.message });
        return res.status(200).json(data);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getFarmers = getFarmers;
