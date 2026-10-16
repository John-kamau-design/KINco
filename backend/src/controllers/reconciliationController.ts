import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * Reconcile Driver Field Intake against Station Offload
 */
export const processOffloadReconciliation = async (req: Request, res: Response) => {
  try {
    const { driver_id, route_code, collection_date, station_liters, clerk_notes } = req.body;
    const clerk_id = (req as any).user?.id || null;

    if (!route_code || station_liters === undefined || station_liters === null) {
      return res.status(400).json({ message: 'Route code and station offload liters are required.' });
    }

    const targetDate = collection_date || new Date().toISOString().split('T')[0];
    const measuredStationLiters = parseFloat(station_liters);

    if (isNaN(measuredStationLiters) || measuredStationLiters < 0) {
      return res.status(400).json({ message: 'Valid non-negative station liters value required.' });
    }

    // 1. Calculate Total Field Intake logged by Driver for this route and date
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    let query = supabase
      .from('collections')
      .select('volume_liters')
      .gte('collected_at', startOfDay)
      .lte('collected_at', endOfDay);

    if (driver_id) {
      query = query.eq('driver_id', driver_id);
    }

    const { data: collections, error: collectionsError } = await query;

    if (collectionsError) throw collectionsError;

    const totalDriverLiters = (collections || []).reduce(
      (sum, item) => sum + Number(item.volume_liters || 0), 0
    );

    // 2. Compute Variance (Station Offload - Field Intake)
    const varianceLiters = parseFloat((measuredStationLiters - totalDriverLiters).toFixed(2));

    // Flag variance if discrepancy exceeds 0.50 Liters
    const ALLOWED_TOLERANCE_LITERS = 0.50;
    const isVarianceFlagged = Math.abs(varianceLiters) > ALLOWED_TOLERANCE_LITERS;
    const status = isVarianceFlagged ? 'VARIANCE_FLAGGED' : 'MATCHED';

    // 3. Insert or Update Reconciliation Log
    const { data: reconciliation, error: insertError } = await supabase
      .from('reconciliations')
      .upsert({
        driver_id,
        route_code,
        collection_date: targetDate,
        total_driver_liters: totalDriverLiters,
        total_station_liters: measuredStationLiters,
        status,
        clerk_id,
        clerk_notes: clerk_notes || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'route_code,collection_date' })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      message: isVarianceFlagged 
        ? `Reconciliation recorded with VARIANCE FLAG (${varianceLiters > 0 ? '+' : ''}${varianceLiters} L)` 
        : 'Route offload reconciled successfully.',
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
 * Fetch Reconciliation History with Route & Date Filters
 */
export const getReconciliationHistory = async (req: Request, res: Response) => {
  try {
    const { date, route_code } = req.query;

    let query = supabase
      .from('reconciliations')
      .select('*')
      .order('collection_date', { ascending: false });

    if (date) {
      query = query.eq('collection_date', date as string);
    }
    if (route_code) {
      query = query.eq('route_code', route_code as string);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      success: true,
      reconciliations: data || []
    });
  } catch (error: any) {
    console.error('Fetch reconciliation history error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching reconciliation logs' });
  }
};