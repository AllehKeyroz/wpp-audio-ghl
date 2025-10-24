
import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { setLoginState, getLoginState, retrieveOtp } from './login-state-service';

// Define paths for configuration and session state
const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const SESSION_PATH = path.join(process.cwd(), 'ghl_session_state.json');

// --- Type Definitions ---
export interface Config {
  loginUrl: string;
  ghlEmail: string;
  ghlPassword: string;
  targetWebhook: string;
}

export interface WebhookPayload {
  locationId: string;
  conversationId: string;
  messageId: string;
}

export type SessionStatus = 'Active' | 'Expired' | 'Not Found' | 'Unknown';

// --- Configuration Management ---

export async function getConfig(): Promise<Config> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading config file:', error);
    // Return default values if config doesn't exist
    return { loginUrl: 'https://app.gohighlevel.com/', ghlEmail: '', ghlPassword: '', targetWebhook: '' };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
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
export async function checkSessionStatus(): Promise<SessionStatus> {
    addLog('Checking session status...');
    addLog(`Session file path being checked: ${SESSION_PATH}`);
    try {
        await fs.access(SESSION_PATH);
        addLog('Session file found.');
    } catch (e: any) {
        addLog(`Session file not found. Error: ${e.message}`);
        return 'Not Found';
    }

    const config = await getConfig();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: SESSION_PATH });
    const page = await context.newPage();

    try {
        const agencyDashboardUrl = new URL('/v2/dashboard', config.loginUrl).href;
        addLog(`Navigating to ${agencyDashboardUrl} to check status.`);
        await page.goto(agencyDashboardUrl, { waitUntil: 'load', timeout: 20000 });

        const currentUrl = page.url();
        addLog(`Landed on URL: ${currentUrl}`);

        // If we are on any agency or location page, the session is active.
        if (currentUrl.includes('/v2/')) {
            addLog('Session appears to be active.');
            return 'Active';
        } else {
            addLog('Session is expired or invalid. Not on a protected v2 URL.');
            return 'Expired';
        }
    } catch (error: any) {
        addLog(`Error checking session status during navigation: ${error.message}`);
        return 'Expired'; // Assume expired on any navigation or timeout error
    } finally {
        await browser.close();
    }
}


export async function performInitialLogin(): Promise<void> {
  addLog('Attempting initial login...');
  
  setLoginState('InProgress');
  const config = await getConfig();
  if (!config.ghlEmail || !config.ghlPassword || !config.loginUrl) {
    const errorMsg = 'Login URL, Email or Password not configured.';
    setLoginState('Failed', errorMsg);
    addLog(`Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  addLog('Launching browser for initial login...');
  // Headless must be false for user to interact with 2FA
  const browser = await chromium.launch({ headless: false }); 
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    addLog(`Navigating to login page: ${config.loginUrl}`);
    await page.goto(config.loginUrl, { waitUntil: 'load' });

    // Check if already logged in (e.g., from a previous run where the browser didn't close)
    try {
      addLog('Checking if already logged in by waiting for dashboard URL...');
      await page.waitForURL(url => url.href.includes('/v2/'), { timeout: 5000 });
      addLog('Already logged in. Saving session state.');
      await context.storageState({ path: SESSION_PATH });
      setLoginState('Complete');
      addLog('Login process complete (already logged in). Browser will close shortly.');
      // Wait a bit before closing so user can see the message
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

    // Wait for either the dashboard (no 2FA) or the 2FA page
    addLog('Waiting for navigation to either dashboard or 2FA page...');
    const navigationResponse = await Promise.race([
        page.waitForURL(url => url.href.includes('/v2/'), { timeout: 30000 }).then(() => 'dashboard'),
        page.waitForSelector('input.otp-input', { timeout: 30000 }).then(() => 'otp'),
    ]);
    
    if (navigationResponse === 'dashboard') {
        addLog('Login successful without 2FA. Navigated to dashboard.');
    } else if (navigationResponse === 'otp') {
        addLog('2FA is required. Waiting for OTP from user via web UI.');
        setLoginState('AwaitingOTP');

        // Wait for the OTP to be submitted from the frontend
        const otp = await retrieveOtp();
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
        addLog('Successfully logged in with OTP and navigated to dashboard.');
    }

    addLog('Waiting a moment for session to stabilize...');
    await page.waitForTimeout(5000);

    addLog('Saving session state to file...');
    await context.storageState({ path: SESSION_PATH });
    await fs.access(SESSION_PATH); // Verify file exists
    addLog('Session state saved and verified successfully.');
    setLoginState('Complete');

  } catch (error: any) {
    const errorMsg = error.message || 'An unknown error occurred during login.';
    addLog(`Error during login process: ${errorMsg}`);
    setLoginState('Failed', errorMsg);
    // Don't re-throw, let finally block handle browser closing
  } finally {
    addLog('Closing browser.');
    await browser.close();
  }
}

export async function resendOtp(): Promise<void> {
  // This function is problematic in a headless/automated context
  // as it requires access to the specific page instance that is asking for OTP.
  // The current architecture with a new browser per action makes this difficult.
  // For now, we will log that this is not supported.
  addLog('[WARN] OTP Resend is not supported in the current architecture. Please restart the login process.');
  // A potential implementation would require a long-lived browser instance managed by the server.
}


export async function processAndForwardAttachment(payload: WebhookPayload): Promise<void> {
  const { locationId, conversationId, messageId } = payload;
  addLog(`Processing request for messageId: ${messageId}`);

  const config = await getConfig();
  if (!config.targetWebhook || !config.loginUrl) {
    throw new Error('Login URL or Target Webhook URL is not configured.');
  }

  try {
    await fs.access(SESSION_PATH);
  } catch (e) {
    throw new Error('Session file not found. Please perform the initial login first.');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_PATH });
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
    addLog(`[ERROR] Error during attachment processing: ${error.message}`);
    // Capture a screenshot for debugging if something went wrong
    try {
        const screenshotPath = path.join('/tmp', `error_${messageId}_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        addLog(`Screenshot saved to ${screenshotPath} for debugging.`);
    } catch (ssError: any) {
        addLog(`[ERROR] Could not take a screenshot: ${ssError.message}`);
    }
    throw error; // Re-throw the original error
  } finally {
    addLog('Closing browser context for attachment processing.');
    await browser.close();
  }
}
