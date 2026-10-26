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

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    if (!phone_number || !phone_number.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    // Clean inputs to ensure empty strings don't collide on unique constraints
    const cleanPhone = phone_number.trim();
    const cleanIdNumber = id_number && id_number.trim() !== '' ? id_number.trim() : null;
    const isShareholder = Boolean(is_shareholder);
    const sequenceName = isShareholder ? 'akls_seq' : 'klf_seq';
    const prefix = isShareholder ? 'AKLS' : 'KLF';

    // 1. Explicit pre-checks for existing Phone Number and ID Number
    const { data: existingPhone } = await supabase
      .from('farmers')
      .select('id, full_name')
      .eq('phone_number', cleanPhone)
      .maybeSingle();

    if (existingPhone) {
      return res.status(400).json({
        error: `Phone number "${cleanPhone}" is already registered to farmer "${existingPhone.full_name}".`
      });
    }

    if (cleanIdNumber) {
      const { data: existingId } = await supabase
        .from('farmers')
        .select('id, full_name')
        .eq('id_number', cleanIdNumber)
        .maybeSingle();

      if (existingId) {
        return res.status(400).json({
          error: `National ID "${cleanIdNumber}" is already registered to farmer "${existingId.full_name}".`
        });
      }
    }

    // 2. Fetch next numeric value from sequence
    const { data: seqData, error: seqError } = await supabase.rpc('nextval_seq', { seq_name: sequenceName });

    let nextVal = 1;
    if (seqError || !seqData) {
      const { data: rawSeq } = await supabase.rpc('exec_sql', { 
        sql_query: `SELECT nextval('${sequenceName}') as val;` 
      });
      if (rawSeq && rawSeq[0]) nextVal = rawSeq[0].val;
    } else {
      nextVal = seqData;
    }

    const farmer_code = `${prefix}${nextVal.toString().padStart(4, '0')}`;

    // 3. Insert record with database unique error handling
    const { data, error } = await supabase
      .from('farmers')
      .insert([
        {
          farmer_code,
          full_name: full_name.trim(),
          phone_number: cleanPhone,
          route: route || 'Default Route',
          id_number: cleanIdNumber,
          is_shareholder: isShareholder,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error registering farmer:', error);

      // Handle Postgres Unique Constraint Violation (Code 23505)
      if (error.code === '23505' || error.message?.includes('unique constraint')) {
        const msg = error.message.toLowerCase();
        if (msg.includes('phone_number')) {
          return res.status(400).json({ error: 'Registration failed: This phone number is already registered to another farmer.' });
        }
        if (msg.includes('id_number')) {
          return res.status(400).json({ error: 'Registration failed: This National ID number is already registered to another farmer.' });
        }
        if (msg.includes('farmer_code')) {
          return res.status(400).json({ error: 'Registration failed: Farmer Code collision detected. Please try again.' });
        }
        return res.status(400).json({ error: 'A farmer with these unique details (Phone Number or National ID) already exists.' });
      }

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