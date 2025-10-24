import { NextResponse } from 'next/server';
import { getLoginState } from '@/lib/services/login-state-service';

export async function GET() {
  const state = getLoginState();
  return NextResponse.json(state);
}