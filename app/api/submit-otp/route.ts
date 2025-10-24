import { NextResponse } from 'next/server';
import { submitOtp } from '@/lib/services/login-state-service';

export async function POST(request: Request) {
  try {
    const { otp } = await request.json();
    if (!otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'Invalid OTP format.' }, { status: 400 });
    }
    const success = submitOtp(otp);
    if (success) {
      return NextResponse.json({ message: 'OTP submitted successfully.' });
    } else {
      return NextResponse.json({ error: 'Failed to submit OTP. Invalid state.' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}