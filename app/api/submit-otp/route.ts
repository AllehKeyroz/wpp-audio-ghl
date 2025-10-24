import { NextResponse } from 'next/server';
import { submitOtp } from '@/lib/services/login-state-service';

export async function POST(request: Request) {
  try {
    const { otp, email } = await request.json();
    if (!otp || typeof otp !== 'string' || !email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Invalid OTP or email format.' }, { status: 400 });
    }
    const success = submitOtp(email, otp);
    if (success) {
      return NextResponse.json({ message: 'OTP submitted successfully.' });
    } else {
      return NextResponse.json({ error: 'Failed to submit OTP. Invalid state for this user.' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
