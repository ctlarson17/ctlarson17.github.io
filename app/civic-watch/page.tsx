import { redirect } from 'next/navigation';
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
  return <main className="page-shell"><CivicWatchPage meetings={meetings} /></main>;
}
