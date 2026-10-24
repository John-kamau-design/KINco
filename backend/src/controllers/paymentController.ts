import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const generatePayoutCycle = async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, farmer_id, farmer_code } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Start date and end date are required.' });
    }

    let targetFarmerIds: number[] = farmer_id ? [parseInt(farmer_id, 10)] : [];
    let targetFarmerCode: string | null = farmer_code ? farmer_code.trim().toUpperCase() : null;

    // 1. Resolve farmer_code to all candidate IDs across both tables
    if (targetFarmerCode) {
      // Check farmers table
      const { data: farmerRecords } = await supabase
        .from('farmers')
        .select('id, farmer_code, phone_number, id_number')
        .or(`farmer_code.ilike.${targetFarmerCode},id_number.eq.${targetFarmerCode}`);

      if (farmerRecords && farmerRecords.length > 0) {
        farmerRecords.forEach((f: any) => targetFarmerIds.push(f.id));
      }

      // Check users table
      const { data: userRecords } = await supabase
        .from('users')
        .select('id, farmer_code, id_number')
        .or(`farmer_code.ilike.${targetFarmerCode},id_number.eq.${targetFarmerCode}`);

      if (userRecords && userRecords.length > 0) {
        userRecords.forEach((u: any) => targetFarmerIds.push(u.id));
      }

      // Deduplicate found IDs
      targetFarmerIds = Array.from(new Set(targetFarmerIds));

      if (targetFarmerIds.length === 0) {
        return res.status(404).json({ message: `Farmer with code "${targetFarmerCode}" was not found in directory.` });
      }
    }

    // 2. Build collection query covering full inclusive date bounds
    // Handle full day boundaries: 00:00:00.000 to 23:59:59.999
    const formattedStart = `${start_date}T00:00:00.000Z`;
    const formattedEnd = `${end_date}T23:59:59.999Z`;

    let query = supabase
      .from('collections')
      .select('id, driver_id, volume_liters, collected_at, payout_status')
      .or('payout_status.eq.UNPAID,payout_status.is.null') // Handles new or existing unbilled records
      .gte('collected_at', formattedStart)
      .lte('collected_at', formattedEnd);

    if (targetFarmerIds.length > 0) {
      query = query.in('driver_id', targetFarmerIds);
    }

    const { data: collections, error: colError } = await query;

    if (colError) {
      console.error('Collection fetch error:', colError);
      throw colError;
    }

    if (!collections || collections.length === 0) {
      return res.status(404).json({
        message: targetFarmerCode
          ? `No unbilled milk collections found for farmer ${targetFarmerCode} between ${start_date} and ${end_date}.`
          : `No unbilled milk collections found between ${start_date} and ${end_date}.`
      });
    }

    // 3. Group collections by farmer ID
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

    // 4. Generate payout ledger records & mark collections as BILLED
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

      // Lock collections as BILLED so they cannot be paid again
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
      message: `Successfully generated ${insertedPayouts.length} payout statement(s) for ${start_date} to ${end_date} at 45 KES/L.`,
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