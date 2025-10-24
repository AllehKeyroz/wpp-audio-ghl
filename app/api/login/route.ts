
import { NextResponse } from 'next/server';
import { performInitialLogin, addLog } from '@/lib/services/ghl-service';
import { setLoginState, resetLoginFlow } from '@/lib/services/login-state-service';
import { deleteSession } from '@/lib/services/db-service';

/**
 * @swagger
 * /api/login:
 *   post:
 *     description: Triggers the initial login process for a given user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       202:
 *         description: Login process started. Check /api/login-status for updates.
 *       500:
 *         description: Error during login.
 */
export async function POST(request: Request) {
    const { email } = await request.json();
    if (!email) {
        return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

  try {
    resetLoginFlow(email); // Reset state for a new login attempt for this user
    setLoginState(email, 'InProgress');
    addLog(`API /api/login POST: Starting interactive login process for ${email}.`);

    // Perform login in non-headless mode to allow for 2FA interaction.
    // Do not await, as this will be a long-running process waiting for user input.
    performInitialLogin(email).catch(error => {
      addLog(`[ERROR] Uncaught error in background login process for ${email}: ${error.message}`);
      setLoginState(email, 'Failed', error.message);
    });

    return NextResponse.json({ message: `Login process for ${email} started. Check /api/login-status for updates.` }, { status: 202 });
  } catch (error: any) {
    addLog(`API /api/login POST error for ${email}: ${error.message}`);
    setLoginState(email, 'Failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/login:
 *   delete:
 *     description: Deletes the session for a given user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session deleted.
 */
export async function DELETE(request: Request) {
    const { email } = await request.json();
    if (!email) {
        return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    try {
        deleteSession(email);
        addLog(`Session for ${email} deleted.`);
        resetLoginFlow(email); // Reset login flow state as well
        return NextResponse.json({ message: `Session for ${email} deleted successfully.` });
    } catch (error: any) {
        addLog(`API /api/login DELETE error for ${email}: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
