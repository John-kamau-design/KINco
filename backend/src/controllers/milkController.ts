import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const recordIntake = async (req: Request, res: Response) => {
  const { driverId, farmerId, quantityLitres, shift } = req.body;

  try {
    const { data: intake, error: intakeError } = await supabase
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

    if (intakeError) return res.status(400).json({ error: intakeError.message });

    // Auto-calculate payable amount @ 45 KSh/Litre
    const payableAmount = Number(quantityLitres) * 45.00;

    await supabase.from('payments').insert([
      {
        farmer_id: farmerId,
        intake_id: intake.id,
        rate_per_litre: 45.00,
        amount_payable: payableAmount,
        is_paid: false
      }
    ]);

    return res.status(201).json({ message: 'Intake recorded successfully', intake });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};