import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Admin } from '@/lib/models';
import bcrypt from 'bcryptjs';

// POST - Reset password (requires current admin authentication via admin_id)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { admin_id, new_password } = await request.json();

    if (!admin_id || !new_password) {
      return NextResponse.json({ error: 'admin_id and new_password are required' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await Admin.updateOne(
      { _id: admin._id },
      { password: hashedPassword, failedAttempts: 0, lockUntil: null }
    );

    return NextResponse.json({ success: true, message: 'Password has been reset' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
