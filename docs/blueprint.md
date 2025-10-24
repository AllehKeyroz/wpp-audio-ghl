# **App Name**: GHL Robot Dashboard

## Core Features:

- Configuração de Variáveis: Interface para configurar o email (`GHL_EMAIL`), senha (`GHL_PASSWORD`) e o arquivo de sessão (`SESSION_FILE`).
- Gerenciamento de Endpoint: Campo de texto editável para inserir e atualizar o endpoint do webhook (`TARGET_WEBHOOK`) sem precisar modificar o código.
- Login Persistente: Executar o login no GoHighLevel (GHL) apenas uma vez e salvar o estado da sessão para reutilização, evitando logins repetitivos.
- Monitoramento de Status: Exibir o status da conexão com o GHL e o status do envio de dados para o webhook na tela, informando se a conexão está ativa e se os dados foram enviados com sucesso.
- Cópia do Endpoint: Botão para copiar o endpoint do webhook para a área de transferência, facilitando o uso em outros serviços.
- Tratamento de Anexos: Capturar e converter anexos de conversas do GHL para Base64, enviando-os para o endpoint do webhook.
- Lidar com falhas: Faça uma captura de tela se o programa apresentar timeout. Guarde também todos os status e respostas http, e apresente de forma clara para o usuário.

## Style Guidelines:

- Cor primária: Azul suave (#A0CFEC) para transmitir uma sensação de calma e confiabilidade, importante para um painel de controle.
- Cor de fundo: Cinza claro (#F5F5F5) para garantir que os elementos da interface se destaquem e facilitar a leitura.
- Cor de destaque: Laranja vibrante (#FF8C00) para botões de ação (como 'Copiar Endpoint') e notificações de status.
- Fonte para corpo e títulos: 'Inter', uma fonte sans-serif para uma aparência moderna e legível.
- Ícones simples e intuitivos para representar o status da conexão, ações de copiar e outras funções importantes do painel.
- Layout responsivo e adaptável a diferentes tamanhos de tela, com seções bem definidas para configuração, monitoramento de status e outras funcionalidades.
- Animações sutis para indicar o carregamento de dados e o sucesso das ações, como o envio de dados para o webhook.