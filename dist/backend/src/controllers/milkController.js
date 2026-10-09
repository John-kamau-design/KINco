"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordIntake = void 0;
const supabase_1 = require("../config/supabase");
const recordIntake = async (req, res) => {
    const { driverId, farmerId, quantityLitres, shift } = req.body;
    try {
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
        // Auto-calculate payable amount @ 45 KSh/Litre
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
        return res.status(201).json({ message: 'Intake recorded successfully', intake });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.recordIntake = recordIntake;
