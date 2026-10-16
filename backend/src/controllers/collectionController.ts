import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to extract driver UUID from req.user safely
// Helper to extract driver UUID safely from token or request body
const getAuthenticatedUserId = (req: Request): string | null => {
  const reqUser = (req as any).user;
  
  const possibleId = 
    reqUser?.id || 
    reqUser?.user_id || 
    reqUser?.sub || 
    reqUser?.user?.id || 
    req.body?.driver_id || 
    req.query?.driver_id;

  return possibleId ? String(possibleId).trim() : null;
};

// Search/verify farmer by 'farmer_code' (KLF/AKLS) or 'kid'
export const getFarmerByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ message: 'Farmer ID code is required' });
    }

    const cleanCode = code.trim().toUpperCase();

    const { data: farmer, error } = await supabase
      .from('farmers')
      .select('id, farmer_code, kid, full_name, route')
      .or(`farmer_code.eq.${cleanCode},kid.eq.${cleanCode}`)
      .maybeSingle();

    if (error || !farmer) {
      return res.status(404).json({ message: `Farmer ${cleanCode} not found in directory.` });
    }

    return res.status(200).json({ farmer });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Server error searching farmer' });
  }
};

// Record Milk Intake
export const recordCollection = async (req: Request, res: Response) => {
  try {
    const { 
      farmer_code, 
      farmer_id, 
      liters, 
      volume_liters, 
      route, 
      route_code, 
      can_count, 
      notes, 
      clerk_name 
    } = req.body;

    // Guaranteed driver ID resolution
    const driver_id = getAuthenticatedUserId(req) || req.body.driver_id || null;

    if (!driver_id) {
      return res.status(400).json({ message: 'Driver authentication required. Missing driver_id context.' });
    }

    const intakeVolume = parseFloat(liters || volume_liters);
    if (!intakeVolume || intakeVolume <= 0) {
      return res.status(400).json({ message: 'Valid positive volume in liters is required' });
    }

    let targetFarmerId = farmer_id;
    let resolvedFarmerCode = farmer_code ? farmer_code.trim().toUpperCase() : null;
    let farmerName = '';

    if (resolvedFarmerCode && !targetFarmerId) {
      const { data: farmer, error: farmerError } = await supabase
        .from('farmers')
        .select('id, farmer_code, full_name, route')
        .or(`farmer_code.eq.${resolvedFarmerCode},kid.eq.${resolvedFarmerCode}`)
        .maybeSingle();

      if (farmerError || !farmer) {
        return res.status(404).json({ message: `Farmer code ${resolvedFarmerCode} not found.` });
      }

      targetFarmerId = farmer.id;
      resolvedFarmerCode = farmer.farmer_code || resolvedFarmerCode;
      farmerName = farmer.full_name;
    }

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

    const basePayload: Record<string, any> = {
      driver_id,
      farmer_id: targetFarmerId,
      route_id,
      volume_liters: intakeVolume,
      can_count: can_count ? parseInt(can_count, 10) : 1,
      collected_at: new Date().toISOString()
    };

    const fullPayload = { ...basePayload };
    if (notes) fullPayload.notes = notes;
    if (clerk_name) fullPayload.clerk_name = clerk_name;

    let { data, error } = await supabase
      .from('collections')
      .insert([fullPayload])
      .select(`
        id, volume_liters, can_count, collected_at, driver_id,
        farmers (farmer_code, full_name, kid)
      `)
      .single();

    if (error && (error.message?.includes('notes') || error.message?.includes('clerk_name') || error.message?.includes('column'))) {
      const retryResult = await supabase
        .from('collections')
        .insert([basePayload])
        .select(`
          id, volume_liters, can_count, collected_at, driver_id,
          farmers (farmer_code, full_name, kid)
        `)
        .single();
      
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) throw error;

    const resolvedFarmerName = farmerName || 
      (Array.isArray(data?.farmers) ? data.farmers[0]?.full_name : (data?.farmers as any)?.full_name) || '';

    return res.status(201).json({
      message: 'Milk intake logged successfully',
      farmer_name: resolvedFarmerName,
      collection: data
    });
  } catch (error: any) {
    console.error('Record collection error:', error);
    return res.status(500).json({ message: error.message || 'Failed to record collection' });
  }
};

// Fetch Collections (Strictly Isolate Drivers)
export const getCollections = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const role = (user?.role || '').toUpperCase();
    const authUserId = getAuthenticatedUserId(req);

    let query = supabase
      .from('collections')
      .select(`
        id, volume_liters, can_count, collected_at, notes, driver_id,
        farmers (farmer_code, full_name, kid)
      `)
      .order('collected_at', { ascending: false });

    // Restrict strictly if role is DRIVER
    if (role === 'DRIVER') {
      if (!authUserId) {
        return res.status(401).json({ message: 'Authentication context missing.' });
      }
      query = query.eq('driver_id', authUserId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      success: true,
      collections: data || []
    });
  } catch (error: any) {
    console.error('Error fetching collections:', error);
    return res.status(500).json({ message: error.message || 'Error fetching collection logs' });
  }
};

// Fetch Driver Daily Summary (Strictly Isolate Driver Logs)
export const getDriverDailySummary = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const role = (user?.role || '').toUpperCase();
    const authUserId = getAuthenticatedUserId(req);
    const queryDriverId = req.query.driver_id as string;

    // Fallback: If authUserId isn't extracted from token, fallback to query param or stored body context
    let targetDriverId = authUserId;
    if ((role === 'CLERK' || role === 'ADMIN') && queryDriverId) {
      targetDriverId = queryDriverId;
    } else if (!targetDriverId && queryDriverId) {
      targetDriverId = queryDriverId;
    }

    if (!targetDriverId) {
      console.error('DEBUG: No targetDriverId resolved from user:', user);
      return res.status(400).json({ message: 'Driver ID context could not be identified.' });
    }

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCollections = allCollections.filter(item => {
      if (!item.collected_at) return false;
      const itemDate = new Date(item.collected_at);
      return itemDate >= today;
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