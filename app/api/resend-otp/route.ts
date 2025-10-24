import { NextResponse } from 'next/server';
import { resendOtp } from '@/lib/services/ghl-service';

export async function POST(request: Request) {
    const { email } = await request.json();
    if (!email) {
        return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
  try {
    await resendOtp(email);
    return NextResponse.json({ message: 'OTP resend initiated.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
