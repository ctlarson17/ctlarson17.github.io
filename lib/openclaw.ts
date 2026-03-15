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

const gatewayBase = process.env.OPENCLAW_GATEWAY_HTTP_URL;
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
const sessionKey = process.env.OPENCLAW_SESSION_KEY || 'agent:main:web:lars-site';
const agentId = process.env.OPENCLAW_AGENT_ID || 'main';

function requireConfig() {
  if (!gatewayBase || !gatewayToken) {
    throw new Error('Gateway env vars missing');
  }
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

export async function sendMessage(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Message is empty');
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
