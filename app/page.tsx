'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import type { SessionStatus } from '@/lib/services/ghl-service';
import type { LoginFlowState } from '@/lib/services/login-state-service';

// --- Reusable Components ---
const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const SessionStatusBadge = ({ status }: { status: SessionStatus }) => {
  const styles = {
    'Active': 'bg-green-500 text-white',
    'Expired': 'bg-red-500 text-white',
    'Not Found': 'bg-yellow-500 text-gray-900',
    'Unknown': 'bg-gray-500 text-white',
  };
  return <span className={`px-2 py-1 text-xs font-bold rounded-full ${styles[status] || styles['Unknown']}`}>{status}</span>;
};

const OtpModal = ({ onSubmit, onResendOtp, isLoading }: { onSubmit: (otp: string) => void, onResendOtp: () => void, isLoading: boolean }) => {
    const [otp, setOtp] = useState('');
    const [canResendOtp, setCanResendOtp] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setCanResendOtp(true);
        }, 30000); // Enable resend button after 30 seconds
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (otp.trim()) {
            onSubmit(otp.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-sm w-full">
                <h2 className="text-2xl font-bold text-cyan-300 mb-4">Inserir OTP</h2>
                <p className="text-gray-400 mb-6">Um OTP foi enviado para o seu e-mail. Por favor, insira-o abaixo para continuar.</p>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full bg-gray-700 border-gray-600 rounded-md p-3 text-center text-lg tracking-widest focus:ring-cyan-500 focus:border-cyan-500"
                        placeholder="_ _ _ _ _ _"
                    />
                    <button type="submit" disabled={isLoading} className="w-full mt-6 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                        {isLoading ? <Spinner /> : 'Enviar OTP'}
                    </button>
                    <button
                        type="button"
                        onClick={onResendOtp}
                        disabled={isLoading || !canResendOtp}
                        className="w-full mt-2 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50">
                        {isLoading ? <Spinner /> : (canResendOtp ? 'Reenviar OTP' : 'Aguarde para reenviar...')}
                    </button>
                </form>
            </div>
        </div>
    );
};


// --- Main Page Component ---
export default function HomePage() {
  // --- State Management ---
  const [config, setConfig] = useState({ loginUrl: '', ghlEmail: '', ghlPassword: '', targetWebhook: '' });
  const [testPayload, setTestPayload] = useState({ locationId: '', conversationId: '', messageId: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('Unknown');
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState({ message: '', type: '' });
  const [loginFlowState, setLoginFlowState] = useState<LoginFlowState>('Idle');

  const email = config.ghlEmail; // Use email as the user identifier

  // --- API Call Functions ---
  const updateStatusMessage = (message: string, type: 'success' | 'error') => {
    setStatusMessage({ message, type });
    setTimeout(() => setStatusMessage({ message: '', type: '' }), 5000);
  };

  const fetchSessionStatus = useCallback(async () => {
    if (!email) {
      setSessionStatus('Unknown');
      return;
    }
    try {
      const res = await fetch(`/api/status?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setSessionStatus(data.status);
      } else {
        setSessionStatus('Unknown');
      }
    } catch (e) {
      setSessionStatus('Unknown');
    }
  }, [email]);

  const fetchConfig = async () => {
    if (!email) return;
    try {
      const res = await fetch(`/api/config?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const savedConfig = await res.json();
        setConfig({ ...config, ...savedConfig });
      } else if (res.status === 404) {
        updateStatusMessage('Nenhuma configuração encontrada para este email. Salve uma nova.', 'error');
      }
    } catch (e) { updateStatusMessage('Falha ao buscar configuração', 'error'); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) setLogs((await res.json()).slice().reverse());
      else throw new Error(`Falha ao buscar logs: ${res.status} ${res.statusText}`);
    } catch (e: any) { updateStatusMessage(`Erro ao buscar logs: ${e.message}`, 'error'); }
  };

  const fetchLoginStatus = async () => {
    if (!email) return;
    try {
        const res = await fetch(`/api/login-status?email=${encodeURIComponent(email)}`);
        if (res.ok) {
            const data = await res.json();
            setLoginFlowState(data.flowState);
        }
    } catch (e) {
        // Do nothing
    }
  };

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
        updateStatusMessage('O Email GHL é obrigatório para salvar.', 'error');
        return;
    }
    setIsLoading({ ...isLoading, config: true });
    try {
      const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      if (res.ok) {
        updateStatusMessage('Configuração salva com sucesso!', 'success');
        fetchSessionStatus();
      }
      else throw new Error(await res.text());
    } catch (error: any) { updateStatusMessage(`Erro ao salvar configuração: ${error.message}`, 'error');
    } finally { setIsLoading({ ...isLoading, config: false }); }
  };

  const handleLogin = async () => {
    if (!email) {
        updateStatusMessage('O Email GHL é obrigatório para fazer login.', 'error');
        return;
    }
    setIsLoading({ ...isLoading, login: true });
    updateStatusMessage('Iniciando processo de login... Isso pode levar um momento.', 'success');
    fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(e => {
        updateStatusMessage(`Falha no login: ${e.message}`, 'error');
    });
  };
  
  const handleOtpSubmit = async (otp: string) => {
    setIsLoading({ ...isLoading, otp: true });
    try {
        const res = await fetch('/api/submit-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp, email }) });
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao enviar OTP');
        updateStatusMessage('OTP Enviado. Finalizando login...', 'success');
    } catch (error: any) {
        updateStatusMessage(`Falha no envio do OTP: ${error.message}`, 'error');
    } finally {
        setIsLoading({ ...isLoading, otp: false });
    }
  };

  const handleResendOtp = async () => {
    setIsLoading({ ...isLoading, otp: true }); // Use otp loading for resend as well
    updateStatusMessage('Solicitando reenvio do OTP...', 'success');
    try {
        const res = await fetch('/api/resend-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao reenviar OTP');
        updateStatusMessage('OTP reenviado. Verifique seu e-mail.', 'success');
    } catch (error: any) {
        updateStatusMessage(`Falha ao reenviar OTP: ${error.message}`, 'error');
    } finally {
        setIsLoading({ ...isLoading, otp: false });
    }
  };

  const handleDeleteSession = async () => {
    if (!email) {
        updateStatusMessage('O Email GHL é obrigatório para excluir a sessão.', 'error');
        return;
    }
    setIsLoading({ ...isLoading, deleteSession: true });
    try {
      const res = await fetch('/api/login', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro desconhecido');
      updateStatusMessage('Arquivo de sessão excluído com sucesso.', 'success');
      fetchSessionStatus(); // Refresh status
    } catch (error: any) { updateStatusMessage(`Falha ao excluir sessão: ${error.message}`, 'error');
    } finally { setIsLoading({ ...isLoading, deleteSession: false }); }
  };

  const handleTest = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
        updateStatusMessage('O Email GHL é obrigatório para acionar um teste.', 'error');
        return;
    }
    setIsLoading({ ...isLoading, test: true });
    try {
      const payload = { ...testPayload, ghlEmail: email };
      const res = await fetch('/api/trigger-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) updateStatusMessage('Teste acionado! Verifique os logs para o progresso.', 'success');
      else throw new Error(await res.text());
    } catch (error: any) { updateStatusMessage(`Erro ao acionar teste: ${error.message}`, 'error');
    } finally { setIsLoading({ ...isLoading, test: false }); }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
      updateStatusMessage('Logs limpos.', 'success');
    } catch (e) { updateStatusMessage('Falha ao limpar logs.', 'error'); }
  };

  // --- Effects ---
  useEffect(() => {
    fetchSessionStatus();
    const logInterval = setInterval(fetchLogs, 3000);
    const statusInterval = setInterval(fetchSessionStatus, 30000); // Check session status every 30 seconds
    const loginStatusInterval = setInterval(fetchLoginStatus, 2000); // Poll for login state

    return () => {
      clearInterval(logInterval);
      clearInterval(statusInterval);
      clearInterval(loginStatusInterval);
    };
  }, [fetchSessionStatus, email]);

  useEffect(() => {
    if (loginFlowState === 'InProgress' || loginFlowState === 'AwaitingOTP') {
        setIsLoading(prev => ({ ...prev, login: true }));
    } else {
        setIsLoading(prev => ({ ...prev, login: false }));
    }

    if (loginFlowState === 'Complete') {
        updateStatusMessage('Processo de login concluído com sucesso!', 'success');
        fetchSessionStatus();
        setLoginFlowState('Idle'); // Reset for next time
    }

    if (loginFlowState === 'Failed') {
        updateStatusMessage('Processo de login falhou. Verifique os logs.', 'error');
        setLoginFlowState('Idle'); // Reset for next time
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginFlowState, fetchSessionStatus]);

  // --- Render ---
  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
        {loginFlowState === 'AwaitingOTP' && <OtpModal onSubmit={handleOtpSubmit} onResendOtp={handleResendOtp} isLoading={isLoading.otp || false} />}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-cyan-400">GHL Encaminhador de Anexos</h1>
          <p className="text-gray-400 mt-2">Uma interface web para gerenciar o robô de encaminhamento de anexos do GoHighLevel.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold mb-4 text-cyan-300">1. Configuração</h2>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-300">URL de Login (Whitelabel)</label>
                  <input type="url" value={config.loginUrl} onChange={e => setConfig({ ...config, loginUrl: e.target.value })} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Email GHL (Identificador Único)</label>
                  <input type="email" value={config.ghlEmail} onBlur={fetchConfig} onChange={e => setConfig({ ...config, ghlEmail: e.target.value })} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500" placeholder="Digite seu email GHL e saia do campo"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Senha GHL</label>
                  <input type="password" value={config.ghlPassword} onChange={e => setConfig({ ...config, ghlPassword: e.target.value })} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">URL do Webhook de Destino</label>
                  <input type="url" value={config.targetWebhook} onChange={e => setConfig({ ...config, targetWebhook: e.target.value })} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1 focus:ring-cyan-500 focus:border-cyan-500" />
                </div>
                <button type="submit" disabled={isLoading.config} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50">
                  {isLoading.config ? <Spinner /> : 'Salvar Configuração'}
                </button>
              </form>
            </section>

            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-cyan-300">2. Controle de Sessão</h2>
                    <SessionStatusBadge status={sessionStatus} />
                </div>
              <div className="space-y-4">
                 <p className="text-sm text-gray-400">Primeiro, salve sua configuração. Em seguida, clique aqui para abrir um navegador e resolver o 2FA. Isso cria um arquivo de sessão para automação sem interface.</p>
                <div className="flex space-x-4">
                    <button onClick={handleLogin} disabled={isLoading.login || !email} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                        {isLoading.login ? <Spinner /> : 'Realizar Login Inicial'}
                    </button>
                    <button onClick={handleDeleteSession} disabled={isLoading.deleteSession || !email} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50">
                        {isLoading.deleteSession ? <Spinner /> : 'Excluir Sessão'}
                    </button>
                </div>
              </div>
            </section>
            
            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold text-cyan-300">3. Teste Manual</h2>
                <form onSubmit={handleTest} className="space-y-4 mt-4">
                    <p className="text-sm text-gray-400">Após uma sessão ativa, você pode acionar uma execução manual aqui.</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">ID da Localização</label>
                        <input type="text" value={testPayload.locationId} onChange={e => setTestPayload({ ...testPayload, locationId: e.target.value })} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">ID da Conversa</label>
                        <input type="text" value={testPayload.conversationId} onChange={e => setTestPayload({ ...testPayload, conversationId: e.target.value })} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">ID da Mensagem</label>
                        <input type="text" value={testPayload.messageId} onChange={e => setTestPayload({ ...testPayload, messageId: e.target.value })} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1" />
                    </div>
                    <button type="submit" disabled={isLoading.test || sessionStatus !== 'Active'} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50">
                        {isLoading.test ? <Spinner /> : 'Acionar Teste Manual'}
                    </button>
                </form>
            </section>
          </div>

          <section className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-cyan-300">4. Logs</h2>
              <button onClick={handleClearLogs} className="text-sm text-gray-400 hover:text-white">Limpar Logs</button>
            </div>
            <div className="bg-gray-900 rounded-md p-4 h-full overflow-y-auto font-mono text-sm flex-grow" style={{height: '800px'}}>
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <p key={index} className={`whitespace-pre-wrap ${log.includes('[ERROR]') ? 'text-red-400' : 'text-gray-300'}`}>{log}</p>
                ))
              ) : (
                <p className="text-gray-500">Os logs aparecerão aqui...</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
