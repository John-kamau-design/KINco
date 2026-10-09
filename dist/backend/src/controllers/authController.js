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
exports.login = exports.signInCheck = void 0;
const supabase_1 = require("../config/supabase");
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const signInCheck = async (req, res) => {
    const { nationalId, fullName, password, phoneNumber } = req.body;
    try {
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('id, role')
            .eq('national_id', nationalId)
            .single();
        if (error || !user) {
            return res.status(404).json({ message: 'ID number not yet registered' });
        }
        return res.status(200).json({
            message: 'ID exists',
            role: user.role
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.signInCheck = signInCheck;
const login = async (req, res) => {
    const { nationalId, password } = req.body;
    try {
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('national_id', nationalId)
            .single();
        if (error || !user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, nationalId: user.national_id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
        return res.status(200).json({
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                role: user.role
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.login = login;
