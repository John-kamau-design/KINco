"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPayment = exports.addAgrovetItem = void 0;
const supabase_1 = require("../config/supabase");
// Add Agrovet Stock
const addAgrovetItem = async (req, res) => {
    const { itemName, quantity, dateReceived, receivedFrom } = req.body;
    try {
        const { data, error } = await supabase_1.supabase
            .from('agrovet_items')
            .insert([{ item_name: itemName, quantity, date_received: dateReceived, received_from: receivedFrom }])
            .select();
        if (error)
            return res.status(400).json({ error: error.message });
        return res.status(201).json(data);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.addAgrovetItem = addAgrovetItem;
// Process Farmer Payment (Single or Pay All)
const processPayment = async (req, res) => {
    const { farmerId, paymentIds } = req.body; // Pass array of payment IDs or empty for all
    try {
        let query = supabase_1.supabase
            .from('payments')
            .update({ is_paid: true, paid_at: new Date().toISOString() })
            .eq('farmer_id', farmerId)
            .eq('is_paid', false);
        if (paymentIds && paymentIds.length > 0) {
            query = query.in('id', paymentIds);
        }
        const { data, error } = await query.select();
        if (error)
            return res.status(400).json({ error: error.message });
        return res.status(200).json({ message: 'Payment processed successfully', updated: data });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.processPayment = processPayment;
