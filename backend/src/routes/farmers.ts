import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY) as string
);

const router = Router();

// Helper function to generate unique next farmer code
async function generateUniqueFarmerCode(isShareholder: boolean): Promise<string> {
  const prefix = isShareholder ? 'AKLS' : 'KLF';
  const sequenceName = isShareholder ? 'akls_seq' : 'klf_seq';

  let nextVal = 1;
  const { data: seqData, error: seqError } = await supabase.rpc('nextval_seq', { seq_name: sequenceName });

  if (seqError || !seqData) {
    const { data: rawSeq } = await supabase.rpc('exec_sql', { 
      sql_query: `SELECT nextval('${sequenceName}') as val;` 
    });
    if (rawSeq && rawSeq[0]) nextVal = rawSeq[0].val;
  } else {
    nextVal = seqData;
  }

  let farmerCode = `${prefix}${nextVal.toString().padStart(4, '0')}`;

  // Fallback collision loop: check if candidate code already exists in farmers table
  let { data: existing } = await supabase
    .from('farmers')
    .select('id')
    .eq('farmer_code', farmerCode)
    .maybeSingle();

  while (existing) {
    nextVal++;
    farmerCode = `${prefix}${nextVal.toString().padStart(4, '0')}`;
    const { data: checkNext } = await supabase
      .from('farmers')
      .select('id')
      .eq('farmer_code', farmerCode)
      .maybeSingle();
    existing = checkNext;
  }

  return farmerCode;
}

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

    const cleanPhone = phone_number.trim();
    const cleanIdNumber = id_number && id_number.trim() !== '' ? id_number.trim() : null;
    const isShareholder = Boolean(is_shareholder);

    // 1. Privacy-safe pre-checks for existing Phone Number and ID Number
    const { data: existingPhone } = await supabase
      .from('farmers')
      .select('id')
      .eq('phone_number', cleanPhone)
      .maybeSingle();

    if (existingPhone) {
      return res.status(400).json({
        error: `Phone number "${cleanPhone}" is already registered in the system.`
      });
    }

    if (cleanIdNumber) {
      const { data: existingId } = await supabase
        .from('farmers')
        .select('id')
        .eq('id_number', cleanIdNumber)
        .maybeSingle();

      if (existingId) {
        return res.status(400).json({
          error: `National ID "${cleanIdNumber}" is already registered in the system.`
        });
      }
    }

    // 2. Generate guaranteed unique farmer code
    const farmer_code = await generateUniqueFarmerCode(isShareholder);

    // 3. Insert record
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

      if (error.code === '23505' || error.message?.includes('unique constraint')) {
        const msg = error.message.toLowerCase();
        if (msg.includes('phone_number')) {
          return res.status(400).json({ error: `Phone number "${cleanPhone}" is already registered in the system.` });
        }
        if (msg.includes('id_number')) {
          return res.status(400).json({ error: `National ID "${cleanIdNumber}" is already registered in the system.` });
        }
        return res.status(400).json({ error: 'A record with these unique details already exists in the system.' });
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