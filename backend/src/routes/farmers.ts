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
    const { full_name, phone_number, route, id_number, is_shareholder } = req.body;

    if (!full_name || !phone_number) {
      return res.status(400).json({ error: 'Full name and phone number are required' });
    }

    const isShareholder = Boolean(is_shareholder);
    const sequenceName = isShareholder ? 'akls_seq' : 'klf_seq';
    const prefix = isShareholder ? 'AKLS' : 'KLF';

    // 1. Fetch next numeric value from the respective sequence
    const { data: seqData, error: seqError } = await supabase.rpc('nextval_seq', { seq_name: sequenceName });

    let nextVal = 1;
    if (seqError || !seqData) {
      // Fallback SQL query if RPC isn't configured
      const { data: rawSeq } = await supabase.rpc('exec_sql', { 
        sql_query: `SELECT nextval('${sequenceName}') as val;` 
      });
      if (rawSeq && rawSeq[0]) nextVal = rawSeq[0].val;
    } else {
      nextVal = seqData;
    }

    // Format ID as KLF0001, KLF0002... or AKLS0001, AKLS0002...
    const farmer_code = `${prefix}${nextVal.toString().padStart(4, '0')}`;

    // 2. Insert record
    const { data, error } = await supabase
      .from('farmers')
      .insert([
        {
          farmer_code,
          full_name,
          phone_number,
          route: route || 'Default Route',
          id_number: id_number || null,
          is_shareholder: isShareholder,
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
    const { data, error } = await supabase
      .from('farmers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;