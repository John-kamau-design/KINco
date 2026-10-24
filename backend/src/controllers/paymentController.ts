import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const generatePayoutCycle = async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, farmer_id, farmer_code } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Start date and end date are required.' });
    }

    let targetFarmerId: number | null = farmer_id ? parseInt(farmer_id, 10) : null;
    let targetFarmerCode: string | null = farmer_code ? farmer_code.trim().toUpperCase() : null;

    // 1. Resolve farmer_code to target IDs if farmer_code is provided
    if (!targetFarmerId && targetFarmerCode) {
      // First, check the farmers directory table
      const { data: farmerRecord } = await supabase
        .from('farmers')
        .select('id, farmer_code, phone_number, id_number')
        .ilike('farmer_code', targetFarmerCode)
        .maybeSingle();

      if (farmerRecord) {
        targetFarmerId = farmerRecord.id;
      } else {
        // Fallback: Check the users table
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .or(`farmer_code.ilike.${targetFarmerCode},id_number.eq.${targetFarmerCode}`)
          .maybeSingle();

        if (userRecord) {
          targetFarmerId = userRecord.id;
        }
      }

      if (!targetFarmerId) {
        return res.status(404).json({ message: `Farmer with code "${targetFarmerCode}" was not found in directory.` });
      }
    }

    // 2. Fetch UNPAID collections within the date range
    let query = supabase
      .from('collections')
      .select('id, driver_id, volume_liters, collected_at')
      .eq('payout_status', 'UNPAID')
      .gte('collected_at', `${start_date}T00:00:00`)
      .lte('collected_at', `${end_date}T23:59:59`);

    if (targetFarmerId) {
      query = query.eq('driver_id', targetFarmerId);
    }

    const { data: collections, error: colError } = await query;

    if (colError) throw colError;

    if (!collections || collections.length === 0) {
      return res.status(404).json({
        message: targetFarmerCode
          ? `No unbilled milk collections found for farmer ${targetFarmerCode} in the selected period.`
          : 'No unbilled milk collections found for the specified period.'
      });
    }

    // 3. Group unpaid collections per farmer
    const farmerMap: Record<string, { totalVolume: number; collectionIds: number[] }> = {};

    collections.forEach((c: any) => {
      const fid = c.driver_id;
      const vol = Number(c.volume_liters || 0);

      if (!farmerMap[fid]) {
        farmerMap[fid] = { totalVolume: 0, collectionIds: [] };
      }
      farmerMap[fid].totalVolume += vol;
      farmerMap[fid].collectionIds.push(c.id);
    });

    const insertedPayouts: any[] = [];

    // 4. Generate payout ledger records & lock collections as BILLED
    for (const [fIdStr, data] of Object.entries(farmerMap)) {
      const fId = parseInt(fIdStr, 10);
      const roundedLiters = Math.round(data.totalVolume * 100) / 100;
      const grossAmount = Math.round(roundedLiters * 45 * 100) / 100;

      const { data: newPayout, error: payoutInsertErr } = await supabase
        .from('farmer_payouts')
        .insert([{
          farmer_id: fId,
          start_date,
          end_date,
          total_liters: roundedLiters,
          rate_per_liter: 45.00,
          gross_amount: grossAmount,
          deductions: 0.00,
          net_amount: grossAmount,
          status: 'PENDING'
        }])
        .select()
        .single();

      if (payoutInsertErr) {
        console.error(`Failed creating payout for farmer ID ${fId}:`, payoutInsertErr);
        continue;
      }

      if (newPayout && data.collectionIds.length > 0) {
        await supabase
          .from('collections')
          .update({
            payout_id: newPayout.id,
            payout_status: 'BILLED'
          })
          .in('id', data.collectionIds);
      }

      insertedPayouts.push(newPayout);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully generated ${insertedPayouts.length} payout statement(s) at 45 KES/L. Unbilled collections locked.`,
      count: insertedPayouts.length,
      payouts: insertedPayouts
    });

  } catch (err: any) {
    console.error('Generate payout cycle error:', err);
    return res.status(500).json({ message: err.message || 'Error processing payout generation' });
  }
};

export const getPayoutHistory = async (req: Request, res: Response) => {
  try {
    const { data: payouts, error: payoutsError } = await supabase
      .from('farmer_payouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (payoutsError) throw payoutsError;

    if (!payouts || payouts.length === 0) {
      return res.status(200).json({ success: true, payouts: [] });
    }

    const farmerIds = Array.from(new Set(payouts.map((p: any) => p.farmer_id).filter(Boolean)));
    let farmerMap: Record<string, any> = {};

    if (farmerIds.length > 0) {
      // Query both farmers and users table to get full names
      const { data: farmersData } = await supabase
        .from('farmers')
        .select('id, full_name, farmer_code, phone_number')
        .in('id', farmerIds);

      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, phone_number')
        .in('id', farmerIds);

      if (farmersData) {
        farmersData.forEach((f: any) => { farmerMap[f.id] = f; });
      }
      if (usersData) {
        usersData.forEach((u: any) => {
          if (!farmerMap[u.id]) farmerMap[u.id] = u;
        });
      }
    }

    const enrichedPayouts = payouts.map((p: any) => {
      const matched = farmerMap[p.farmer_id] || {};
      const nameDisplay = matched.full_name 
        ? `${matched.full_name} (${matched.farmer_code || `ID: ${p.farmer_id}`})`
        : matched.phone_number || `Farmer ID: ${p.farmer_id}`;

      return {
        ...p,
        users: {
          full_name: nameDisplay,
          ...matched
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