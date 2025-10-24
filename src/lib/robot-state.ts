import path from 'path';
import fs from 'fs/promises';

export type RobotStatus = "STOPPED" | "LOGGING_IN" | "AWAITING_2FA" | "RUNNING" | "PROCESSING" | "ERROR";

export type RobotConfig = {
  email: string;
  password: string;
  targetWebhook: string;
};

export type LogEntry = {
  timestamp: number;
  message: string;
  type: 'INFO' | 'ERROR';
};

export type RobotState = {
  status: RobotStatus;
  logs: LogEntry[];
  config: RobotConfig | null;
  lastError: string | null;
  screenshot: string | null; // Path to screenshot
};

const MAX_LOGS = 100;
export const SESSION_FILE_PATH = path.join(process.cwd(), 'temp', 'ghl_session_state.json');

// This in-memory store works because Node.js modules are cached, creating a singleton-like behavior
// within a single server instance.
const state: RobotState = {
  status: "STOPPED",
  logs: [],
  config: null,
  lastError: null,
  screenshot: null,
};

function addLog(message: string, type: 'INFO' | 'ERROR' = 'INFO') {
  console.log(`[${type}] ${message}`);
  const newLog: LogEntry = {
    timestamp: Date.now(),
    message,
    type,
  };
  state.logs.unshift(newLog);
  if (state.logs.length > MAX_LOGS) {
    state.logs.pop();
  }
  if (type === 'ERROR') {
    state.lastError = message;
    state.status = 'ERROR';
  }
}

async function clearSession() {
  try {
    await fs.unlink(SESSION_FILE_PATH);
    addLog("Arquivo de sessão removido.");
  } catch (error: any) {
    if (error.code !== 'ENOENT') { // ENOENT means file doesn't exist, which is fine
      addLog(`Não foi possível remover o arquivo de sessão: ${error.message}`, 'ERROR');
    }
  }
}

export const robotState = {
  get: (): RobotState => ({ ...state }),

  setConfig: (config: RobotConfig) => {
    state.config = config;
    addLog("Configuração salva.");
  },

  setStatus: (status: RobotStatus) => {
    state.status = status;
    if (status !== 'ERROR') {
      state.lastError = null; // Clear last error if status is not ERROR
    }
    if (status === 'STOPPED' || status === 'ERROR') {
        clearSession();
    }
    if (status === 'STOPPED') {
      state.logs = [];
      state.config = null;
      state.screenshot = null;
    }
    addLog(`Status alterado para: ${status}`);
  },
  
  setScreenshot: (path: string | null) => {
    state.screenshot = path;
    if(path) {
        addLog(`Captura de tela salva em: ${path}`);
    }
  },

  addLog,

  reset: async () => {
    state.status = "STOPPED";
    state.logs = [];
    state.config = null;
    state.lastError = null;
    state.screenshot = null;
    await clearSession();
    addLog("Estado do robô reiniciado.");
  }
};
