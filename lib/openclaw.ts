import WebSocket from 'ws';
import type { ClientAttachment } from '@/lib/types';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ToolInvokeResponse<T> = {
  ok?: boolean;
  result?: {
    details?: T;
  };
};

type HistoryMessage = {
  role?: string;
  content?: Array<
    | { type?: 'text'; text?: string }
    | { type?: 'thinking'; thinking?: string }
    | { type?: string; [key: string]: unknown }
  >;
  timestamp?: number;
};

type GatewayEvent = {
  type?: string;
  event?: string;
  payload?: any;
  id?: string;
  ok?: boolean;
  error?: { code?: string; message?: string; details?: unknown };
};

const gatewayBase = process.env.OPENCLAW_GATEWAY_HTTP_URL;
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
const sessionKey = process.env.OPENCLAW_SESSION_KEY || 'agent:main:web:lars-site';
const agentId = process.env.OPENCLAW_AGENT_ID || 'main';

function requireConfig() {
  if (!gatewayBase || !gatewayToken) {
    throw new Error('Gateway env vars missing');
  }
}

function getGatewayWsUrl() {
  requireConfig();
  return gatewayBase!.replace(/^http/, 'ws');
}

function getGatewayOrigin() {
  requireConfig();
  const url = new URL(gatewayBase!);
  return `${url.protocol}//${url.host}`;
}

async function gatewayFetch(path: string, init: RequestInit) {
  requireConfig();

  const response = await fetch(`${gatewayBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway request failed (${response.status}): ${text}`);
  }

  return response;
}

function flattenContent(parts: HistoryMessage['content']) {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => {
      if (part?.type === 'text') return part.text || '';
      return '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function randomId() {
  return crypto.randomUUID();
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

async function openGatewaySocket() {
  const ws = new WebSocket(getGatewayWsUrl(), {
    origin: getGatewayOrigin(),
    headers: {
      Origin: getGatewayOrigin(),
    },
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Gateway websocket connect timeout')), 15000);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.once('error', (error) => {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error('Gateway websocket failed to open'));
    });
  });

  return ws;
}

async function gatewayRpc<T>(ws: WebSocket, method: string, params: object) {
  const id = randomId();

  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Gateway RPC timeout for ${method}`));
    }, 30000);

    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const payload = JSON.parse(String(raw)) as GatewayEvent;
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
      clearTimeout(timeout);
      ws.off('message', onMessage);
    };

    ws.on('message', onMessage);
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
  });
}

async function connectGatewayClient(ws: WebSocket) {
  await gatewayRpc(ws, 'connect', {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'webchat-ui',
      version: 'site-chat',
      platform: 'vercel',
      mode: 'webchat',
      instanceId: randomId(),
    },
    role: 'operator',
    scopes: ['operator.read'],
    caps: ['tool-events'],
    auth: {
      token: gatewayToken,
    },
    userAgent: 'vince-site',
    locale: 'en-US',
  });
}

async function sendViaChatSend(input: string, attachments: ClientAttachment[] = []): Promise<string> {
  const ws = await openGatewaySocket();

  try {
    await connectGatewayClient(ws);

    const runId = randomId();
    let streamedText = '';

    const completion = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for chat response'));
      }, 120000);

      const cleanup = () => {
        clearTimeout(timeout);
        ws.off('message', onMessage);
      };

      const onMessage = (raw: WebSocket.RawData) => {
        try {
          const payload = JSON.parse(String(raw)) as GatewayEvent;
          if (payload.type !== 'event' || payload.event !== 'chat') return;
          const chat = payload.payload;
          if (!chat || chat.sessionKey !== sessionKey) return;
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

      ws.on('message', onMessage);
    });

    await gatewayRpc(ws, 'chat.send', {
      sessionKey,
      message: input,
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

export async function fetchHistory(limit = 20): Promise<ChatMessage[]> {
  const response = await gatewayFetch('/tools/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'sessions_history',
      args: { sessionKey, limit },
      sessionKey,
    }),
  });

  const json = (await response.json()) as ToolInvokeResponse<{ messages?: HistoryMessage[] }>;
  const messages = json?.result?.details?.messages || [];

  return messages
    .map((message, index): ChatMessage => ({
      id: `${message.timestamp || Date.now()}-${index}`,
      role: message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : 'system',
      content: flattenContent(message.content),
    }))
    .filter((message) => message.content);
}

export async function sendMessage(input: string, attachments: ClientAttachment[] = []): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Message is empty');
  }

  if (attachments.some((attachment) => attachment.kind === 'image' && attachment.dataUrl)) {
    return sendViaChatSend(trimmed, attachments);
  }

  const response = await gatewayFetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': agentId,
      'x-openclaw-session-key': sessionKey,
    },
    body: JSON.stringify({
      model: 'openclaw',
      messages: [{ role: 'user', content: trimmed }],
    }),
  });

  const json = await response.json();
  const reply = json?.choices?.[0]?.message?.content;

  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('Gateway returned an empty reply');
  }

  return reply;
}

export function getSessionKey() {
  return sessionKey;
}
