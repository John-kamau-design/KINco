"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.signInCheck = exports.login = exports.checkSignIn = exports.loginUser = exports.registerUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../config/supabase");
const JWT_SECRET = process.env.JWT_SECRET || 'kinco-secret-key-2026';
const registerUser = async (req, res) => {
    try {
        const full_name = req.body.full_name || req.body.fullName;
        const national_id = req.body.national_id || req.body.nationalId;
        const phone_number = req.body.phone_number || req.body.phoneNumber || req.body.phone;
        const role = req.body.role || 'DRIVER';
        const password = req.body.password;
        if (!full_name || !national_id || !password) {
            return res.status(400).json({
                message: 'Full name, National ID, and initial password are required'
            });
        }
        const { data: existingUser } = await supabase_1.supabase
            .from('users')
            .select('id')
            .eq('national_id', national_id)
            .maybeSingle();
        if (existingUser) {
            return res.status(400).json({
                message: 'A user with this National ID / Staff ID is already registered'
            });
        }
        const password_hash = await bcrypt_1.default.hash(password, 10);
        const { data, error } = await supabase_1.supabase
            .from('users')
            .insert([
            {
                full_name,
                national_id,
                phone_number: phone_number || null,
                role: role.toUpperCase(),
                password_hash,
                created_at: new Date().toISOString()
            }
        ])
            .select('id, full_name, national_id, phone_number, role, created_at')
            .single();
        if (error) {
            console.error('Supabase registration error:', error);
            throw error;
        }
        return res.status(201).json({
            message: 'User registered successfully',
            user: data
        });
    }
    catch (error) {
        console.error('Registration controller error:', error);
        return res.status(500).json({
            message: error.message || 'Server error occurred during user registration'
        });
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res) => {
    try {
        const national_id = req.body.national_id || req.body.nationalId;
        const password = req.body.password;
        if (!national_id || !password) {
            return res.status(400).json({ message: 'National ID and password are required' });
        }
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('national_id', national_id)
            .maybeSingle();
        if (error || !user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, national_id: user.national_id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                national_id: user.national_id,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Login controller error:', error);
        return res.status(500).json({ message: 'Server error during login authentication' });
    }
};
exports.loginUser = loginUser;
const checkSignIn = async (req, res) => {
    try {
        const national_id = req.body.national_id || req.body.nationalId;
        if (!national_id) {
            return res.status(400).json({ message: 'National ID is required' });
        }
        const { data: user } = await supabase_1.supabase
            .from('users')
            .select('national_id, role')
            .eq('national_id', national_id)
            .maybeSingle();
        if (!user) {
            return res.status(404).json({ message: 'National ID not registered' });
        }
        return res.status(200).json({ role: user.role });
    }
    catch (error) {
        return res.status(500).json({ message: 'Server error checking sign-in eligibility' });
    }
};
exports.checkSignIn = checkSignIn;
// Aliases to ensure backward compatibility with backend/src/routes/auth.ts imports
exports.login = exports.loginUser;
exports.signInCheck = exports.checkSignIn;
exports.register = exports.registerUser;
