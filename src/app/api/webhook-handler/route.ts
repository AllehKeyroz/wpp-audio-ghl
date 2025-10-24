import { NextResponse, type NextRequest } from "next/server";
import { robotState } from "@/lib/robot-state";
import { processConversation } from "@/lib/robot-actions";

export async function POST(request: NextRequest) {
  const currentState = robotState.get();

  if (currentState.status !== 'RUNNING') {
    const errorMessage = "Sessão não iniciada ou robô não está ativo.";
    robotState.addLog(errorMessage, 'ERROR');
    return NextResponse.json({ error: errorMessage }, { status: 503 });
  }

  try {
    const data = await request.json();
    const { locationId, conversationId, messageId } = data;

    if (!locationId || !conversationId || !messageId) {
      return NextResponse.json({ error: "Os campos 'locationId', 'conversationId' e 'messageId' são obrigatórios." }, { status: 400 });
    }

    robotState.addLog(`Webhook recebido para a conversa ${conversationId}.`);
    
    // Don't await this, so we can return a response immediately
    processConversation({ locationId, conversationId, messageId }).catch(err => {
        robotState.addLog(`Erro no processamento em segundo plano: ${(err as Error).message}`, 'ERROR');
    });

    return NextResponse.json({ status: "processamento iniciado" }, { status: 202 });

  } catch (error) {
    robotState.addLog(`Erro ao processar o corpo do webhook: ${(error as Error).message}`, 'ERROR');
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
  }
}
