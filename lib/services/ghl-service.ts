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
  logs.push(`${timestamp}: ${message}`);
  if (logs.length > 100) logs.shift();
};
export const getLogs = () => logs;
export const clearLogs = () => { logs = []; };

// --- Core Playwright Logic ---

/**
 * Checks if the current session state is valid.
 */
export async function checkSessionStatus(): Promise<SessionStatus> {
    addLog('Checking session status...');
    addLog(`Session file path: ${SESSION_PATH}`);
    try {
        await fs.access(SESSION_PATH);
        addLog('Session file found.');
    } catch (e: any) {
        addLog(`Session file not found at ${SESSION_PATH}. Error: ${e.message}`);
        return 'Not Found';
    }

    const config = await getConfig();
    const browser = await chromium.launch({ headless: true }); // Revert to headless for background check
    const context = await browser.newContext({ storageState: SESSION_PATH });
    const page = await context.newPage();

    try {
        addLog(`Navigating to ${config.loginUrl} to check status.`);
        await page.goto(config.loginUrl, { waitUntil: 'load', timeout: 15000 });

        // After loading, check if the URL indicates an active session.
        if (page.url().includes('agency_dashboard') || page.url().includes('v2/location')) {
            addLog('Session is active.');
            return 'Active';
        } else {
            addLog('Session is expired. Redirected to login page or not on dashboard.');
            return 'Expired';
        }
    } catch (error) {
        addLog(`Error checking session status: ${error}`);
        return 'Expired'; // Assume expired on error
    } finally {
        await browser.close();
    }
}

export async function performInitialLogin(headless: boolean = false): Promise<void> {
  addLog('Attempting initial login...');
  addLog(`Current working directory: ${process.cwd()}`);
  addLog(`Session file path: ${SESSION_PATH}`);

  // Diagnostic: Try writing a dummy file to check permissions
  const dummyFilePath = path.join(process.cwd(), 'gemini_dummy_test.txt');
  try {
    await fs.writeFile(dummyFilePath, 'This is a test file from Gemini.', 'utf-8');
    addLog(`Diagnostic: Successfully wrote dummy file to ${dummyFilePath}`);
    await fs.unlink(dummyFilePath); // Clean up dummy file
    addLog(`Diagnostic: Successfully deleted dummy file.`);
  } catch (dummyError: any) {
    addLog(`Diagnostic: Failed to write dummy file to ${dummyFilePath}. This might indicate a permissions issue. Error: ${dummyError.message}`);
  }

  setLoginState('InProgress');
  const config = await getConfig();
  if (!config.ghlEmail || !config.ghlPassword || !config.loginUrl) {
    setLoginState('Failed', 'Login URL, Email or Password not configured.');
    addLog('Error: Login URL, Email or Password not configured.');
    throw new Error('Login URL, Email or Password not configured.');
  }

  addLog('Launching browser...');
  const browser = await chromium.launch({ headless: false }); // Always non-headless for initial login
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    addLog(`Navigating to login page: ${config.loginUrl}`);
    await page.goto(config.loginUrl);

    const origin = new URL(config.loginUrl).origin;
    const dashboardUrlPattern = `${origin}/v2/dashboard`;

    try {
      addLog('Checking if already logged in...');
      await page.waitForURL((url) => url.href.startsWith(dashboardUrlPattern), { timeout: 5000 });
      addLog('Already logged in. Saving session state.');
      await context.storageState({ path: SESSION_PATH });
      setLoginState('Complete');
      // await browser.close(); // Keep browser open for inspection
      addLog('Login complete. Browser kept open for inspection.');
      return;
    } catch (e) {
      addLog('Not logged in. Proceeding with login form.');
    }

    addLog('Filling email and password...');
    await page.fill('input[name="email"]', config.ghlEmail);
    await page.fill('input[name="password"]', config.ghlPassword);
    await page.click('button[type="submit"]');
    addLog('Email and password submitted. Waiting for 2FA elements to appear.');
    const sendSecurityCodeButtonSelector = '#app > div > div:nth-child(1) > div.flex.v2-open.sidebar-v2-agency > section > div.hl_login--body > div > div > div > div.mt-4 > div > button';
    addLog(`Waiting for button with selector: ${sendSecurityCodeButtonSelector}`);
    await page.waitForSelector(sendSecurityCodeButtonSelector, { state: 'visible' });
    addLog('2FA elements appeared. Clicking Send Security Code button.');
    await page.click(sendSecurityCodeButtonSelector);
    addLog('Security code sent. Waiting for OTP from user.');
    setLoginState('AwaitingOTP');

    // Wait for the OTP to be submitted from the frontend
    let otp: string | null = null;
    for (let i = 0; i < 600; i++) { // 10 minute timeout
        if (getLoginState().flowState === 'SubmittingOTP') {
            otp = retrieveOtp();
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!otp) {
        setLoginState('Failed', 'OTP not provided in time.');
        addLog('Error: OTP not provided in time.');
        // Don't throw, let the browser stay open for inspection
        return;
    }

    addLog('OTP received. Submitting...');
    const otpInputs = await page.$$('input.otp-input');
    if (otpInputs.length === 0) {
        throw new Error('OTP input fields not found.');
    }
    for (let i = 0; i < otp.length; i++) {
        await otpInputs[i].fill(otp[i]);
    }
    addLog('OTP filled. Waiting for dashboard URL...');
    await page.waitForURL((url) => url.href.includes('agency_dashboard') || url.href.includes('v2/location'), { timeout: 30000 });
    addLog('Successfully logged in and navigated to dashboard.');
    addLog('Waiting 15 seconds for session to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait for 15 seconds

    addLog('Attempting to save session state to file...');
    try {
      await context.storageState({ path: SESSION_PATH });
      addLog('Playwright reported session state saved. Verifying file existence...');
      await fs.access(SESSION_PATH); // Verify immediately after saving
      addLog('Session file confirmed to exist after saving.');
      setLoginState('Complete');
      addLog('Login complete. You can now close the browser window.');
    } catch (saveError: any) {
      addLog(`Error saving session state or verifying file: ${saveError.message}`);
      setLoginState('Failed', `Error saving session: ${saveError.message}`);
    }

  } catch (error) {
    addLog(`Error during login: ${error}`);
    setLoginState('Failed', error instanceof Error ? error.message : 'Unknown error');
    // Don't re-throw, just log and let the user see the browser state
  }
}

export async function resendOtp(): Promise<void> {
  addLog('Attempting to resend OTP...');
  // setLoginState('InProgress'); // Indicate that a login-related process is ongoing

  const config = await getConfig();
  if (!config.loginUrl) {
    addLog('Error: Login URL not configured for OTP resend.');
    throw new Error('Login URL not configured.');
  }

  // Ensure session file exists before trying to load it
  try {
    await fs.access(SESSION_PATH);
  } catch (e) {
    addLog('Session file not found. Cannot resend OTP without an active session.');
    setLoginState('Failed', 'Session file not found. Please perform initial login.');
    throw new Error('Session file not found.');
  }

  const browser = await chromium.launch({ headless: false }); // Visible browser for interactive resend
  const context = await browser.newContext({ storageState: SESSION_PATH });
  const page = await context.newPage();

  try {
    addLog(`Navigating to login page (${config.loginUrl}) to resend OTP.`);
    await page.goto(config.loginUrl, { waitUntil: 'load', timeout: 15000 });

    const resendButtonSelector = 'div.w-full.font-semibold.text-center.cursor-pointer.text-curious-blue-500:has-text("If you did not receive the code click here to resend")';
    addLog(`Waiting for resend button with selector: ${resendButtonSelector}`);
    await page.waitForSelector(resendButtonSelector, { state: 'visible', timeout: 30000 });
    addLog('Resend button appeared. Clicking to resend OTP.');
    await page.click(resendButtonSelector);
    addLog('Resend OTP button clicked. Waiting for OTP from user again.');
    setLoginState('AwaitingOTP'); // Go back to awaiting OTP state

  } catch (error) {
    addLog(`Error during OTP resend: ${error}`);
    setLoginState('Failed', error instanceof Error ? error.message : 'Unknown error during OTP resend');
    throw error;
  } finally {
    // Do not close browser immediately, let user inspect if needed
    addLog('OTP resend process finished. Browser kept open for inspection.');
  }
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

  const context = await chromium.launchPersistentContext('', {
    headless: true,
    storageState: SESSION_PATH,
  });

  const page = await context.newPage();

  try {
    const origin = new URL(config.loginUrl).origin;
    const conversationUrl = `${origin}/v2/location/${locationId}/conversations/${conversationId}`;
    const attachmentUrlPattern = `**/*${messageId}/attachment`;

    addLog(`Navigating to: ${conversationUrl}`);
    addLog(`Setting up intercept for URL pattern: ${attachmentUrlPattern}`);

    const responsePromise = page.waitForResponse(attachmentUrlPattern, { timeout: 45000 });
    await page.goto(conversationUrl, { waitUntil: 'domcontentloaded' });
    const response = await responsePromise;
    addLog(`Intercepted attachment response: ${response.url()}`);

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

      addLog(`Forwarding attachment to: ${config.targetWebhook}`);
      const forwardResponse = await fetch(config.targetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forwardPayload),
      });

      if (forwardResponse.ok) {
        addLog('Successfully forwarded attachment.');
      } else {
        const errorBody = await forwardResponse.text();
        throw new Error(`Failed to forward attachment. Status: ${forwardResponse.status}. Body: ${errorBody}`);
      }
    } else {
      throw new Error(`Failed to fetch attachment. Status: ${response.status()}`);
    }
  } catch (error) {
    addLog(`Error during processing: ${error}`);
    throw error;
  } finally {
    await context.close();
  }
}