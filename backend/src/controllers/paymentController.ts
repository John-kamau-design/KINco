import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const generatePayoutCycle = async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, farmer_id, farmer_code } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Start date and end date are required.' });
    }

    let targetFarmerId = farmer_id ? parseInt(farmer_id, 10) : null;

    // Optional: Resolve farmer_code to user ID if provided
    if (!targetFarmerId && farmer_code) {
      const { data: farmerUser } = await supabase
        .from('users')
        .select('id')
        .or(`farmer_code.eq.${farmer_code.trim().toUpperCase()},id_number.eq.${farmer_code.trim()}`)
        .maybeSingle();

      if (farmerUser) {
        targetFarmerId = farmerUser.id;
      } else {
        return res.status(404).json({ message: `Farmer with code "${farmer_code}" was not found.` });
      }
    }

    // 1. Fetch ONLY UNPAID collections within date range (filtered by specific farmer if requested)
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
        message: targetFarmerId
          ? 'No unbilled milk collections found for this farmer in the selected period.'
          : 'No unbilled milk collections found for the specified period.'
      });
    }

    // 2. Group unpaid collections by farmer and track associated collection IDs
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

    // 3. Process payout statement and lock collections for each farmer individually
    for (const [fIdStr, data] of Object.entries(farmerMap)) {
      const fId = parseInt(fIdStr, 10);
      const roundedLiters = Math.round(data.totalVolume * 100) / 100;
      const grossAmount = Math.round(roundedLiters * 45 * 100) / 100;

      // Insert individual farmer payout record
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

      // Mark the corresponding collection records as BILLED to prevent duplicate payouts
      if (newPayout && data.collectionIds.length > 0) {
        const { error: markBilledErr } = await supabase
          .from('collections')
          .update({
            payout_id: newPayout.id,
            payout_status: 'BILLED'
          })
          .in('id', data.collectionIds);

        if (markBilledErr) {
          console.error(`Warning: Failed marking collections as BILLED for payout ${newPayout.id}:`, markBilledErr);
        }
      }

      insertedPayouts.push(newPayout);
    }

    if (insertedPayouts.length === 0) {
      return res.status(500).json({ message: 'Failed to generate payout statements.' });
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
      return res.status(200).json({
        success: true,
        payouts: []
      });
    }

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