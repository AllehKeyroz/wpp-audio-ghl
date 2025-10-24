
import { NextResponse } from 'next/server';
import { getConfig, saveConfig, Config } from '@/lib/services/ghl-service';

/**
 * @swagger
 * /api/config:
 *   get:
 *     description: Returns the current configuration
 *     responses:
 *       200:
 *         description: The current configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Config'
 */
export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/config:
 *   post:
 *     description: Saves the configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Config'
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 */
export async function POST(request: Request) {
  try {
    const config: Config = await request.json();
    // Basic validation
    if (typeof config.ghlEmail !== 'string' || typeof config.ghlPassword !== 'string' || typeof config.targetWebhook !== 'string') {
        return NextResponse.json({ error: 'Invalid configuration format.' }, { status: 400 });
    }
    await saveConfig(config);
    return NextResponse.json({ message: 'Configuration saved successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
