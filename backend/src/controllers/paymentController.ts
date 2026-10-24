import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const generatePayoutCycle = async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Start date and end date are required.' });
    }

    // 1. Fetch collections within the target date range
    const { data: collections, error: colError } = await supabase
      .from('collections')
      .select('driver_id, volume_liters, collected_at')
      .gte('collected_at', `${start_date}T00:00:00`)
      .lte('collected_at', `${end_date}T23:59:59`);

    if (colError) throw colError;

    if (!collections || collections.length === 0) {
      return res.status(404).json({ message: 'No milk collections found for the specified period.' });
    }

    // 2. Aggregate total liters per farmer (using driver_id as farmer reference)
    const farmerTotals: Record<string, number> = {};
    collections.forEach((c: any) => {
      const farmerId = c.driver_id;
      const volume = Number(c.volume_liters || 0);
      farmerTotals[farmerId] = (farmerTotals[farmerId] || 0) + volume;
    });

    // 3. Construct payout ledger payload items
    const payoutRecords = Object.entries(farmerTotals).map(([farmer_id, totalLiters]) => {
      const roundedLiters = Math.round(totalLiters * 100) / 100;
      const grossAmount = Math.round(roundedLiters * 45 * 100) / 100; // Fixed rate: 45 KES/Litre

      return {
        farmer_id: parseInt(farmer_id, 10),
        start_date,
        end_date,
        total_liters: roundedLiters,
        rate_per_liter: 45.00,
        gross_amount: grossAmount,
        deductions: 0.00,
        net_amount: grossAmount,
        status: 'PENDING'
      };
    });

    // 4. Insert generated payouts into farmer_payouts ledger table
    const { data: insertedPayouts, error: insertError } = await supabase
      .from('farmer_payouts')
      .insert(payoutRecords)
      .select();

    if (insertError) {
      console.error('CRITICAL: Payout ledger insert failed:', insertError);
      return res.status(500).json({ message: `Failed to generate payouts: ${insertError.message}` });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully generated ${payoutRecords.length} payout statements for period ${start_date} to ${end_date}.`,
      count: payoutRecords.length,
      payouts: insertedPayouts
    });

  } catch (err: any) {
    console.error('Generate payout cycle error:', err);
    return res.status(500).json({ message: err.message || 'Error processing payout generation' });
  }
};

export const getPayoutHistory = async (req: Request, res: Response) => {
  try {
    // 1. Query raw payout records from farmer_payouts
    const { data: payouts, error: payoutsError } = await supabase
      .from('farmer_payouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (payoutsError) throw payoutsError;

    if (!payouts || payouts.length === 0) {
      return res.status(200).json({
        success: true,
        payouts: []
      });
    }

    // 2. Safely map matching user profiles
    const farmerIds = Array.from(new Set(payouts.map((p: any) => p.farmer_id).filter(Boolean)));
    let userMap: Record<string, any> = {};

    if (farmerIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, national_id, phone_number, email')
        .in('id', farmerIds);

      if (usersData) {
        userMap = usersData.reduce((acc: any, u: any) => {
          acc[u.id] = u;
          return acc;
        }, {});
      }
    }

    // 3. Enrich payouts with farmer details
    const enrichedPayouts = payouts.map((p: any) => {
      const matchedUser = userMap[p.farmer_id] || {};
      return {
        ...p,
        users: {
          full_name: matchedUser.full_name || matchedUser.phone_number || `Farmer ID: ${p.farmer_id}`,
          ...matchedUser
        }
      };
    });

    return res.status(200).json({
      success: true,
      payouts: enrichedPayouts
    });

  } catch (err: any) {
    console.error('Fetch payouts error:', err);
    return res.status(500).json({ message: err.message || 'Error fetching payout history' });
  }
};