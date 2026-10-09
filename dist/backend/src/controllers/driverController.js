"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDriverHistory = exports.submitDriverIntake = exports.getFarmerByDetail = void 0;
const supabase_1 = require("../config/supabase");
const getFarmerByDetail = async (req, res) => {
    const { identifier } = req.params;
    try {
        // 1. Check if identifier matches a National ID in users table
        const { data: userMatch, error: userErr } = await supabase_1.supabase
            .from('users')
            .select('id, full_name, phone_number, national_id, role')
            .eq('national_id', identifier)
            .eq('role', 'FARMER')
            .maybeSingle();
        if (userMatch) {
            // Fetch associated farmer record for KID
            const { data: farmerMatch } = await supabase_1.supabase
                .from('farmers')
                .select('id, kid, is_shareholder')
                .eq('user_id', userMatch.id)
                .maybeSingle();
            return res.status(200).json({
                farmer_id: farmerMatch?.id || null,
                user_id: userMatch.id,
                full_name: userMatch.full_name,
                phone_number: userMatch.phone_number,
                national_id: userMatch.national_id,
                kid: farmerMatch?.kid || 'N/A'
            });
        }
        // 2. Check if identifier matches a KID in farmers table
        const { data: kidMatch, error: kidErr } = await supabase_1.supabase
            .from('farmers')
            .select('id, user_id, kid, is_shareholder')
            .eq('kid', identifier)
            .maybeSingle();
        if (kidMatch) {
            const { data: userDetail } = await supabase_1.supabase
                .from('users')
                .select('full_name, phone_number, national_id')
                .eq('id', kidMatch.user_id)
                .single();
            return res.status(200).json({
                farmer_id: kidMatch.id,
                user_id: kidMatch.user_id,
                full_name: userDetail?.full_name || '',
                phone_number: userDetail?.phone_number || '',
                national_id: userDetail?.national_id || '',
                kid: kidMatch.kid
            });
        }
        return res.status(404).json({ message: 'Farmer not found' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getFarmerByDetail = getFarmerByDetail;
// Record milk intake & auto-calculate payment
const submitDriverIntake = async (req, res) => {
    const { driverId, farmerId, quantityLitres, shift } = req.body;
    try {
        // Validate litres (0.5 to 100.0)
        if (quantityLitres < 0.5 || quantityLitres > 100.0) {
            return res.status(400).json({ message: 'Quantity must be between 0.5L and 100.0L' });
        }
        const { data: intake, error: intakeError } = await supabase_1.supabase
            .from('milk_intakes')
            .insert([
            {
                driver_id: driverId,
                farmer_id: farmerId,
                quantity_litres: quantityLitres,
                shift: shift || 'MORNING'
            }
        ])
            .select()
            .single();
        if (intakeError)
            return res.status(400).json({ error: intakeError.message });
        // Generate unpaid payment record (45 KSh/L)
        const payableAmount = Number(quantityLitres) * 45.00;
        await supabase_1.supabase.from('payments').insert([
            {
                farmer_id: farmerId,
                intake_id: intake.id,
                rate_per_litre: 45.00,
                amount_payable: payableAmount,
                is_paid: false
            }
        ]);
        return res.status(201).json({ message: 'Intake submitted successfully', intake });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.submitDriverIntake = submitDriverIntake;
// Fetch Driver collection history filtered by time frame
const getDriverHistory = async (req, res) => {
    const { driverId } = req.params;
    const { timeframe } = req.query; // TODAY, 7 DAYS, 14 DAYS, 30 DAYS, 2 MONTHS
    try {
        let query = supabase_1.supabase
            .from('milk_intakes')
            .select(`
        id,
        quantity_litres,
        shift,
        created_at,
        farmers (
          kid,
          users (full_name)
        )
      `)
            .eq('driver_id', driverId)
            .order('created_at', { ascending: false });
        const now = new Date();
        if (timeframe === 'TODAY') {
            const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            query = query.gte('created_at', todayStart);
        }
        else if (timeframe === '7 DAYS') {
            const days7 = new Date(now.setDate(now.getDate() - 7)).toISOString();
            query = query.gte('created_at', days7);
        }
        else if (timeframe === '30 DAYS') {
            const days30 = new Date(now.setDate(now.getDate() - 30)).toISOString();
            query = query.gte('created_at', days30);
        }
        const { data, error } = await query;
        if (error)
            return res.status(400).json({ error: error.message });
        return res.status(200).json(data);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getDriverHistory = getDriverHistory;
