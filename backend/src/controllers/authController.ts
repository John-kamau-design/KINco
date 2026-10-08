import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

export const signInCheck = async (req: Request, res: Response) => {
  const { nationalId, fullName, password, phoneNumber } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('national_id', nationalId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'ID number not yet registered' });
    }

    return res.status(200).json({
      message: 'ID exists',
      role: user.role
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { nationalId, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('national_id', nationalId)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, nationalId: user.national_id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};