import { NextResponse, type NextRequest } from "next/server";
import path from 'path';
import fs from 'fs';
import os from 'os';
import mime from 'mime-types';

const SCREENSHOTS_DIR = path.join(os.tmpdir(), 'ghl-robot-screenshots');

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string[] } }
) {
  const filename = params.filename.join('/');
  if (!filename || filename.includes('..')) {
    return NextResponse.json({ error: "Nome de arquivo inválido." }, { status: 400 });
  }

  try {
    const filePath = path.join(SCREENSHOTS_DIR, filename);
    
    // Verifica se o arquivo existe
    await fs.promises.access(filePath);

    // Lê o arquivo do sistema de arquivos
    const fileBuffer = await fs.promises.readFile(filePath);

    // Determina o tipo de conteúdo
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    // Retorna a imagem com o cabeçalho de conteúdo apropriado
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error(`Erro ao servir screenshot: ${error}`);
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
}
