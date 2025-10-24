import { NextResponse } from 'next/server';
import { getLoginState } from '@/lib/services/login-state-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email query parameter is required.' }, { status: 400 });
  }

  const state = getLoginState(email);
  return NextResponse.json(state);
}
