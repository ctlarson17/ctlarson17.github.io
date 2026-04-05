'use client';

import { useMemo, useState } from 'react';
import type { CivicWatchMeeting, CivicWatchTopic } from '@/lib/civic-watch';

type Props = {
  meetings: CivicWatchMeeting[];
  appVersion: string;
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

function TopicCard({ topic, active, onToggle }: { topic: CivicWatchTopic; active: boolean; onToggle: () => void }) {
  return (
    <div className={`topic-card ${active ? 'active' : ''}`}>
      <button type="button" className="topic-toggle" onClick={onToggle}>
        <div className="topic-toggle-main">
          <span className={`topic-kind ${topic.kind === 'area' ? 'area-kind' : ''}`}>{topic.kind}</span>
          <strong>{topic.tag}</strong>
        </div>
        <div className="topic-toggle-meta">
          <span>{topic.total_minutes} min</span>
          <span>{topic.window_count} windows</span>
          <span>{active ? 'Hide details' : 'Open details'}</span>
        </div>
      </button>

      {active ? (
        <div className="topic-detail">
          <p className="topic-summary">{topic.summary}</p>

          <div className="topic-facts">
            <span className="fact-pill">First seen {topic.first_seen}</span>
            <span className="fact-pill">Last seen {topic.last_seen}</span>
            <span className="fact-pill">Mentions {topic.mention_count}</span>
            {topic.decision_signals ? <span className="fact-pill signal-pill">Decision-like language</span> : null}
            {topic.upcoming_signals ? <span className="fact-pill signal-pill">Upcoming action language</span> : null}
            {topic.position_signals ? <span className="fact-pill signal-pill">Support / opposition language</span> : null}
          </div>

          <div className="snippet-list">
            {topic.representative_snippets?.length ? topic.representative_snippets.map((snippet, index) => (
              <article className="snippet-card" key={`${topic.tag}-${snippet.start_seconds}-${index}`}>
                <div className="snippet-meta-row">
                  <span className="snippet-time">{snippet.start}–{snippet.end}</span>
                  {snippet.video_url ? (
                    <a href={snippet.video_url} target="_blank" rel="noreferrer">Jump to video</a>
                  ) : null}
                </div>
                <p>{snippet.snippet}</p>
              </article>
            )) : (
              <p className="muted">No representative snippets yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CivicWatchPage({ meetings, appVersion }: Props) {
  const [bodyFilter, setBodyFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null);

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
          <div className="small civic-kicker-row">
            <span>🌊 Civic Watch</span>
            <span className="version-pill code">{appVersion}</span>
          </div>
          <h1>Salt Lake civic watchdog</h1>
          <p className="muted civic-intro">
            A running archive of City Council and Planning Commission meetings, published from Vince&apos;s local watchdog pipeline.
            The current build estimates topic windows from transcripts so you can see what came up, how long it stayed live, and where to jump back into the source video.
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
        {filtered.length ? filtered.map((meeting) => {
          const sortedTopics = [...(meeting.topics || [])].sort((a, b) => b.total_minutes - a.total_minutes).slice(0, 8);
          return (
            <article className="civic-card" key={meeting.video_id}>
              <div className="civic-meta-row">
                <span className="civic-badge">{slugBody(meeting.title)}</span>
                <span className="small">Uploaded {normalizeUploadedDate(meeting.uploaded)}</span>
                {meeting.prototype ? <span className="civic-badge muted-badge">Prototype analysis</span> : null}
              </div>
              <h2>{meeting.title}</h2>
              <div className="civic-tags">
                {meeting.issue_hits.map((tag) => (
                  <button type="button" className="tag tag-button" key={`${meeting.video_id}-issue-${tag}`} onClick={() => setTagFilter(tag)}>{tag}</button>
                ))}
                {meeting.area_hits.map((tag) => (
                  <button type="button" className="tag area-tag tag-button" key={`${meeting.video_id}-area-${tag}`} onClick={() => setTagFilter(tag)}>{tag}</button>
                ))}
              </div>

              <div className="meeting-summary-grid">
                <div className="meeting-summary-panel">
                  <div className="small">Top topics by estimated time</div>
                  <div className="topic-glance-list">
                    {sortedTopics.length ? sortedTopics.slice(0, 4).map((topic) => (
                      <button
                        type="button"
                        key={`${meeting.video_id}-${topic.tag}`}
                        className="topic-glance"
                        onClick={() => setSelectedTopicKey(`${meeting.video_id}:${topic.tag}`)}
                      >
                        <span>{topic.tag}</span>
                        <strong>{topic.total_minutes} min</strong>
                      </button>
                    )) : <div className="muted">No topic estimates yet.</div>}
                  </div>
                </div>

                <div className="meeting-summary-panel">
                  <div className="small">What this build can show</div>
                  <ul className="meeting-capabilities">
                    <li>estimated minutes per topic</li>
                    <li>first-pass summaries from transcript windows</li>
                    <li>representative snippets</li>
                    <li>jump links into the source video</li>
                  </ul>
                </div>
              </div>

              {sortedTopics.length ? (
                <div className="topic-section">
                  <div className="section-title-row">
                    <h3>Topic drilldown</h3>
                    <span className="small">Open a topic to inspect summaries, snippets, and timestamps.</span>
                  </div>
                  <div className="topic-list">
                    {sortedTopics.map((topic) => {
                      const key = `${meeting.video_id}:${topic.tag}`;
                      return (
                        <TopicCard
                          key={key}
                          topic={topic}
                          active={selectedTopicKey === key || (tagFilter !== 'All' && topic.tag === tagFilter)}
                          onToggle={() => setSelectedTopicKey(selectedTopicKey === key ? null : key)}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="row wrap civic-actions">
                <a className="btn" href={meeting.url} target="_blank" rel="noreferrer">Open source video</a>
              </div>
            </article>
          );
        }) : (
          <div className="civic-empty">
            <h2>No meetings match those filters.</h2>
            <p className="muted">Try widening the body or tag filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
