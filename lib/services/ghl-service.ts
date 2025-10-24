
import { chromium, Page } from 'playwright';
import path from 'path';
import { setLoginState, getLoginState, retrieveOtp } from './login-state-service';
import { getDb, type Config as DbConfig, saveConfig as dbSaveConfig, saveSession, deleteSession as dbDeleteSession } from './db-service';

// --- Type Definitions ---
export interface Config extends DbConfig {}

export interface WebhookPayload {
  ghlEmail: string; // User identifier
  locationId: string;
  conversationId: string;
  messageId: string;
}

export type SessionStatus = 'Active' | 'Expired' | 'Not Found' | 'Unknown';

// --- Configuration Management ---

export async function getConfig(email: string): Promise<Config | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM configurations WHERE ghlEmail = ?').get(email) as Config | undefined;
  return row || null;
}

export async function saveConfig(config: Config): Promise<void> {
  dbSaveConfig(config);
}

// --- Logging Service ---
let logs: string[] = [];
export const addLog = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}`;
  console.log(logMessage); // Also log to console for container logs
  logs.push(logMessage);
  if (logs.length > 200) logs.shift(); // Keep last 200 logs
};
export const getLogs = () => logs;
export const clearLogs = () => { logs = []; };

// --- Core Playwright Logic ---

/**
 * Checks if the current session state is valid by trying to access a protected page.
 */
export async function checkSessionStatus(email: string): Promise<SessionStatus> {
    addLog(`Checking session status for ${email}...`);
    
    const config = await getConfig(email);
    if (!config || !config.sessionState) {
        addLog(`Session file not found in DB for ${email}.`);
        return 'Not Found';
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: JSON.parse(config.sessionState) });
    const page = await context.newPage();

    try {
        const agencyDashboardUrl = new URL('/v2/dashboard', config.loginUrl).href;
        addLog(`Navigating to ${agencyDashboardUrl} to check status for ${email}.`);
        await page.goto(agencyDashboardUrl, { waitUntil: 'load', timeout: 20000 });

        const currentUrl = page.url();
        addLog(`Landed on URL: ${currentUrl}`);

        if (currentUrl.includes('/v2/')) {
            addLog(`Session for ${email} appears to be active.`);
            return 'Active';
        } else {
            addLog(`Session for ${email} is expired or invalid.`);
            dbDeleteSession(email); // Delete expired session from DB
            return 'Expired';
        }
    } catch (error: any) {
        addLog(`Error checking session status for ${email}: ${error.message}`);
        return 'Expired';
    } finally {
        await browser.close();
    }
}


export async function performInitialLogin(email: string): Promise<void> {
  addLog(`Attempting initial login for ${email}...`);
  
  setLoginState(email, 'InProgress');
  const config = await getConfig(email);
  if (!config || !config.ghlEmail || !config.ghlPassword || !config.loginUrl) {
    const errorMsg = 'Login URL, Email or Password not configured.';
    setLoginState(email, 'Failed', errorMsg);
    addLog(`Error for ${email}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  addLog(`Launching browser for initial login for ${email}...`);
  const browser = await chromium.launch({ headless: false }); 
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    addLog(`Navigating to login page: ${config.loginUrl}`);
    await page.goto(config.loginUrl, { waitUntil: 'load' });

    try {
      addLog('Checking if already logged in...');
      await page.waitForURL(url => url.href.includes('/v2/'), { timeout: 5000 });
      addLog('Already logged in. Saving session state.');
      const sessionState = await context.storageState();
      saveSession(email, JSON.stringify(sessionState));
      setLoginState(email, 'Complete');
      addLog(`Login process complete for ${email} (already logged in).`);
      await page.waitForTimeout(5000); 
      return;
    } catch (e) {
      addLog('Not logged in yet. Proceeding with login form.');
    }

    addLog('Filling email and password...');
    await page.fill('input[name="email"]', config.ghlEmail);
    await page.fill('input[name="password"]', config.ghlPassword);
    await page.click('button[type="submit"]');
    addLog('Credentials submitted.');

    addLog('Waiting for navigation to either dashboard or 2FA page...');
    const navigationResponse = await Promise.race([
        page.waitForURL(url => url.href.includes('/v2/'), { timeout: 30000 }).then(() => 'dashboard'),
        page.waitForSelector('input.otp-input', { timeout: 30000 }).then(() => 'otp'),
    ]);
    
    if (navigationResponse === 'dashboard') {
        addLog('Login successful without 2FA.');
    } else if (navigationResponse === 'otp') {
        addLog('2FA is required. Waiting for OTP from user via web UI.');
        setLoginState(email, 'AwaitingOTP');

        const otp = await retrieveOtp(email);
        if (!otp) {
            throw new Error('OTP not provided in time.');
        }

        addLog('OTP received from UI. Submitting...');
        const otpInputs = await page.$$('input.otp-input');
        if (otpInputs.length === 0) throw new Error('OTP input fields not found on the page.');
        
        for (let i = 0; i < otp.length; i++) {
            if (otpInputs[i]) await otpInputs[i].fill(otp[i]);
        }

        addLog('OTP filled. Waiting for successful login navigation...');
        await page.waitForURL(url => url.href.includes('/v2/'), { timeout: 30000 });
        addLog('Successfully logged in with OTP.');
    }

    addLog('Waiting a moment for session to stabilize...');
    await page.waitForTimeout(5000);

    addLog('Saving session state to database...');
    const sessionState = await context.storageState();
    saveSession(email, JSON.stringify(sessionState));
    addLog(`Session state for ${email} saved successfully.`);
    setLoginState(email, 'Complete');

  } catch (error: any) {
    const errorMsg = error.message || 'An unknown error occurred during login.';
    addLog(`Error during login process for ${email}: ${errorMsg}`);
    setLoginState(email, 'Failed', errorMsg);
  } finally {
    addLog('Closing browser.');
    await browser.close();
  }
}

export async function resendOtp(email: string): Promise<void> {
  addLog(`[WARN] OTP Resend is not yet supported for ${email}. Please restart the login process.`);
}


export async function processAndForwardAttachment(payload: WebhookPayload): Promise<void> {
  const { ghlEmail, locationId, conversationId, messageId } = payload;
  addLog(`Processing request for messageId: ${messageId} for user ${ghlEmail}`);

  const config = await getConfig(ghlEmail);
  if (!config || !config.targetWebhook || !config.loginUrl) {
    throw new Error(`Configuration for ${ghlEmail} not found or incomplete.`);
  }
  if (!config.sessionState) {
    throw new Error(`Session for ${ghlEmail} not found. Please perform the initial login first.`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: JSON.parse(config.sessionState) });
  const page = await context.newPage();

  try {
    const origin = new URL(config.loginUrl).origin;
    const conversationUrl = `${origin}/v2/location/${locationId}/conversations/${conversationId}`;
    const attachmentUrlPattern = `**/*${messageId}/attachment`;

    addLog(`Navigating to: ${conversationUrl}`);
    addLog(`Setting up intercept for URL pattern: ${attachmentUrlPattern}`);

    const responsePromise = page.waitForResponse(attachmentUrlPattern, { timeout: 45000 });
    
    await page.goto(conversationUrl, { waitUntil: 'domcontentloaded' });
    
    addLog('Page navigation initiated. Waiting for attachment response...');
    const response = await responsePromise;
    addLog(`Intercepted attachment response from: ${response.url()}`);

    if (response.ok()) {
      const body = await response.body();
      const base64Body = body.toString('base64');
      const mimeType = response.headers()['content-type'] || 'application/octet-stream';

      addLog(`Attachment size: ${body.length} bytes. Mime-type: ${mimeType}.`);

      const forwardPayload = {
        messageId,
        mimeType,
        data: base64Body,
      };

      addLog(`Forwarding attachment to target webhook: ${config.targetWebhook}`);
      const forwardResponse = await fetch(config.targetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forwardPayload),
      });

      if (forwardResponse.ok) {
        addLog(`Successfully forwarded attachment for messageId: ${messageId}.`);
      } else {
        const errorBody = await forwardResponse.text();
        throw new Error(`Failed to forward attachment. Target server responded with status: ${forwardResponse.status}. Body: ${errorBody}`);
      }
    } else {
      throw new Error(`Failed to fetch attachment from GHL. Status: ${response.status()}`);
    }
  } catch (error: any) {
    addLog(`[ERROR] Error during attachment processing for ${ghlEmail}: ${error.message}`);
    try {
        const screenshotPath = path.join('/tmp', `error_${messageId}_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        addLog(`Screenshot saved to ${screenshotPath} for debugging.`);
    } catch (ssError: any) {
        addLog(`[ERROR] Could not take a screenshot: ${ssError.message}`);
    }
    throw error;
  } finally {
    addLog('Closing browser context for attachment processing.');
    await browser.close();
  }
}
