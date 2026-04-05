import { redirect } from 'next/navigation';
import pkg from '@/package.json';
import { CivicWatchPage } from '@/components/CivicWatchPage';
import { isAuthenticated } from '@/lib/auth';
import { loadCivicWatchMeetings } from '@/lib/civic-watch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CivicWatchRoute() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect('/');
  }

  const meetings = await loadCivicWatchMeetings();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.NEXT_PUBLIC_APP_COMMIT?.slice(0, 7) || 'local';
  const appVersion = `v${pkg.version}-${sha}`;
  return <main className="page-shell"><CivicWatchPage meetings={meetings} appVersion={appVersion} /></main>;
}
