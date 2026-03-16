import type { ClientAttachment } from '@/lib/types';

type BrowserGatewayConfig = {
  gatewayHttpUrl: string;
  gatewayToken: string;
  sessionKey: string;
};

type GatewayEvent = {
  type?: string;
  event?: string;
  payload?: any;
  id?: string;
  ok?: boolean;
  error?: { code?: string; message?: string; details?: unknown };
};

function randomId() {
  return crypto.randomUUID();
}

function getGatewayWsUrl(gatewayHttpUrl: string) {
  return gatewayHttpUrl.replace(/^http/, 'ws');
}

function extractTextFromMessage(message: any): string {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string') return message.text.trim();

  const content = Array.isArray(message.content) ? message.content : [];
  return content
    .map((part: any) => (part?.type === 'text' ? part.text || '' : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], content: match[2] };
}

function buildGatewayAttachments(attachments: ClientAttachment[]) {
  return attachments
    .filter((attachment) => attachment.kind === 'image' && typeof attachment.dataUrl === 'string')
    .map((attachment) => {
      const parsed = parseDataUrl(attachment.dataUrl!);
      if (!parsed) return null;
      return {
        type: 'image',
        mimeType: parsed.mimeType,
        content: parsed.content,
      };
    })
    .filter(Boolean);
}

async function gatewayRpc<T>(ws: WebSocket, method: string, params: object) {
  const id = randomId();

  return await new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Gateway RPC timeout for ${method}`));
    }, 30000);

    const onMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(String(event.data ?? '')) as GatewayEvent;
        if (payload.type !== 'res' || payload.id !== id) return;
        cleanup();
        if (payload.ok) resolve(payload.payload as T);
        else reject(new Error(payload.error?.message || `Gateway RPC failed for ${method}`));
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error('Invalid gateway RPC response'));
      }
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      ws.removeEventListener('message', onMessage as EventListener);
    };

    ws.addEventListener('message', onMessage as EventListener);
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
  });
}

async function connectGatewayClient(ws: WebSocket, config: BrowserGatewayConfig) {
  await gatewayRpc(ws, 'connect', {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'webchat-ui',
      version: 'site-chat-browser',
      platform: navigator.platform || 'web',
      mode: 'webchat',
      instanceId: randomId(),
    },
    role: 'operator',
    scopes: ['operator.read'],
    caps: ['tool-events'],
    auth: {
      token: config.gatewayToken,
    },
    userAgent: navigator.userAgent,
    locale: navigator.language || 'en-US',
  });
}

async function openGatewaySocket(config: BrowserGatewayConfig) {
  const ws = new WebSocket(getGatewayWsUrl(config.gatewayHttpUrl));

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Gateway websocket connect timeout')), 15000);

    const handleOpen = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Gateway websocket failed to open'));
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      ws.removeEventListener('open', handleOpen);
      ws.removeEventListener('error', handleError);
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('error', handleError);
  });

  return ws;
}

export async function sendMessageViaBrowserGateway(
  input: string,
  attachments: ClientAttachment[],
  config: BrowserGatewayConfig,
): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed && attachments.length === 0) {
    throw new Error('Message is empty');
  }

  const ws = await openGatewaySocket(config);

  try {
    await connectGatewayClient(ws, config);

    const runId = randomId();
    let streamedText = '';

    const completion = new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for chat response'));
      }, 120000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        ws.removeEventListener('message', onMessage as EventListener);
      };

      const onMessage = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(String(event.data ?? '')) as GatewayEvent;
          if (payload.type !== 'event' || payload.event !== 'chat') return;
          const chat = payload.payload;
          if (!chat || chat.sessionKey !== config.sessionKey) return;
          if (chat.runId && chat.runId !== runId) return;

          if (chat.state === 'delta') {
            const deltaText = extractTextFromMessage(chat.message);
            if (deltaText && deltaText.length >= streamedText.length) streamedText = deltaText;
            return;
          }

          if (chat.state === 'final' || chat.state === 'aborted') {
            const finalText = extractTextFromMessage(chat.message) || streamedText;
            cleanup();
            if (!finalText.trim()) reject(new Error('Gateway returned an empty reply'));
            else resolve(finalText.trim());
            return;
          }

          if (chat.state === 'error') {
            cleanup();
            reject(new Error(chat.errorMessage || 'Chat send failed'));
          }
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error('Invalid chat event payload'));
        }
      };

      ws.addEventListener('message', onMessage as EventListener);
    });

    await gatewayRpc(ws, 'chat.send', {
      sessionKey: config.sessionKey,
      message: trimmed,
      deliver: false,
      idempotencyKey: runId,
      attachments: buildGatewayAttachments(attachments),
    });

    return await completion;
  } finally {
    try {
      ws.close();
    } catch {
      // ignore close errors
    }
  }
}
