import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * 1. GET FARMER MILK INTAKE SUMMARY FOR PAYOUT
 */
export const getFarmerPayoutSummary = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ message: 'Farmer code required.' });

    const cleanCode = code.trim().toUpperCase();

    let { data: farmer, error: farmerErr } = await supabase
      .from('farmers')
      .select('id, farmer_code, kid, full_name, phone_number, id_number, route, is_shareholder')
      .or(`farmer_code.ilike.${cleanCode},kid.eq.${cleanCode},id_number.eq.${cleanCode}`)
      .maybeSingle();

    if (!farmer) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('id, farmer_code, full_name, phone_number, id_number')
        .or(`farmer_code.ilike.${cleanCode},id_number.eq.${cleanCode}`)
        .maybeSingle();

      if (userRecord) {
        const { data: existingFarmer } = await supabase
          .from('farmers')
          .select('id, farmer_code, kid, full_name, phone_number, id_number, route, is_shareholder')
          .or(`farmer_code.ilike.${userRecord.farmer_code || cleanCode},id_number.eq.${userRecord.id_number || cleanCode}`)
          .maybeSingle();

        if (existingFarmer) {
          farmer = existingFarmer;
        } else {
          const { data: newFarmer, error: createErr } = await supabase
            .from('farmers')
            .insert([{
              full_name: userRecord.full_name || 'Farmer ' + cleanCode,
              farmer_code: userRecord.farmer_code || cleanCode,
              phone_number: userRecord.phone_number || '',
              id_number: userRecord.id_number || ''
            }])
            .select()
            .single();

          if (!createErr && newFarmer) {
            farmer = newFarmer;
          }
        }
      }
    }

    if (!farmer) {
      return res.status(404).json({ message: `Farmer with code or ID "${cleanCode}" was not found.` });
    }

    const { data: collections, error: colErr } = await supabase
      .from('collections')
      .select('id, volume_liters, collected_at, payout_status, payout_id, notes')
      .or(`farmer_id.eq.${farmer.id},driver_id.eq.${farmer.id}`)
      .order('collected_at', { ascending: false });

    if (colErr) throw colErr;

    const allCollections = collections || [];
    const unpaidCollections = allCollections.filter(c => !c.payout_status || c.payout_status === 'UNPAID');
    const totalUnpaidLiters = unpaidCollections.reduce((acc, c) => acc + Number(c.volume_liters || 0), 0);
    const estimatedPayoutKES = Math.round(totalUnpaidLiters * 45 * 100) / 100;

    return res.status(200).json({
      success: true,
      farmer,
      totalUnpaidLiters,
      estimatedPayoutKES,
      collections: allCollections
    });

  } catch (err: any) {
    console.error('Fetch farmer payout summary error:', err);
    return res.status(500).json({ message: err.message || 'Error fetching farmer summary' });
  }
};

/**
 * 2. PROCESS PAYOUT (CREATES PENDING STATEMENT)
 */
export const processFarmerPayout = async (req: Request, res: Response) => {
  try {
    const { farmer_id, collection_ids, start_date, end_date } = req.body;

    if (!farmer_id) {
      return res.status(400).json({ message: 'Farmer ID is required.' });
    }

    const targetFarmerId = parseInt(farmer_id, 10);

    let { data: validFarmer } = await supabase
      .from('farmers')
      .select('id, full_name, farmer_code')
      .eq('id', targetFarmerId)
      .maybeSingle();

    if (!validFarmer) {
      return res.status(400).json({ message: 'Invalid farmer reference.' });
    }

    let query = supabase
      .from('collections')
      .select('id, volume_liters, collected_at')
      .or(`farmer_id.eq.${validFarmer.id},driver_id.eq.${validFarmer.id}`)
      .or('payout_status.eq.UNPAID,payout_status.is.null,payout_status.eq.');

    if (collection_ids && Array.isArray(collection_ids) && collection_ids.length > 0) {
      query = query.in('id', collection_ids);
    }

    const { data: unpaidCollections, error: colErr } = await query;

    if (colErr) throw colErr;

    if (!unpaidCollections || unpaidCollections.length === 0) {
      return res.status(400).json({ message: 'No unbilled milk collections available to process for this farmer.' });
    }

    const totalLiters = unpaidCollections.reduce((acc, c) => acc + Number(c.volume_liters || 0), 0);
    const roundedLiters = Math.round(totalLiters * 100) / 100;
    const grossAmount = Math.round(roundedLiters * 45 * 100) / 100;
    const idsToLock = unpaidCollections.map(c => c.id);

    const collectionDates = unpaidCollections.map(c => new Date(c.collected_at).getTime());
    const calculatedStartDate = start_date || new Date(Math.min(...collectionDates)).toISOString().split('T')[0];
    const calculatedEndDate = end_date || new Date(Math.max(...collectionDates)).toISOString().split('T')[0];

    // Insert payout record as PENDING
    const { data: payout, error: insertErr } = await supabase
      .from('farmer_payouts')
      .insert([{
        farmer_id: validFarmer.id,
        start_date: calculatedStartDate,
        end_date: calculatedEndDate,
        total_liters: roundedLiters,
        rate_per_liter: 45.00,
        gross_amount: grossAmount,
        deductions: 0.00,
        net_amount: grossAmount,
        status: 'PENDING'
      }])
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Lock collections as BILLED
    await supabase
      .from('collections')
      .update({
        payout_id: payout.id,
        payout_status: 'BILLED'
      })
      .in('id', idsToLock);

    return res.status(200).json({
      success: true,
      message: `Pending payout statement generated for KES ${grossAmount.toLocaleString()} (${roundedLiters} Liters).`,
      payout
    });

  } catch (err: any) {
    console.error('Process farmer payout error:', err);
    return res.status(500).json({ message: err.message || 'Error processing payout' });
  }
};

/**
 * 3. MARK PENDING PAYOUT AS PAID
 */
export const markPayoutPaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Payout ID required.' });

    const { data, error } = await supabase
      .from('farmer_payouts')
      .update({ status: 'PAID' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Payout statement marked as PAID successfully!',
      payout: data
    });
  } catch (err: any) {
    console.error('Mark payout paid error:', err);
    return res.status(500).json({ message: err.message || 'Error updating payout status' });
  }
};

/**
 * 4. GET ALL PAYOUT LEDGER (COMPLETED & PENDING)
 */
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
        .select('id, full_name, farmer_code, kid, phone_number')
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
      return {
        ...p,
        users: {
          full_name: matched.full_name || `Farmer ID: ${p.farmer_id}`,
          farmer_code: matched.farmer_code || matched.kid || 'N/A',
          phone_number: matched.phone_number || ''
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