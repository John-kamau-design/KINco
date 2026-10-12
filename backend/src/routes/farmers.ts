import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY) as string
);

const router = Router();

// Register a new farmer (Admin / Clerk)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { full_name, phone_number, route, id_number } = req.body;

    if (!full_name || !phone_number) {
      return res.status(400).json({ error: 'Full name and phone number are required' });
    }

    const { data, error } = await supabase
      .from('farmers')
      .insert([
        {
          full_name,
          phone_number,
          route: route || 'Default Route',
          id_number: id_number || null,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error registering farmer:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ message: 'Farmer registered successfully', farmer: data[0] });
  } catch (err: any) {
    console.error('Server error during farmer registration:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all farmers list
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('farmers').select('*').order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;