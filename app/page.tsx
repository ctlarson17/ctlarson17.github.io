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
        <ChatApp initialMessages={initialMessages} />
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
