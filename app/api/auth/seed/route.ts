import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Admin } from '@/lib/models';
import bcrypt from 'bcryptjs';

// Only POST allowed, no credentials exposed in response
export async function POST() {
  try {
    await dbConnect();

    const existing = await Admin.findOne({ username: 'admin' });
    if (existing) {
      return NextResponse.json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);

    await Admin.create({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@transport.com',
      role: 'admin',
    });

    return NextResponse.json({ message: 'Admin created successfully. Please change the default password immediately.' });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
