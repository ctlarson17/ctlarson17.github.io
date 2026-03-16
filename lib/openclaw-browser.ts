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

type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKeyPkcs8: string;
};

const DEVICE_IDENTITY_KEY = 'vince-openclaw-device-identity-v1';
const DEVICE_TOKEN_STORE_KEY = 'vince-openclaw-device-auth-v1';
const CONNECT_SCOPES = ['operator.admin', 'operator.approvals', 'operator.pairing'];

function randomId() {
  return crypto.randomUUID();
}

function getGatewayWsUrl(gatewayHttpUrl: string) {
  return gatewayHttpUrl.replace(/^http/, 'ws');
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity | null> {
  if (typeof window === 'undefined' || !crypto?.subtle) return null;

  try {
    const raw = window.localStorage.getItem(DEVICE_IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeviceIdentity;
      if (parsed?.deviceId && parsed?.publicKey && parsed?.privateKeyPkcs8) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupt cache
  }

  try {
    const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    const privateKeyPkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
    const identity: DeviceIdentity = {
      deviceId: await sha256Hex(publicKeyRaw),
      publicKey: toBase64Url(publicKeyRaw),
      privateKeyPkcs8: toBase64Url(privateKeyPkcs8),
    };
    window.localStorage.setItem(DEVICE_IDENTITY_KEY, JSON.stringify(identity));
    return identity;
  } catch {
    return null;
  }
}

function getStoredDeviceToken(deviceId: string) {
  try {
    const raw = window.localStorage.getItem(DEVICE_TOKEN_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; deviceId?: string; tokens?: Record<string, { token: string; scopes?: string[] }> };
    if (parsed?.version !== 1 || parsed.deviceId !== deviceId || !parsed.tokens) return null;
    return parsed.tokens.operator?.token || null;
  } catch {
    return null;
  }
}

function storeDeviceToken(deviceId: string, token: string, scopes: string[] = []) {
  try {
    const payload = {
      version: 1,
      deviceId,
      tokens: {
        operator: {
          token,
          scopes,
        },
      },
    };
    window.localStorage.setItem(DEVICE_TOKEN_STORE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
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

async function waitForConnectChallenge(ws: WebSocket) {
  return await new Promise<string | null>((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 1500);

    const onMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(String(event.data ?? '')) as GatewayEvent;
        if (payload.type === 'event' && payload.event === 'connect.challenge' && typeof payload.payload?.nonce === 'string') {
          cleanup();
          resolve(payload.payload.nonce);
        }
      } catch {
        // ignore unrelated messages
      }
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      ws.removeEventListener('message', onMessage as EventListener);
    };

    ws.addEventListener('message', onMessage as EventListener);
  });
}

async function signConnectPayload(identity: DeviceIdentity, nonce: string, token?: string | null) {
  const pkcs8 = fromBase64Url(identity.privateKeyPkcs8);
  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);
  const signedAt = Date.now();
  const message = [
    'v2',
    identity.deviceId,
    'openclaw-control-ui',
    'webchat',
    'operator',
    CONNECT_SCOPES.join(','),
    String(signedAt),
    token ?? '',
    nonce,
  ].join('|');
  const signature = await crypto.subtle.sign('Ed25519', key, new TextEncoder().encode(message));

  return {
    id: identity.deviceId,
    publicKey: identity.publicKey,
    signature: toBase64Url(signature),
    signedAt,
    nonce,
  };
}

async function connectGatewayClient(ws: WebSocket, config: BrowserGatewayConfig) {
  const nonce = await waitForConnectChallenge(ws);
  const identity = nonce ? await loadOrCreateDeviceIdentity() : null;
  const storedDeviceToken = identity ? getStoredDeviceToken(identity.deviceId) : null;
  const preferredToken = storedDeviceToken || config.gatewayToken;

  const device = nonce && identity ? await signConnectPayload(identity, nonce, config.gatewayToken) : undefined;

  const hello = await gatewayRpc<any>(ws, 'connect', {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'openclaw-control-ui',
      version: 'vince-site',
      platform: navigator.platform || 'web',
      mode: 'webchat',
      instanceId: randomId(),
    },
    role: 'operator',
    scopes: CONNECT_SCOPES,
    caps: [],
    auth: {
      token: preferredToken,
    },
    userAgent: navigator.userAgent,
    locale: navigator.language || 'en-US',
    device,
  });

  if (identity && hello?.auth?.deviceToken) {
    storeDeviceToken(identity.deviceId, hello.auth.deviceToken, hello.auth.scopes || []);
  }

  return hello;
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
