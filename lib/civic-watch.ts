import { promises as fs } from 'fs';
import path from 'path';

export type CivicWatchMeeting = {
  video_id: string;
  title: string;
  uploaded?: string;
  url: string;
  issue_hits: string[];
  area_hits: string[];
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
