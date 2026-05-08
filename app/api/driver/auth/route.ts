import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Driver } from '@/lib/models';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { phone, password } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ error: 'Phone and password required' }, { status: 400 });
    }

    const driver = await Driver.findOne({ phone, isActive: true });

    if (!driver) {
      return NextResponse.json({ error: 'Invalid login credentials.' }, { status: 401 });
    }

    // Compare password with bcrypt (fallback for legacy plain-text)
    let isValid = false;
    if (driver.password.startsWith('$2')) {
      isValid = await bcrypt.compare(password, driver.password);
    } else {
      // Legacy plain-text: compare and auto-hash for next time
      isValid = password === driver.password;
      if (isValid) {
        driver.password = await bcrypt.hash(password, 10);
        await driver.save();
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid login credentials.' }, { status: 401 });
    }

    // Generate JWT token
    const token = await signToken({
      id: driver._id.toString(),
      role: 'driver',
      phone: driver.phone,
    });

    return NextResponse.json({
      success: true,
      token,
      data: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
