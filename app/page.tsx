import { ChatApp } from '@/components/ChatApp';
import { LoginForm } from '@/components/LoginForm';
import { isAuthenticated } from '@/lib/auth';

export default async function HomePage() {
  const authenticated = await isAuthenticated();

  return (
    <main className="page-shell">
      {authenticated ? <ChatApp /> : <LoginForm />}
    </main>
  );
}
