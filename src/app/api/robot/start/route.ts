import { NextResponse, type NextRequest } from "next/server";
import { robotState, type RobotConfig } from "@/lib/robot-state";
import { performLogin } from "@/lib/robot-actions";

let twoFactorCodePromise: { resolve: (value: string) => void; reject: (reason?: any) => void; } | null = null;

export async function POST(request: NextRequest) {
    const currentState = robotState.get();
    if (currentState.status === "LOGGING_IN" || currentState.status === "RUNNING") {
        return NextResponse.json({ error: "O robô já está em execução." }, { status: 409 });
    }
    
    try {
        const config: RobotConfig = await request.json();
        robotState.setConfig(config);
        
        // This is a simplified way to handle 2FA for this example.
        // In a real-world scenario, you'd want a more robust solution like WebSockets or a dedicated UI.
        const getAuthCode = () => {
             robotState.addLog("Aguardando código de autenticação de 6 dígitos... Por favor, insira-o na janela do navegador que foi aberta.");
             // This is a placeholder. The user will input the code in the non-headless browser window.
             // We return a promise that never resolves here because the user action in browser drives the flow.
             return new Promise<string>(() => {});
        };

        // Non-blocking call to start the login process
        performLogin(config, getAuthCode).catch(err => {
             robotState.addLog(`Falha crítica ao tentar logar: ${(err as Error).message}`, 'ERROR');
        });

        // Immediately return the initial state
        return NextResponse.json(robotState.get());
    } catch (error) {
        return NextResponse.json({ error: "Payload de configuração inválido." }, { status: 400 });
    }
}
