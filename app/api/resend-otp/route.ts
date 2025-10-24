import { NextResponse } from 'next/server';
import { resendOtp } from '@/lib/services/ghl-service';

export async function POST() {
  try {
    await resendOtp();
    return NextResponse.json({ message: 'OTP resend initiated.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
