export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const gatewayBase = process.env.OPENCLAW_GATEWAY_HTTP_URL;
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
const sessionKey = process.env.OPENCLAW_SESSION_KEY || 'main';

async function callGateway(body: Record<string, unknown>) {
  if (!gatewayBase || !gatewayToken) {
    throw new Error('Gateway env vars missing');
  }

  const response = await fetch(`${gatewayBase}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gatewayToken}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway request failed (${response.status}): ${text}`);
  }

  const json = await response.json();
  return json.result ?? json;
}

export async function fetchSessions() {
  return callGateway({
    tool: 'sessions_list',
    args: {},
    sessionKey,
  });
}

export async function echoReply(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return 'Say something and I\'ll answer.';
  return `Stub mode: the private site is working, auth is working, and the backend is alive. Next step is wiring live Gateway chat over WebSocket.\n\nYou said: ${trimmed}`;
}
