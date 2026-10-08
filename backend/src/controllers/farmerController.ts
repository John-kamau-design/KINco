import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { supabase } from '../config/supabase';

export const registerFarmer = async (req: Request, res: Response) => {
  const { fullName, phoneNumber, nationalId, isShareholder } = req.body;

  try {
    const passwordHash = await bcrypt.hash('123456', 10);

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([
        {
          full_name: fullName,
          phone_number: phoneNumber,
          national_id: nationalId,
          password_hash: passwordHash,
          role: 'FARMER'
        }
      ])
      .select()
      .single();

    if (userError) return res.status(400).json({ error: userError.message });

    const generatedKID = 'KID-' + Math.floor(1000 + Math.random() * 9000);

    const { data: farmer, error: farmerError } = await supabase
      .from('farmers')
      .insert([
        {
          user_id: user.id,
          kid: generatedKID,
          is_shareholder: isShareholder || false
        }
      ])
      .select()
      .single();

    if (farmerError) return res.status(400).json({ error: farmerError.message });

    return res.status(201).json({ message: 'Farmer registered successfully', farmer, user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getFarmers = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('farmers')
      .select(`
        id,
        kid,
        is_shareholder,
        users (
          full_name,
          phone_number,
          national_id
        )
      `);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};