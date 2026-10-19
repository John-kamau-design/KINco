import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to validate UUID format strictly
const isValidUUID = (id: any) => {
  if (!id || typeof id !== 'string') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(id);
};

export const processOffloadReconciliation = async (req: Request, res: Response) => {
  try {
    const { driver_id, collection_date, station_liters, clerk_notes } = req.body;
    const user = (req as any).user;

    const parsedStationLiters = parseFloat(station_liters);

    if (!driver_id || isNaN(parsedStationLiters) || parsedStationLiters < 0) {
      return res.status(400).json({ 
        message: 'Valid driver ID and non-negative station volume (in liters) are required.' 
      });
    }

    const totalStationLiters = Math.round(parsedStationLiters * 100) / 100;
    const targetDate = collection_date || new Date().toISOString().split('T')[0];

    // Sanitize driver_id: If your DB uses integer IDs (e.g. "6"), convert or handle accordingly, 
    // otherwise ensure it's a valid UUID if the column is uuid type.
    const sanitizedDriverId = isValidUUID(driver_id) ? driver_id : String(driver_id);

    // 1. Fetch collection sum for the driver on target date
    const { data: collections, error: colError } = await supabase
      .from('collections')
      .select('volume_liters, collected_at')
      .eq('driver_id', sanitizedDriverId);

    if (colError) throw colError;

    const matchingCollections = (collections || []).filter(c => {
      if (!c.collected_at) return false;
      return c.collected_at.split('T')[0] === targetDate;
    });

    const rawDriverSum = matchingCollections.reduce((acc, c) => acc + Number(c.volume_liters || 0), 0);
    const totalDriverLiters = Math.round(rawDriverSum * 100) / 100;

    const rawVariance = totalStationLiters - totalDriverLiters;
    const fallbackVariance = Math.round(rawVariance * 100) / 100;
    const isFlagged = Math.abs(fallbackVariance) > 0.5;

    // Sanitize clerk_id: must be valid UUID or null
    const validClerkId = user?.id && isValidUUID(String(user.id)) ? user.id : null;

    // 2. Insert into reconciliations table (Omit variance_liters as it's database-generated)
    const insertPayload: any = {
      driver_id: sanitizedDriverId,
      collection_date: targetDate,
      total_driver_liters: totalDriverLiters,
      total_station_liters: totalStationLiters,
      status: isFlagged ? 'VARIANCE_FLAGGED' : 'MATCHED',
      clerk_notes: clerk_notes || '',
      clerk_id: validClerkId
    };

    const { data: reconData, error: reconError } = await supabase
      .from('reconciliations')
      .insert([insertPayload])
      .select()
      .single();

    if (reconError) {
      console.error('CRITICAL: Supabase reconciliation insert failed:', reconError);
      return res.status(500).json({ 
        message: `Failed to store reconciliation record: ${reconError.message}` 
      });
    }

    const finalVariance = reconData?.variance_liters !== undefined ? reconData.variance_liters : fallbackVariance;

    return res.status(200).json({
      success: true,
      message: isFlagged ? 'Reconciliation offload recorded with variance flag.' : 'Reconciliation offload matched successfully.',
      metrics: {
        total_driver_liters: totalDriverLiters,
        total_station_liters: totalStationLiters,
        variance_liters: finalVariance,
        status: reconData?.status || (isFlagged ? 'VARIANCE_FLAGGED' : 'MATCHED')
      },
      reconciliation: reconData
    });

  } catch (err: any) {
    console.error('Process offload reconciliation error:', err);
    return res.status(500).json({ message: err.message || 'Error processing offload reconciliation' });
  }
};

export const getReconciliationHistory = async (req: Request, res: Response) => {
  try {
    const { date, driver_id, route_code } = req.query;

    let query = supabase
      .from('reconciliations')
      .select(`
        *,
        users:driver_id (id, full_name, national_id, phone_number, email)
      `)
      .order('collection_date', { ascending: false });

    if (date) {
      query = query.eq('collection_date', date as string);
    }
    if (driver_id) {
      query = query.eq('driver_id', driver_id as string);
    }
    if (route_code) {
      query = query.eq('route_code', route_code as string);
    }

    let { data, error } = await query;
    
    if (error || !data || data.length === 0) {
      const fallbackQuery = await supabase
        .from('reconciliations')
        .select('*')
        .order('collection_date', { ascending: false });
      
      if (fallbackQuery.error) throw fallbackQuery.error;
      data = fallbackQuery.data || [];
    }

    const driverIds = Array.from(new Set((data || []).map((r: any) => r.driver_id).filter(Boolean)));
    let userMap: Record<string, any> = {};

    if (driverIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, national_id, phone_number, email')
        .in('id', driverIds);

      if (usersData) {
        userMap = usersData.reduce((acc: any, u: any) => {
          acc[u.id] = u;
          return acc;
        }, {});
      }
    }

    const enrichedReconciliations = (data || []).map((item: any) => {
      const matchedUser = item.users || userMap[item.driver_id] || {};
      const driverName = matchedUser.full_name || matchedUser.national_id || matchedUser.phone_number || matchedUser.email || `Driver (${String(item.driver_id || '').substring(0, 8)})`;

      return {
        ...item,
        users: {
          full_name: driverName,
          ...matchedUser
        },
        driver_name: driverName
      };
    });

    return res.status(200).json({
      success: true,
      reconciliations: enrichedReconciliations,
      logs: enrichedReconciliations
    });

  } catch (error: any) {
    console.error('Fetch reconciliation history error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching reconciliation logs' });
  }
};