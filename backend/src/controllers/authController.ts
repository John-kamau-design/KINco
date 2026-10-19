import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'kinco-secret-key-2026';

export const registerUser = async (req: Request, res: Response) => {
  try {
    const full_name = req.body.full_name || req.body.fullName;
    const national_id = req.body.national_id || req.body.nationalId;
    const phone_number = req.body.phone_number || req.body.phoneNumber || req.body.phone;
    const role = req.body.role || 'DRIVER';
    const password = req.body.password;

    if (!full_name || !national_id || !password) {
      return res.status(400).json({ 
        message: 'Full name, National ID, and initial password are required' 
      });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('national_id', national_id)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ 
        message: 'A user with this National ID / Staff ID is already registered' 
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          full_name,
          national_id,
          phone_number: phone_number || null,
          role: role.toUpperCase(),
          password_hash,
          created_at: new Date().toISOString()
        }
      ])
      .select('id, full_name, national_id, phone_number, role, created_at')
      .single();

    if (error) {
      console.error('Supabase registration error:', error);
      throw error;
    }

    return res.status(201).json({
      message: 'User registered successfully',
      user: data
    });
  } catch (error: any) {
    console.error('Registration controller error:', error);
    return res.status(500).json({ 
      message: error.message || 'Server error occurred during user registration' 
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const national_id = req.body.national_id || req.body.nationalId;
    const password = req.body.password;

    if (!national_id || !password) {
      return res.status(400).json({ message: 'National ID and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('national_id', national_id)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, national_id: user.national_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        national_id: user.national_id,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Login controller error:', error);
    return res.status(500).json({ message: 'Server error during login authentication' });
  }
};

export const getDrivers = async (req: Request, res: Response) => {
  try {
    // 1. Query users table for explicit DRIVER role (Case insensitive in array)
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .in('role', ['DRIVER', 'driver', 'Driver']);

    if (!userError && users && users.length > 0) {
      return res.status(200).json({
        success: true,
        drivers: users,
        users
      });
    }

    // 2. Secondary check: Query ALL users in case role column isn't standardized
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .order('full_name', { ascending: true });

    if (allUsers && allUsers.length > 0) {
      // Filter in memory for maximum safety
      const driverMatches = allUsers.filter(u => 
        u.role && u.role.toString().toUpperCase() === 'DRIVER'
      );

      if (driverMatches.length > 0) {
        return res.status(200).json({
          success: true,
          drivers: driverMatches,
          users: driverMatches
        });
      }
    }

    // 3. Fallback: Extract driver_ids directly from collections table
    const { data: colData } = await supabase
      .from('collections')
      .select('driver_id');

    const uniqueDriverIds = Array.from(
      new Set((colData || []).map(c => c.driver_id).filter(Boolean))
    );

    if (uniqueDriverIds.length === 0) {
      // Return any users registered in system if no collections exist yet
      const fallbackList = (allUsers || []).map(u => ({
        id: u.id,
        full_name: u.full_name || u.email || `User (${u.id.substring(0, 8)})`
      }));

      return res.status(200).json({ 
        success: true, 
        drivers: fallbackList, 
        users: fallbackList 
      });
    }

    // Query names for matched IDs
    const { data: matchedUsers } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', uniqueDriverIds);

    const drivers = uniqueDriverIds.map(id => {
      const match = (matchedUsers || []).find(u => u.id === id);
      return {
        id,
        full_name: match?.full_name || match?.email || `Driver (${String(id).substring(0, 8)}...)`
      };
    });

    return res.status(200).json({
      success: true,
      drivers,
      users: drivers
    });

  } catch (error: any) {
    console.error('Error fetching drivers:', error);
    // Never crash the UI dropdown; return empty array with 200 rather than hard 500 error
    return res.status(200).json({ 
      success: false, 
      drivers: [], 
      users: [], 
      message: error.message || 'Error fetching active drivers list' 
    });
  }
};
// Aliases to ensure backward compatibility with backend/src/routes/auth.ts imports
export const login = loginUser;
export const signInCheck = loginUser;
export const register = registerUser;