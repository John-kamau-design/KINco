import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Search/verify farmer by 'kid' identifier
export const getFarmerByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ message: 'Farmer ID code is required' });
    }

    const { data: farmer, error } = await supabase
      .from('farmers')
      .select('id, kid, full_name')
      .eq('kid', code.trim().toUpperCase())
      .maybeSingle();

    if (error || !farmer) {
      return res.status(404).json({ message: 'Farmer not found. Check farmer ID.' });
    }

    return res.status(200).json({ farmer });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Server error searching farmer' });
  }
};

// Record a new milk collection
export const recordCollection = async (req: Request, res: Response) => {
  try {
    const { farmer_id, route_code, volume_liters, can_count } = req.body;
    const driver_id = (req as any).user?.id || req.body.driver_id;

    if (!farmer_id || !volume_liters || parseFloat(volume_liters) <= 0) {
      return res.status(400).json({ message: 'Valid farmer ID and positive volume in liters are required' });
    }

    let route_id = null;
    if (route_code) {
      const { data: route } = await supabase
        .from('routes')
        .select('id')
        .eq('route_code', route_code)
        .maybeSingle();
      if (route) route_id = route.id;
    }

    const { data, error } = await supabase
      .from('collections')
      .insert([
        {
          driver_id: driver_id || null,
          farmer_id,
          route_id,
          volume_liters: parseFloat(volume_liters),
          can_count: can_count ? parseInt(can_count, 10) : 1,
          collected_at: new Date().toISOString()
        }
      ])
      .select(`
        id, volume_liters, can_count, collected_at,
        farmers (kid, full_name)
      `)
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: 'Collection recorded successfully',
      collection: data
    });
  } catch (error: any) {
    console.error('Record collection error:', error);
    return res.status(500).json({ message: error.message || 'Failed to record collection' });
  }
};

// Fetch today's route summary for the driver
export const getDriverDailySummary = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: collections, error } = await supabase
      .from('collections')
      .select(`
        id, volume_liters, can_count, collected_at,
        farmers (kid, full_name)
      `)
      .gte('collected_at', today.toISOString())
      .order('collected_at', { ascending: false });

    if (error) throw error;

    const totalLiters = collections ? collections.reduce((acc, item) => acc + Number(item.volume_liters), 0) : 0;
    const totalPickups = collections ? collections.length : 0;

    return res.status(200).json({
      totalLiters,
      totalPickups,
      recentCollections: collections || []
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Error fetching summary' });
  }
};