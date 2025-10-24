import { sync as mkdirpSync } from 'mkdirp';
import path from 'path';
import os from 'os';
import { chromium, type Page, TimeoutError as PlaywrightTimeoutError } from "playwright";
import { robotState, SESSION_FILE_PATH, type RobotConfig } from "./robot-state";
import fs from 'fs/promises';

const SCREENSHOTS_DIR = path.join(os.tmpdir(), 'ghl-robot-screenshots');
mkdirpSync(SCREENSHOTS_DIR);

async function checkSessionFile() {
    try {
        await fs.access(SESSION_FILE_PATH);
        return true;
    } catch {
        return false;
    }
}

export async function performLogin(config: RobotConfig, getAuthCode: () => Promise<string>) {
    robotState.setStatus("LOGGING_IN");

    if (await checkSessionFile()) {
        robotState.addLog("Arquivo de sessão encontrado. Pulando login.");
        robotState.setStatus("RUNNING");
        return;
    }

    const browser = await chromium.launch({ headless: true, slowMo: 50, args: ["--no-sandbox"] });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        robotState.addLog("Navegando para a página de login...");
        await page.goto("https://app.kdsbrasil.com/", { timeout: 60000 });

        robotState.addLog("Preenchendo credenciais...");
        await page.locator('input[name="email"]').fill(config.email);
        await page.locator('input[name="password"]').fill(config.password);

        await Promise.all([
            page.waitForNavigation({ waitUntil: "load", timeout: 90000 }),
            page.locator('button[type="submit"]').click(),
        ]);
        
        const is2faRequired = await page.locator('input[placeholder*="authentication code"]').isVisible({ timeout: 5000 });

        if (is2faRequired) {
            robotState.addLog("Autenticação de dois fatores necessária.");
            const code = await getAuthCode(); 
            robotState.addLog("Código de autenticação recebido, verificando...");
             await page.locator('input[placeholder*="authentication code"]').fill(code.trim());
             await Promise.all([
                page.waitForNavigation({ waitUntil: "load", timeout: 60000 }),
                page.locator('button:has-text("Verify")').click(),
            ]);
        }
        
        robotState.addLog("Aguardando o carregamento do Painel da Agência...");
        await page.waitForSelector('text="Painel da Agência"', { timeout: 90000 });

        robotState.addLog("LOGIN BEM-SUCEDIDO! Salvando estado da sessão...");
        await context.storageState({ path: SESSION_FILE_PATH });
        robotState.addLog(`Sessão salva com sucesso em '${SESSION_FILE_PATH}'.`);
        robotState.setStatus("RUNNING");

    } catch (e) {
        const error = e as Error;
        robotState.addLog(`ERRO de login: ${error.message}`, 'ERROR');
        const screenshotFilename = `login_error_${Date.now()}.png`;
        const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFilename);
        await page.screenshot({ path: screenshotPath });
        robotState.setScreenshot(screenshotFilename); // Apenas o nome do arquivo
    } finally {
        if (browser.isConnected()) {
            await browser.close();
        }
    }
}

export async function processConversation(payload: { locationId: string; conversationId: string; messageId: string }) {
    const { locationId, conversationId, messageId } = payload;
    const config = robotState.get().config;

    if (!config) {
        robotState.addLog("Configuração não encontrada para processar a conversa.", 'ERROR');
        return;
    }

    if (!await checkSessionFile()) {
        robotState.addLog("Sessão não encontrada. Não é possível processar o anexo.", 'ERROR');
        return;
    }
    
    robotState.setStatus("PROCESSING");
    robotState.addLog(`Iniciando processo para: ConvID=${conversationId}, MsgID=${messageId}`);

    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const context = await browser.newContext({ storageState: SESSION_FILE_PATH });
    const page = await context.newPage();

    try {
        const conversationUrl = `https://app.kdsbrasil.com/v2/location/${locationId}/conversations/conversations/${conversationId}`;
        const attachmentUrlPattern = `**/*${messageId}/attachment`;

        robotState.addLog(`Navegando para: ${conversationUrl}`);
        robotState.addLog(`Aguardando resposta de: ${attachmentUrlPattern}`);

        const response = await page.waitForResponse(attachmentUrlPattern, async () => {
             await page.goto(conversationUrl, { waitUntil: "networkidle", timeout: 45000 });
        }, {timeout: 45000});


        robotState.addLog(`Resposta do anexo capturada. Status: ${response.status()}`);

        if (!response.ok()) {
            throw new Error(`A resposta do anexo teve status ${response.status()}`);
        }

        const binaryContent = await response.body();
        const base64Content = Buffer.from(binaryContent).toString('base64');
        const mimeType = response.headers()['content-type'] || 'application/octet-stream';

        const attachmentPayload = {
            base64: base64Content,
            mimeType: mimeType,
            messageId: messageId
        };
        robotState.addLog("Anexo convertido para Base64.");

        robotState.addLog("Enviando payload para o webhook de destino...");
        const postResponse = await fetch(config.targetWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attachmentPayload),
        });

        if (postResponse.ok) {
            robotState.addLog(`Sucesso! Dados enviados para ${config.targetWebhook}.`);
        } else {
            const responseText = await postResponse.text();
            throw new Error(`Erro ao enviar para webhook. Status: ${postResponse.status}, Resposta: ${responseText}`);
        }

    } catch (e) {
        const error = e as Error;
        const isTimeout = error instanceof PlaywrightTimeoutError;
        const errorMessage = isTimeout ? "Timeout: A chamada para o anexo não foi detectada a tempo." : `ERRO inesperado: ${error.message}`;
        robotState.addLog(errorMessage, 'ERROR');
        
        const screenshotFilename = `processing_error_${Date.now()}.png`;
        const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFilename);
        try {
            await page.screenshot({ path: screenshotPath });
            robotState.setScreenshot(screenshotFilename); // Apenas o nome do arquivo
        } catch (screenshotError) {
            robotState.addLog(`Falha ao tirar screenshot: ${(screenshotError as Error).message}`, 'ERROR');
        }
    } finally {
        if (browser.isConnected()) {
            await browser.close();
        }
        // Set status back to RUNNING if it was not an error that stopped the whole thing
        if (robotState.get().status !== 'ERROR' && robotState.get().status !== 'STOPPED') {
             robotState.setStatus("RUNNING");
        }
    }
}
