
import { NextResponse } from 'next/server';
import { processAndForwardAttachment, addLog, WebhookPayload } from '@/lib/services/ghl-service';

/**
 * @swagger
 * /api/trigger-test:
 *   post:
 *     description: Manually triggers the attachment forwarding process for testing purposes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebhookPayload'
 *     responses:
 *       202:
 *         description: Accepted. The test process has been started.
 *       400:
 *         description: Invalid payload.
 */
export async function POST(request: Request) {
  try {
    const payload: WebhookPayload = await request.json();
    const { ghlEmail, locationId, conversationId, messageId } = payload;

    if (!ghlEmail || !locationId || !conversationId || !messageId) {
      return NextResponse.json({ error: 'Invalid payload. Missing required fields.' }, { status: 400 });
    }

    addLog(`Manual test triggered for messageId: ${messageId} by user ${ghlEmail}.`);

    // Trigger the process asynchronously, just like the real webhook
    processAndForwardAttachment(payload).catch(error => {
      addLog(`[ERROR] Uncaught error in manual test for messageId ${messageId}: ${error.message}`);
    });

    return NextResponse.json({ message: 'Accepted. Test process started.' }, { status: 202 });

  } catch (error: any) {
    addLog(`Manual test endpoint error: ${error.message}`);
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
