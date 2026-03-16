import { ChatApp } from '@/components/ChatApp';
import { LoginForm } from '@/components/LoginForm';
import { isAuthenticated } from '@/lib/auth';
import { fetchHistory } from '@/lib/openclaw';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const authenticated = await isAuthenticated();
  const initialMessages = authenticated ? await fetchHistory(20).catch(() => []) : [];

  return (
    <main className="page-shell">
      {authenticated ? (
        <ChatApp
          initialMessages={initialMessages}
          browserGatewayConfig={{
            gatewayHttpUrl: process.env.OPENCLAW_GATEWAY_HTTP_URL || '',
            gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || '',
            sessionKey: process.env.OPENCLAW_SESSION_KEY || 'agent:main:web:lars-site',
          }}
        />
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
