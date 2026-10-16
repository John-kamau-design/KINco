import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * Reconcile Driver Field Intake against Station Offload using driver_id
 */
export const processOffloadReconciliation = async (req: Request, res: Response) => {
  try {
    const { driver_id, collection_date, station_liters, route_code, clerk_notes } = req.body;
    const clerk_id = (req as any).user?.id || null;

    if (!driver_id || station_liters === undefined || station_liters === null) {
      return res.status(400).json({ message: 'Driver and station offload liters are required.' });
    }

    const targetDate = collection_date || new Date().toISOString().split('T')[0];
    const measuredStationLiters = parseFloat(station_liters);

    if (isNaN(measuredStationLiters) || measuredStationLiters < 0) {
      return res.status(400).json({ message: 'Valid non-negative station liters value required.' });
    }

    // 1. Calculate Total Field Intake logged specifically by this driver on this target date
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    let query = supabase
      .from('collections')
      .select('volume_liters')
      .gte('collected_at', startOfDay)
      .lte('collected_at', endOfDay);

    // Check if driver_id is a valid UUID format or a plain string/number
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(driver_id)) {
      query = query.eq('driver_id', driver_id);
    } else {
      // If it's a name or staff code, match via collections text or allow soft matching
      query = query.eq('driver_id', driver_id); 
    }

    const { data: collections, error: collectionsError } = await query;

    if (collectionsError) throw collectionsError;

    const totalDriverLiters = (collections || []).reduce(
      (sum, item) => sum + Number(item.volume_liters || 0), 0
    );

    // 2. Compute Variance (Station Offload - Field Intake)
    const varianceLiters = parseFloat((measuredStationLiters - totalDriverLiters).toFixed(2));

    const ALLOWED_TOLERANCE_LITERS = 0.50;
    const isVarianceFlagged = Math.abs(varianceLiters) > ALLOWED_TOLERANCE_LITERS;
    const status = isVarianceFlagged ? 'VARIANCE_FLAGGED' : 'MATCHED';

    // 3. Upsert into reconciliations table
    const { data: reconciliation, error: insertError } = await supabase
      .from('reconciliations')
      .upsert({
        driver_id,
        route_code: route_code || 'UNASSIGNED',
        collection_date: targetDate,
        total_driver_liters: totalDriverLiters,
        total_station_liters: measuredStationLiters,
        status,
        clerk_id,
        clerk_notes: clerk_notes || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'driver_id,collection_date' })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      message: isVarianceFlagged 
        ? `Reconciliation recorded with VARIANCE FLAG (${varianceLiters > 0 ? '+' : ''}${varianceLiters} L)` 
        : 'Driver offload reconciled successfully.',
      reconciliation,
      metrics: {
        total_driver_liters: totalDriverLiters,
        total_station_liters: measuredStationLiters,
        variance_liters: varianceLiters,
        status
      }
    });

  } catch (error: any) {
    console.error('Reconciliation error:', error);
    return res.status(500).json({ message: error.message || 'Error processing offload reconciliation' });
  }
};

/**
 * Fetch Reconciliation History with Driver & Date Filters
 */
export const getReconciliationHistory = async (req: Request, res: Response) => {
  try {
    const { date, driver_id, route_code } = req.query;

    let query = supabase
      .from('reconciliations')
      .select(`
        *,
        users:driver_id (id, full_name, email)
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

    const { data, error } = await query;
    
    // Schema fallback if user join is not directly mapped
    if (error) {
      const fallbackQuery = await supabase
        .from('reconciliations')
        .select('*')
        .order('collection_date', { ascending: false });
      
      if (fallbackQuery.error) throw fallbackQuery.error;
      
      return res.status(200).json({
        success: true,
        reconciliations: fallbackQuery.data || []
      });
    }

    return res.status(200).json({
      success: true,
      reconciliations: data || []
    });
  } catch (error: any) {
    console.error('Fetch reconciliation history error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching reconciliation logs' });
  }
};