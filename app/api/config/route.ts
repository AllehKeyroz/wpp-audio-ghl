
import { NextResponse } from 'next/server';
import { getConfig, saveConfig, type Config } from '@/lib/services/ghl-service';

/**
 * @swagger
 * /api/config:
 *   get:
 *     description: Returns the configuration for a given email
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The current configuration for the email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Config'
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email query parameter is required.' }, { status: 400 });
  }

  try {
    const config = await getConfig(email);
    if (!config) {
        return NextResponse.json({ error: 'Configuration not found for this email.' }, { status: 404 });
    }
    // Omit sessionState from the response
    const { sessionState, ...configResponse } = config;
    return NextResponse.json(configResponse);
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
    if (typeof config.ghlEmail !== 'string' || !config.ghlEmail || typeof config.ghlPassword !== 'string' || typeof config.targetWebhook !== 'string') {
        return NextResponse.json({ error: 'Invalid configuration format. Email, Password and Webhook are required.' }, { status: 400 });
    }
    await saveConfig(config);
    return NextResponse.json({ message: 'Configuration saved successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
