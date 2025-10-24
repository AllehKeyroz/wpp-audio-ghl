
import { NextResponse } from 'next/server';
import { processAndForwardAttachment, addLog, WebhookPayload } from '@/lib/services/ghl-service';
import { getConfig } from '@/lib/services/ghl-service';


// This function needs a way to map an incoming webhook (e.g., from a locationId) to a user's ghlEmail.
// This is a placeholder. In a real multi-tenant app, you would look up the user associated with this locationId.
async function getEmailFromWebhook(payload: any): Promise<string | null> {
    // For now, we assume the webhook payload ITSELF contains the ghlEmail of the user who set it up.
    // This is a simplification. You might need to adjust your webhook provider to send this identifier.
    if (payload.ghlEmail) {
        return payload.ghlEmail;
    }
    
    // As a fallback, if you have very few users, you could try to guess.
    // THIS IS NOT A PRODUCTION-READY SOLUTION.
    addLog("[WARN] Webhook payload does not contain ghlEmail. This will not work for multiple users. The system requires the webhook to identify the user.");

    return null; 
}


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
    const rawPayload = await request.json();

    const ghlEmail = await getEmailFromWebhook(rawPayload);
    if (!ghlEmail) {
        addLog(`[ERROR] Could not determine user (ghlEmail) from incoming webhook. Payload: ${JSON.stringify(rawPayload)}`);
        return NextResponse.json({ error: 'Could not identify user from webhook.' }, { status: 400 });
    }

    const payload: WebhookPayload = {
        ...rawPayload,
        ghlEmail: ghlEmail
    };

    const { locationId, conversationId, messageId } = payload;

    // Basic validation
    if (!locationId || !conversationId || !messageId) {
      return NextResponse.json({ error: 'Invalid payload. Missing required fields.' }, { status: 400 });
    }

    addLog(`Webhook received for messageId: ${messageId}. User: ${ghlEmail}. Queuing for processing.`);

    // --- Asynchronous Execution ---
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
