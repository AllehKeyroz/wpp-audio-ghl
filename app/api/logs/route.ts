
import { NextResponse } from 'next/server';
import { getLogs, clearLogs } from '@/lib/services/ghl-service';

/**
 * @swagger
 * /api/logs:
 *   get:
 *     description: Retrieves the latest logs from the server.
 *     responses:
 *       200:
 *         description: An array of log messages.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
export async function GET() {
  return NextResponse.json(getLogs());
}

/**
 * @swagger
 * /api/logs:
 *   delete:
 *     description: Clears all stored logs.
 *     responses:
 *       200:
 *         description: Logs cleared successfully.
 */
export async function DELETE() {
  clearLogs();
  return NextResponse.json({ message: 'Logs cleared successfully.' });
}
