import { NextResponse } from 'next/server';
import { performInitialLogin, addLog } from '@/lib/services/ghl-service';
import { setLoginState, resetLoginFlow } from '@/lib/services/login-state-service';
import fs from 'fs/promises';
import path from 'path';

const SESSION_PATH = path.join(process.cwd(), 'ghl_session_state.json');

/**
 * @swagger
 * /api/login:
 *   post:
 *     description: Triggers the initial login process. Runs headed so the user can solve 2FA.
 *     responses:
 *       202:
 *         description: Login process started. Check /api/login-status for updates.
 *       500:
 *         description: Error during login.
 */
export async function POST() {
  try {
    resetLoginFlow(); // Reset state for a new login attempt
    setLoginState('InProgress');
    addLog('API /api/login POST: Starting interactive login process.');

    // Perform login in non-headless mode to allow for 2FA interaction.
    // Do not await, as this will be a long-running process waiting for user input.
    performInitialLogin(false).catch(error => {
      addLog(`[ERROR] Uncaught error in background login process: ${error.message}`);
      setLoginState('Failed', error.message);
    });

    return NextResponse.json({ message: 'Login process started. Check /api/login-status for updates.' }, { status: 202 });
  } catch (error: any) {
    addLog(`API /api/login POST error: ${error.message}`);
    setLoginState('Failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/login:
 *   delete:
 *     description: Deletes the session file, forcing a new login on the next run.
 *     responses:
 *       200:
 *         description: Session file deleted.
 */
export async function DELETE() {
    try {
        await fs.unlink(SESSION_PATH);
        addLog('Session file deleted.');
        resetLoginFlow(); // Reset login flow state as well
        return NextResponse.json({ message: 'Session file deleted successfully.' });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ message: 'Session file not found, nothing to delete.' });
        }
        addLog(`API /api/login DELETE error: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}