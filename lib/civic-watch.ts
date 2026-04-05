import { promises as fs } from 'fs';
import path from 'path';

export type CivicWatchTopicWindow = {
  start_seconds: number;
  end_seconds: number;
  start: string;
  end: string;
  duration_seconds: number;
  video_url?: string;
  snippet: string;
};

export type CivicWatchTopic = {
  tag: string;
  kind: 'issue' | 'area' | string;
  mention_count: number;
  window_count: number;
  total_seconds: number;
  total_minutes: number;
  first_seen: string;
  last_seen: string;
  representative_snippets: CivicWatchTopicWindow[];
  summary: string;
  decision_signals?: boolean;
  upcoming_signals?: boolean;
  position_signals?: boolean;
  windows?: CivicWatchTopicWindow[];
};

export type CivicWatchMeeting = {
  video_id: string;
  title: string;
  uploaded?: string;
  url: string;
  issue_hits: string[];
  area_hits: string[];
  topics?: CivicWatchTopic[];
  prototype?: boolean;
};

const DATA_PATH = path.join(process.cwd(), 'data', 'civic-watch', 'meetings.json');

export async function loadCivicWatchMeetings(): Promise<CivicWatchMeeting[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is CivicWatchMeeting => Boolean(row && typeof row === 'object' && row.video_id && row.title && row.url));
  } catch {
    return [];
  }
}

export function normalizeUploadedDate(value?: string) {
  if (!value || value.length !== 8) return value || 'Unknown';
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return `${year}-${month}-${day}`;
}
