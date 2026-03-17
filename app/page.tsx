import { ChatApp } from '@/components/ChatApp';
import { LoginForm } from '@/components/LoginForm';
import { isAuthenticated } from '@/lib/auth';
import { fetchHistory } from '@/lib/openclaw';
import pkg from '@/package.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const authenticated = await isAuthenticated();
  const initialMessages = authenticated ? await fetchHistory(20).catch(() => []) : [];
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.NEXT_PUBLIC_APP_COMMIT?.slice(0, 7) || 'local';
  const appVersion = `v${pkg.version}-${sha}`;

  return (
    <main className="page-shell">
      {authenticated ? (
        <ChatApp initialMessages={initialMessages} appVersion={appVersion} />
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
