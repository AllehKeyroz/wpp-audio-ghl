
import { NextResponse } from 'next/server';
import { checkSessionStatus } from '@/lib/services/ghl-service';

/**
 * @swagger
 * /api/status:
 *   get:
 *     description: Checks the validity of the GHL session for a given user.
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The current session status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [Active, Expired, Not Found, Unknown]
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email query parameter is required.' }, { status: 400 });
  }

  try {
    const status = await checkSessionStatus(email);
    return NextResponse.json({ status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
