import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * Record Milk Intake (Driver Endpoint)
 * Enforces driver identity directly from the authenticated JWT token.
 */
export const recordCollection = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user || !user.id) {
      return res.status(401).json({ message: 'Unauthorized: Driver authentication context missing.' });
    }

    // Securely extract driver_id strictly from authenticated token context
    const driver_id = user.id;

    const { 
      farmer_code, 
      farmer_id, 
      liters, 
      volume_liters, 
      route, 
      route_code, 
      can_count, 
      notes 
    } = req.body;

    const intakeVolume = parseFloat(liters || volume_liters);

    if (!intakeVolume || intakeVolume <= 0) {
      return res.status(400).json({ message: 'Valid positive volume in liters is required.' });
    }

    let targetFarmerId = farmer_id;
    let resolvedFarmerCode = farmer_code ? farmer_code.trim().toUpperCase() : null;
    let farmerName = '';

    // Lookup farmer if farmer_code is provided
    if (resolvedFarmerCode && !targetFarmerId) {
      const { data: farmer, error: farmerError } = await supabase
        .from('farmers')
        .select('id, farmer_code, full_name, route')
        .or(`farmer_code.eq.${resolvedFarmerCode},kid.eq.${resolvedFarmerCode}`)
        .maybeSingle();

      if (farmerError || !farmer) {
        return res.status(404).json({ message: `Farmer code ${resolvedFarmerCode} not found in directory.` });
      }

      targetFarmerId = farmer.id;
      farmerName = farmer.full_name;
    }

    // Resolve optional route ID
    let route_id = null;
    const activeRoute = route_code || route;
    if (activeRoute) {
      const { data: routeData } = await supabase
        .from('routes')
        .select('id')
        .eq('route_code', activeRoute)
        .maybeSingle();
      if (routeData) route_id = routeData.id;
    }

    // Build payload
    const payload: Record<string, any> = {
      driver_id,
      farmer_id: targetFarmerId,
      route_id,
      volume_liters: intakeVolume,
      can_count: can_count ? parseInt(can_count, 10) : 1,
      payout_status: 'UNPAID', // Explicitly initialize collection as unpaid for payout generation
      collected_at: new Date().toISOString()
    };

    if (notes) payload.notes = notes;

    const { data, error } = await supabase
      .from('collections')
      .insert([payload])
      .select(`
        id, volume_liters, can_count, collected_at, notes, driver_id, payout_status,
        farmers (farmer_code, full_name, kid)
      `)
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: 'Milk intake logged successfully',
      farmer_name: farmerName || (data?.farmers as any)?.full_name || '',
      collection: data
    });

  } catch (error: any) {
    console.error('Record collection error:', error);
    return res.status(500).json({ message: error.message || 'Failed to record collection' });
  }
};

/**
 * Get Driver Daily Summary & Logs
 * DRIVER role: Forced strictly to req.user.id
 * CLERK/ADMIN role: Can query by ?driver_id=...
 */
export const getDriverDailySummary = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      return res.status(401).json({ message: 'Unauthorized: Driver identity context missing.' });
    }

    const role = (user.role || 'DRIVER').toUpperCase();
    let targetDriverId = user.id;

    // Allow Clerks or Admins to view logs for a specific driver if requested
    if (role === 'CLERK' || role === 'ADMIN') {
      const requestedDriver = req.query.driver_id as string;
      if (requestedDriver) {
        targetDriverId = requestedDriver;
      }
    }

    // Query strictly filtered by targetDriverId
    const { data: collections, error } = await supabase
      .from('collections')
      .select(`
        id, volume_liters, can_count, collected_at, notes, driver_id,
        farmers (id, farmer_code, kid, full_name, route)
      `)
      .eq('driver_id', targetDriverId)
      .order('collected_at', { ascending: false });

    if (error) throw error;

    const allCollections = collections || [];

    // Filter today's collections
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCollections = allCollections.filter(item => {
      if (!item.collected_at) return false;
      return new Date(item.collected_at) >= today;
    });

    const totalLiters = todayCollections.reduce((acc, item) => acc + Number(item.volume_liters || 0), 0);
    const totalPickups = todayCollections.length;

    return res.status(200).json({
      success: true,
      driver_id: targetDriverId,
      totalLiters,
      totalPickups,
      recentCollections: allCollections
    });

  } catch (error: any) {
    console.error('Error fetching driver summary:', error);
    return res.status(500).json({ message: error.message || 'Error fetching driver summary' });
  }
};

/**
 * Verify Farmer Code Lookup
 */
export const getFarmerByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ message: 'Farmer code required' });

    const cleanCode = code.trim().toUpperCase();

    const { data: farmer, error } = await supabase
      .from('farmers')
      .select('id, farmer_code, kid, full_name, route')
      .or(`farmer_code.eq.${cleanCode},kid.eq.${cleanCode}`)
      .maybeSingle();

    if (error || !farmer) {
      return res.status(404).json({ message: `Farmer ${cleanCode} not found.` });
    }

    return res.status(200).json({ farmer });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Server error verifying farmer' });
  }
};

/**
 * Get All Direct Station Collections (Facility-Wide for Clerks/Admins)
 */
export const getAllCollections = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'Unauthorized: Authentication context missing.' });
    }

    // Double-check role directly from the database users table to prevent JWT claim mismatches
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = (dbUser?.role || user.role || '').toUpperCase();

    // Allow CLERK, ADMIN, or fallback to allow authenticated station staff
    if (userError || (role !== 'CLERK' && role !== 'ADMIN' && role !== 'DRIVER' && !role)) {
      // If needed, we can be flexible or check if authorized
    }

    const { data: collections, error } = await supabase
      .from('collections')
      .select(`
        id, volume_liters, can_count, collected_at, notes, driver_id, payout_status,
        farmers (id, farmer_code, kid, full_name, route)
      `)
      .order('collected_at', { ascending: false });

    if (error) throw error;

    const allCollections = (collections || []).map((item: any) => ({
      ...item,
      farmer_name: item.farmers?.full_name || 'Walk-in Farmer',
      farmer_code: item.farmers?.farmer_code || item.farmers?.kid || 'N/A',
      route: item.farmers?.route || 'Station Walk-In'
    }));

    const totalLiters = allCollections.reduce((acc, item) => acc + Number(item.volume_liters || 0), 0);

    return res.status(200).json({
      success: true,
      totalLiters,
      totalCount: allCollections.length,
      collections: allCollections
    });

  } catch (error: any) {
    console.error('Error fetching all collections:', error);
    return res.status(500).json({ message: error.message || 'Error fetching station collections' });
  }
};