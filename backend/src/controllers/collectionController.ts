import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Search/verify farmer by 'farmer_code' (KLF/AKLS) or 'kid'
export const getFarmerByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ message: 'Farmer ID code is required' });
    }

    const cleanCode = code.trim().toUpperCase();

    // Query both farmer_code and kid for compatibility
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

// Record a new milk collection (Supports Clerk station & Driver App)
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

    const driver_id = (req as any).user?.id || req.body.driver_id || null;
    const intakeVolume = parseFloat(liters || volume_liters);

    if (!intakeVolume || intakeVolume <= 0) {
      return res.status(400).json({ message: 'Valid positive volume in liters is required' });
    }

    let targetFarmerId = farmer_id;
    let resolvedFarmerCode = farmer_code ? farmer_code.trim().toUpperCase() : null;
    let farmerName = '';

    // If farmer_code is provided (from Clerk form), look up the farmer record
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

    // Insert collection into DB
    // Insert collection into DB
    const { data, error } = await supabase
      .from('collections')
      .insert([
        {
          driver_id,
          farmer_id: targetFarmerId,
          farmer_code: resolvedFarmerCode,
          route_id,
          volume_liters: intakeVolume,
          can_count: can_count ? parseInt(can_count, 10) : 1,
          notes: notes || null,
          clerk_name: clerk_name || null,
          collected_at: new Date().toISOString()
        }
      ])
      .select(`
        id, volume_liters, can_count, collected_at,
        farmers (farmer_code, full_name)
      `)
      .single();

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

// Fetch daily summary and full history for Driver Portal
export const getDriverDailySummary = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all collections with joined farmer details
    const { data: collections, error } = await supabase
      .from('collections')
      .select(`
        id, volume_liters, collected_at, notes, clerk_name, farmer_code,
        farmers (id, farmer_code, kid, full_name, route)
      `)
      .order('collected_at', { ascending: false });

    if (error) throw error;

    // Calculate metrics for today specifically
    const todayCollections = collections ? collections.filter(item => {
      const itemDate = new Date(item.collected_at);
      return itemDate >= today;
    }) : [];

    const totalLiters = todayCollections.reduce((acc, item) => acc + Number(item.volume_liters || 0), 0);
    const totalPickups = todayCollections.length;

    return res.status(200).json({
      totalLiters,
      totalPickups,
      recentCollections: collections || []
    });
  } catch (error: any) {
    console.error('Error fetching driver summary:', error);
    return res.status(500).json({ message: error.message || 'Error fetching driver summary' });
  }
};