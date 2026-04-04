'use client';

import { useMemo, useState } from 'react';
import type { CivicWatchMeeting } from '@/lib/civic-watch';

type Props = {
  meetings: CivicWatchMeeting[];
};

function slugBody(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes('planning commission')) return 'Planning Commission';
  if (lower.includes('council')) return 'City Council';
  return 'Other';
}

function normalizeUploadedDate(value?: string) {
  if (!value || value.length !== 8) return value || 'Unknown';
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return `${year}-${month}-${day}`;
}

export function CivicWatchPage({ meetings }: Props) {
  const [bodyFilter, setBodyFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string>('All');

  const bodies = useMemo(() => ['All', ...Array.from(new Set(meetings.map((m) => slugBody(m.title))))], [meetings]);
  const tags = useMemo(
    () => ['All', ...Array.from(new Set(meetings.flatMap((m) => [...m.issue_hits, ...m.area_hits]))).sort((a, b) => a.localeCompare(b))],
    [meetings],
  );

  const filtered = useMemo(() => {
    return meetings.filter((meeting) => {
      const bodyOk = bodyFilter === 'All' || slugBody(meeting.title) === bodyFilter;
      const tagOk = tagFilter === 'All' || meeting.issue_hits.includes(tagFilter) || meeting.area_hits.includes(tagFilter);
      return bodyOk && tagOk;
    });
  }, [bodyFilter, tagFilter, meetings]);

  return (
    <div className="card civic-shell">
      <div className="civic-header">
        <div>
          <div className="small">🌊 Civic Watch</div>
          <h1>Salt Lake civic watchdog</h1>
          <p className="muted civic-intro">
            A running archive of City Council and Planning Commission meetings, published from Vince&apos;s local watchdog pipeline.
          </p>
        </div>
        <a className="btn secondary" href="/">Back to chat</a>
      </div>

      <div className="civic-toolbar">
        <label className="field compact-field">
          <span className="muted">Body</span>
          <select className="input" value={bodyFilter} onChange={(e) => setBodyFilter(e.target.value)}>
            {bodies.map((body) => (
              <option key={body} value={body}>{body}</option>
            ))}
          </select>
        </label>

        <label className="field compact-field">
          <span className="muted">Tag</span>
          <select className="input" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            {tags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </label>

        <div className="civic-stat small">Showing <strong>{filtered.length}</strong> of <strong>{meetings.length}</strong> meetings</div>
      </div>

      <div className="civic-list">
        {filtered.length ? filtered.map((meeting) => (
          <article className="civic-card" key={meeting.video_id}>
            <div className="civic-meta-row">
              <span className="civic-badge">{slugBody(meeting.title)}</span>
              <span className="small">Uploaded {normalizeUploadedDate(meeting.uploaded)}</span>
              {meeting.prototype ? <span className="civic-badge muted-badge">Prototype summary</span> : null}
            </div>
            <h2>{meeting.title}</h2>
            <div className="civic-tags">
              {meeting.issue_hits.map((tag) => (
                <span className="tag" key={`${meeting.video_id}-issue-${tag}`}>{tag}</span>
              ))}
              {meeting.area_hits.map((tag) => (
                <span className="tag area-tag" key={`${meeting.video_id}-area-${tag}`}>{tag}</span>
              ))}
            </div>
            <div className="row wrap civic-actions">
              <a className="btn" href={meeting.url} target="_blank" rel="noreferrer">Open source video</a>
            </div>
          </article>
        )) : (
          <div className="civic-empty">
            <h2>No meetings match those filters.</h2>
            <p className="muted">Try widening the body or tag filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
