import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * 1. GET FARMER SUMMARY (Intake history, Total Paid KES, Total Unpaid KES)
 */
export const getFarmerPayoutSummary = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ message: 'Farmer code required.' });

    const cleanCode = code.trim().toUpperCase();
    const candidateIds: number[] = [];

    // Search in farmers table
    let { data: farmer } = await supabase
      .from('farmers')
      .select('id, farmer_code, kid, full_name, phone_number, id_number, route, is_shareholder')
      .or(`farmer_code.ilike.${cleanCode},kid.eq.${cleanCode},id_number.eq.${cleanCode}`)
      .maybeSingle();

    if (farmer && farmer.id) candidateIds.push(farmer.id);

    // Search in users table fallback
    const { data: userRecords } = await supabase
      .from('users')
      .select('id, farmer_code, full_name, phone_number, id_number')
      .or(`farmer_code.ilike.${cleanCode},id_number.eq.${cleanCode}`);

    if (userRecords && userRecords.length > 0) {
      userRecords.forEach((u: any) => candidateIds.push(u.id));
      if (!farmer) {
        const u = userRecords[0];
        farmer = {
          id: u.id,
          farmer_code: u.farmer_code || cleanCode,
          kid: null,
          full_name: u.full_name,
          phone_number: u.phone_number,
          id_number: u.id_number,
          route: 'Default Route',
          is_shareholder: false
        };
      }
    }

    if (!farmer && candidateIds.length === 0) {
      return res.status(404).json({ message: `Farmer with code or ID "${cleanCode}" was not found.` });
    }

    const uniqueIds = Array.from(new Set(candidateIds));

    // Fetch all collections recorded for this farmer
    let query = supabase
      .from('collections')
      .select('id, volume_liters, collected_at, payout_status, payout_id, notes, farmer_id, driver_id')
      .order('collected_at', { ascending: false });

    if (uniqueIds.length > 0) {
      const idListStr = uniqueIds.join(',');
      query = query.or(`farmer_id.in.(${idListStr}),driver_id.in.(${idListStr})`);
    }

    const { data: collections, error: colErr } = await query;
    if (colErr) throw colErr;

    const allCollections = collections || [];

    // Separate paid vs unpaid collections
    let totalUnpaidLiters = 0;
    let totalPaidLiters = 0;

    allCollections.forEach(c => {
      const vol = Number(c.volume_liters || 0);
      const isPaid = c.payout_status && (c.payout_status.toUpperCase() === 'PAID' || c.payout_status.toUpperCase() === 'BILLED');
      if (isPaid) {
        totalPaidLiters += vol;
      } else {
        totalUnpaidLiters += vol;
      }
    });

    const totalUnpaidKES = Math.round(totalUnpaidLiters * 45 * 100) / 100;
    const totalPaidKES = Math.round(totalPaidLiters * 45 * 100) / 100;

    return res.status(200).json({
      success: true,
      farmer,
      totalUnpaidLiters,
      totalUnpaidKES,
      totalPaidLiters,
      totalPaidKES,
      collections: allCollections
    });

  } catch (err: any) {
    console.error('Fetch farmer payout summary error:', err);
    return res.status(500).json({ message: err.message || 'Error fetching farmer summary' });
  }
};

/**
 * 2. PROCESS DIRECT FARMER PAYOUT (Marks collections as PAID)
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
      const { data: userBackup } = await supabase
        .from('users')
        .select('id, full_name, farmer_code, phone_number, id_number')
        .eq('id', targetFarmerId)
        .maybeSingle();

      if (userBackup) {
        const { data: syncedFarmer } = await supabase
          .from('farmers')
          .insert([{
            id: userBackup.id,
            full_name: userBackup.full_name || 'Farmer ' + targetFarmerId,
            farmer_code: userBackup.farmer_code || `KLF${targetFarmerId}`,
            phone_number: userBackup.phone_number || '',
            id_number: userBackup.id_number || ''
          }])
          .select()
          .single();

        if (syncedFarmer) validFarmer = syncedFarmer;
      }
    }

    if (!validFarmer) {
      return res.status(400).json({ message: 'Could not resolve a valid farmer record for payout.' });
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
      return res.status(400).json({ message: 'No unpaid milk collections available to process for this farmer.' });
    }

    const totalLiters = unpaidCollections.reduce((acc, c) => acc + Number(c.volume_liters || 0), 0);
    const roundedLiters = Math.round(totalLiters * 100) / 100;
    const grossAmount = Math.round(roundedLiters * 45 * 100) / 100;
    const idsToLock = unpaidCollections.map(c => c.id);

    const collectionDates = unpaidCollections.map(c => new Date(c.collected_at).getTime());
    const calculatedStartDate = start_date || new Date(Math.min(...collectionDates)).toISOString().split('T')[0];
    const calculatedEndDate = end_date || new Date(Math.max(...collectionDates)).toISOString().split('T')[0];

    // Create completed payout record in farmer_payouts
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
        status: 'PAID'
      }])
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Lock collections as PAID
    await supabase
      .from('collections')
      .update({
        payout_id: payout.id,
        payout_status: 'PAID'
      })
      .in('id', idsToLock);

    return res.status(200).json({
      success: true,
      message: `Successfully processed payout of KES ${grossAmount.toLocaleString()} for ${roundedLiters} Liters!`,
      payout
    });

  } catch (err: any) {
    console.error('Process farmer payout error:', err);
    return res.status(500).json({ message: err.message || 'Error processing payout' });
  }
};

/**
 * 3. GET QUEUED UNPAID INTAKES FOR PENDING LOGS TAB
 */
export const getPendingPayoutLogs = async (req: Request, res: Response) => {
  try {
    const { data: collections, error } = await supabase
      .from('collections')
      .select('id, farmer_id, driver_id, volume_liters, collected_at, payout_status')
      .or('payout_status.eq.UNPAID,payout_status.is.null,payout_status.eq.')
      .order('collected_at', { ascending: false });

    if (error) throw error;

    if (!collections || collections.length === 0) {
      return res.status(200).json({ success: true, pendingLogs: [] });
    }

    const farmerIds = Array.from(new Set(collections.map(c => c.farmer_id || c.driver_id).filter(Boolean)));
    let farmerMap: Record<string, any> = {};

    if (farmerIds.length > 0) {
      const { data: farmersData } = await supabase
        .from('farmers')
        .select('id, full_name, farmer_code, kid')
        .in('id', farmerIds);

      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, farmer_code')
        .in('id', farmerIds);

      if (farmersData) farmersData.forEach((f: any) => { farmerMap[f.id] = f; });
      if (usersData) usersData.forEach((u: any) => { if (!farmerMap[u.id]) farmerMap[u.id] = u; });
    }

    const enriched = collections.map(c => {
      const targetId = c.farmer_id || c.driver_id;
      const farmer = farmerMap[targetId] || {};
      const vol = Number(c.volume_liters || 0);
      return {
        ...c,
        farmer_id: targetId,
        farmer_name: farmer.full_name || `Farmer (${targetId})`,
        farmer_code: farmer.farmer_code || farmer.kid || 'N/A',
        gross_amount: Math.round(vol * 45 * 100) / 100
      };
    });

    return res.status(200).json({ success: true, pendingLogs: enriched });

  } catch (err: any) {
    console.error('Fetch pending logs error:', err);
    return res.status(500).json({ message: err.message || 'Error fetching pending logs' });
  }
};

/**
 * 4. GET COMPLETED PAYOUT HISTORY
 */
export const getPayoutHistory = async (req: Request, res: Response) => {
  try {
    const { data: payouts, error: payoutsError } = await supabase
      .from('farmer_payouts')
      .select('*')
      .eq('status', 'PAID')
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

      if (farmersData) farmersData.forEach((f: any) => { farmerMap[f.id] = f; });
      if (usersData) usersData.forEach((u: any) => { if (!farmerMap[u.id]) farmerMap[u.id] = u; });
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