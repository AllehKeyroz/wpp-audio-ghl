import { NextResponse, type NextRequest } from "next/server";
import { robotState, type RobotConfig } from "@/lib/robot-state";
import { performLogin } from "@/lib/robot-actions";

let twoFactorCodePromise: { resolve: (value: string) => void; reject: (reason?: any) => void; } | null = null;

export async function POST(request: NextRequest) {
    const currentState = robotState.get();
    if (currentState.status === "LOGGING_IN" || currentState.status === "RUNNING" || currentState.status === "AWAITING_2FA") {
        return NextResponse.json({ error: "O robô já está em execução." }, { status: 409 });
    }
    
    try {
        const config: RobotConfig = await request.json();
        robotState.setConfig(config);
        
        const getAuthCode = () => {
             robotState.setStatus("AWAITING_2FA");
             robotState.addLog("Aguardando código de autenticação de 6 dígitos... Por favor, insira-o no painel.");
             return new Promise<string>((resolve, reject) => {
                twoFactorCodePromise = { resolve, reject };
                 // O código será resolvido pela API /api/robot/2fa
             });
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

export async function PUT(request: NextRequest) {
    if (!twoFactorCodePromise) {
        return NextResponse.json({ error: "Nenhum pedido de código 2FA ativo." }, { status: 400 });
    }

    try {
        const { code } = await request.json();
        if (typeof code !== 'string' || code.length < 6) {
             return NextResponse.json({ error: "Código 2FA inválido." }, { status: 400 });
        }
        twoFactorCodePromise.resolve(code);
        twoFactorCodePromise = null;
        robotState.setStatus("LOGGING_IN");
        return NextResponse.json({ status: "Código 2FA recebido." });
    } catch (error) {
         if (twoFactorCodePromise) {
            twoFactorCodePromise.reject(error);
            twoFactorCodePromise = null;
        }
        return NextResponse.json({ error: "Erro ao processar código 2FA." }, { status: 500 });
    }
}
