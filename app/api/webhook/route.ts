
import { NextResponse } from 'next/server';
import { processAndForwardAttachment, addLog, WebhookPayload } from '@/lib/services/ghl-service';

/**
 * @swagger
 * /api/webhook:
 *   post:
 *     description: Receives a webhook, triggers the attachment forwarding process asynchronously.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebhookPayload'
 *     responses:
 *       202:
 *         description: Accepted. The process has been queued.
 *       400:
 *         description: Invalid payload.
 */
export async function POST(request: Request) {
  try {
    const payload: WebhookPayload = await request.json();
    const { locationId, conversationId, messageId } = payload;

    // Basic validation
    if (!locationId || !conversationId || !messageId) {
      return NextResponse.json({ error: 'Invalid payload. Missing required fields.' }, { status: 400 });
    }

    addLog(`Webhook received for messageId: ${messageId}. Queuing for processing.`);

    // --- Asynchronous Execution ---
    // We trigger the long-running Playwright process but DO NOT await it.
    // This allows us to immediately return a response to the webhook sender.
    processAndForwardAttachment(payload).catch(error => {
      // Log any errors that occur during the async process
      addLog(`[ERROR] Uncaught error in background process for messageId ${messageId}: ${error.message}`);
    });

    // Return an "Accepted" response immediately.
    return NextResponse.json({ message: 'Accepted. Process queued.' }, { status: 202 });

  } catch (error: any) {
    addLog(`Webhook endpoint error: ${error.message}`);
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
