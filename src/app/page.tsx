
"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Settings,
  Monitor,
  FileText,
  Play,
  StopCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Power,
  ExternalLink,
  KeyRound
} from "lucide-react";
import type { RobotState } from "@/lib/robot-state";
import Image from "next/image";

const formSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um e-mail válido." }),
  password: z.string().min(1, { message: "A senha é obrigatória." }),
  targetWebhook: z.string().url({ message: "Por favor, insira uma URL válida." }),
});

const twoFaSchema = z.object({
  code: z.string().min(6, { message: "O código deve ter pelo menos 6 dígitos." }),
});

type FormData = z.infer<typeof formSchema>;
type TwoFaFormData = z.infer<typeof twoFaSchema>;

const statusConfig = {
  STOPPED: { text: "Parado", color: "bg-gray-500", icon: <Power className="h-4 w-4" /> },
  LOGGING_IN: { text: "Iniciando Login...", color: "bg-blue-500", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  AWAITING_2FA: { text: "Aguardando 2FA", color: "bg-yellow-500", icon: <KeyRound className="h-4 w-4" /> },
  RUNNING: { text: "Ativo", color: "bg-green-500", icon: <CheckCircle2 className="h-4 w-4" /> },
  PROCESSING: { text: "Processando", color: "bg-purple-500", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  ERROR: { text: "Erro", color: "bg-red-500", icon: <XCircle className="h-4 w-4" /> },
};


export default function GhlRobotDashboard() {
  const [state, setState] = useState<RobotState>({
    status: "STOPPED",
    logs: [],
    config: null,
    lastError: null,
    screenshot: null,
  });
  const [isPending, startTransition] = useTransition();
  const [is2faPending, start2faTransition] = useTransition();
  const [webhookUrl, setWebhookUrl] = useState("");
  const { toast } = useToast();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      targetWebhook: "",
    },
  });

  const twoFaForm = useForm<TwoFaFormData>({
    resolver: zodResolver(twoFaSchema),
    defaultValues: {
      code: "",
    },
  });

  const fetchStatus = () => {
    fetch("/api/robot/status")
      .then((res) => res.json())
      .then((data) => setState(data))
      .catch(err => console.error("Failed to fetch status:", err));
  };

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhook-handler`);
  }, []);

  useEffect(() => {
    const shouldPoll = ["LOGGING_IN", "AWAITING_2FA", "RUNNING", "PROCESSING", "ERROR"].includes(state.status);
    
    if (shouldPoll && !pollingIntervalRef.current) {
      fetchStatus(); // Fetch immediately
      pollingIntervalRef.current = setInterval(fetchStatus, 3000);
    } else if (!shouldPoll && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [state.status]);


  const handleStart = (data: FormData) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/robot/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Falha ao iniciar o robô.");
        }
        setState(result);
        toast({
          title: "Robô Iniciado",
          description: "O processo de login foi iniciado.",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        toast({
          variant: "destructive",
          title: "Erro ao Iniciar",
          description: errorMessage,
        });
        setState(prev => ({ ...prev, status: 'ERROR', lastError: errorMessage }));
      }
    });
  };

  const handleStop = () => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/robot/stop", { method: "POST" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Falha ao parar o robô.");
        }
        setState(result);
        form.reset({
          email: "",
          password: "",
          targetWebhook: "",
        })
        toast({
          title: "Robô Parado",
          description: "O robô foi parado com sucesso.",
        });
      } catch (error) {
         const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        toast({
          variant: "destructive",
          title: "Erro ao Parar",
          description: errorMessage,
        });
      }
    });
  };
  
  const handle2faSubmit = (data: TwoFaFormData) => {
    start2faTransition(async () => {
       try {
        const response = await fetch("/api/robot/start", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: data.code }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Falha ao enviar código 2FA.");
        }
        toast({
          title: "Código Enviado",
          description: "Continuando processo de login...",
        });
        twoFaForm.reset();
        // The status will be updated via polling
        fetchStatus();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        toast({
          variant: "destructive",
          title: "Erro no 2FA",
          description: errorMessage,
        });
      }
    });
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copiado!",
      description: "O endpoint do webhook foi copiado para a área de transferência.",
    });
  };

  const getScreenshotUrl = (filename: string) => {
    return `/api/screenshots/${filename}`;
  }

  const isInteractive = state.status === "RUNNING" || state.status === "LOGGING_IN" || state.status === "AWAITING_2FA" || state.status === "PROCESSING";
  const currentStatus = statusConfig[state.status] || statusConfig.STOPPED;

  return (
    <main className="flex flex-col items-center p-4 sm:p-6 md:p-10 min-h-screen bg-background">
      <div className="w-full max-w-6xl space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground font-headline">Dashboard Robô GHL</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie e monitore sua automação do GoHighLevel com facilidade.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuração
                </CardTitle>
                <CardDescription>
                  Insira suas credenciais e o webhook de destino para iniciar.
                </CardDescription>
              </CardHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleStart)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail GHL</FormLabel>
                          <FormControl>
                            <Input placeholder="seu.email@exemplo.com" {...field} disabled={isInteractive} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha GHL</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="********" {...field} disabled={isInteractive} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="targetWebhook"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook de Destino</FormLabel>
                          <FormControl>
                            <Input placeholder="https://seu-webhook.com/..." {...field} disabled={isInteractive} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button type="submit" disabled={isPending || isInteractive}>
                      {isPending && state.status !== 'RUNNING' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                      Iniciar Robô
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleStop} disabled={isPending || !isInteractive}>
                       {isPending && isInteractive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
                      Parar Robô
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Status do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="font-medium">Status</span>
                  <Badge className={`${currentStatus.color} text-white hover:${currentStatus.color}`}>
                     {currentStatus.icon}
                    <span className="ml-2">{currentStatus.text}</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium">Endpoint do seu Webhook</span>
                    <span className="text-sm text-muted-foreground truncate">{webhookUrl}</span>
                  </div>
                  <Button size="icon" onClick={copyToClipboard} className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0 ml-4">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Logs de Atividade
                </CardTitle>
                {state.lastError && (
                    <CardDescription className="text-destructive">
                      Último erro: {state.lastError}
                    </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 w-full rounded-md border">
                  <div className="p-4 text-sm">
                    {state.logs.length === 0 ? (
                      <p className="text-muted-foreground">Nenhuma atividade registrada ainda.</p>
                    ) : (
                      state.logs.map((log, index) => (
                        <div key={index} className="flex items-start">
                          <span className="text-muted-foreground mr-2 font-mono text-xs">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                          <p className={`flex-1 ${log.type === 'ERROR' ? 'text-destructive' : ''}`}>{log.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                 {state.screenshot && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Captura de Tela do Erro:</h4>
                    <a href={getScreenshotUrl(state.screenshot)} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-lg border">
                       <Image src={getScreenshotUrl(state.screenshot)} alt="Captura de tela do erro" width={600} height={400} className="object-cover w-full transition-transform duration-300 group-hover:scale-105"/>
                       <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                         <div className="flex items-center gap-2 text-white font-semibold">
                           Ver imagem completa <ExternalLink className="h-4 w-4" />
                         </div>
                       </div>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <Dialog open={state.status === "AWAITING_2FA"}>
        <DialogContent className="sm:max-w-[425px]">
          <Form {...twoFaForm}>
            <form onSubmit={twoFaForm.handleSubmit(handle2faSubmit)}>
              <DialogHeader>
                <DialogTitle>Verificação de Segurança</DialogTitle>
                <DialogDescription>
                  Um código de autenticação foi solicitado. Verifique seu e-mail ou app de autenticação e insira o código abaixo.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                 <FormField
                    control={twoFaForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="code" className="text-right">
                          Código de 6 dígitos
                        </FormLabel>
                        <FormControl>
                          <Input id="code" {...field} className="col-span-3" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={is2faPending}>
                   {is2faPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enviar Código
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </main>
  );
}
