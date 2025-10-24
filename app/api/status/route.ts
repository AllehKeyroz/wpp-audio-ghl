
import { NextResponse } from 'next/server';
import { checkSessionStatus } from '@/lib/services/ghl-service';

/**
 * @swagger
 * /api/status:
 *   get:
 *     description: Checks the validity of the current GHL session.
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
export async function GET() {
  try {
    const status = await checkSessionStatus();
    return NextResponse.json({ status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
