import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Add Agrovet Stock
export const addAgrovetItem = async (req: Request, res: Response) => {
  const { itemName, quantity, dateReceived, receivedFrom } = req.body;

  try {
    const { data, error } = await supabase
      .from('agrovet_items')
      .insert([{ item_name: itemName, quantity, date_received: dateReceived, received_from: receivedFrom }])
      .select();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Process Farmer Payment (Single or Pay All)
export const processPayment = async (req: Request, res: Response) => {
  const { farmerId, paymentIds } = req.body; // Pass array of payment IDs or empty for all

  try {
    let query = supabase
      .from('payments')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('farmer_id', farmerId)
      .eq('is_paid', false);

    if (paymentIds && paymentIds.length > 0) {
      query = query.in('id', paymentIds);
    }

    const { data, error } = await query.select();
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ message: 'Payment processed successfully', updated: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};