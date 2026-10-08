import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Reconcile driver intake against tank offload
export const reconcileIntakeTank = async (req: Request, res: Response) => {
  const { clerkId, driverId, intakeAmount } = req.body;

  try {
    const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();

    // 1. Calculate Today Actual (Sum of driver collections today)
    const { data: driverIntakes, error: sumError } = await supabase
      .from('milk_intakes')
      .select('quantity_litres')
      .eq('driver_id', driverId)
      .gte('created_at', todayStart);

    if (sumError) return res.status(400).json({ error: sumError.message });

    const actualAmount = driverIntakes.reduce((sum, item) => sum + Number(item.quantity_litres), 0);

    // 2. Compute Margin and Variation (%)
    const margin = Number(intakeAmount) - actualAmount;
    const variationPercentage = actualAmount > 0 ? (margin / actualAmount) * 100 : 0;

    // 3. Save reconciliation entry
    const { data: record, error: insertError } = await supabase
      .from('intake_tank')
      .insert([
        {
          clerk_id: clerkId,
          driver_id: driverId,
          intake_amount: intakeAmount,
          actual_amount: actualAmount,
          margin: margin,
          variation_percentage: variationPercentage
        }
      ])
      .select()
      .single();

    if (insertError) return res.status(400).json({ error: insertError.message });

    return res.status(201).json({ message: 'Tank intake recorded', record });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};