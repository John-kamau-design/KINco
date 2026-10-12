"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_js_1 = require("@supabase/supabase-js");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
const router = (0, express_1.Router)();
// Register a new farmer (Admin / Clerk)
router.post('/', async (req, res) => {
    try {
        const { full_name, phone_number, route, id_number } = req.body;
        if (!full_name || !phone_number) {
            return res.status(400).json({ error: 'Full name and phone number are required' });
        }
        // Auto-generate unique cooperative farmer code
        const farmer_code = `KNC-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data, error } = await supabase
            .from('farmers')
            .insert([
            {
                farmer_code,
                full_name,
                phone_number,
                route: route || 'Default Route',
                id_number: id_number || null,
                created_at: new Date().toISOString()
            }
        ])
            .select();
        if (error) {
            console.error('Supabase error registering farmer:', error);
            return res.status(400).json({ error: error.message });
        }
        return res.status(201).json({ message: 'Farmer registered successfully', farmer: data[0] });
    }
    catch (err) {
        console.error('Server error during farmer registration:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all farmers list
router.get('/', async (_req, res) => {
    try {
        const { data, error } = await supabase.from('farmers').select('*').order('created_at', { ascending: false });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        return res.json(data);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
