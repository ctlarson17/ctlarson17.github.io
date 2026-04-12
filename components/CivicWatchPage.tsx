'use client';

import { useMemo, useState } from 'react';
import type { CivicWatchMeeting, CivicWatchTopic } from '@/lib/civic-watch';

type Props = {
  meetings: CivicWatchMeeting[];
  appVersion: string;
};

type TopicChartProps = {
  topics: CivicWatchTopic[];
  onSelect: (topicTag: string) => void;
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

function formatTopicLabel(tag: string) {
  return tag.replace(/-/g, ' ');
}

function cleanSnippetDetail(text?: string) {
  if (!text) return '';

  return text
    .replace(/^\W+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:so|and|but|well|now|okay)\b[,:]?\s+/i, '')
    .replace(/^(?:we are going to|we're going to|we will|they will)\s+/i, '')
    .replace(/^(?:the )?(?:item|agenda item) number\s+\w+[,:-]?\s*/i, '')
    .replace(/^i\s+i\s+/i, 'I ')
    .trim()
    .replace(/[|]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '');
}

function topicDetailLine(topic: CivicWatchTopic) {
  const snippet = cleanSnippetDetail(topic.representative_snippets?.[0]?.snippet);
  if (!snippet) return '';

  const lowerTag = formatTopicLabel(topic.tag).toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  if (lowerSnippet.startsWith(lowerTag)) {
    return snippet;
  }

  return `${formatTopicLabel(topic.tag)}: ${snippet}`;
}

function joinList(parts: string[]) {
  if (parts.length <= 1) return parts[0] || '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function buildMeetingSummary(meeting: CivicWatchMeeting, topics: CivicWatchTopic[]) {
  if (!topics.length) {
    return 'Transcript analysis is still thin here, so this meeting does not have a reliable high-level summary yet.';
  }

  const body = slugBody(meeting.title).toLowerCase();
  const topTopics = topics.slice(0, 3);
  const topicBits = topTopics.map((topic) => `${formatTopicLabel(topic.tag)} (${topic.total_minutes} min)`);
  const lead = `This ${body} meeting was mainly about ${joinList(topicBits)}.`;

  const decisionTags = topics.filter((topic) => topic.decision_signals).map((topic) => formatTopicLabel(topic.tag));
  const upcomingTags = topics.filter((topic) => topic.upcoming_signals).map((topic) => formatTopicLabel(topic.tag));

  const tail: string[] = [];
  if (decisionTags.length) {
    tail.push(`The discussion included segments where potential decisions were on the table around ${joinList(decisionTags.slice(0, 3))}.`);
  }
  if (upcomingTags.length) {
    tail.push(`There were also conversations setting up future hearings or follow-up work around ${joinList(upcomingTags.slice(0, 3))}.`);
  }

  if (!tail.length) {
    tail.push('Use the topic drilldown below to see specific snippets and timestamps for what was debated.');
  }

  return [lead, ...tail].join(' ');
}

function TopicChart({ topics, onSelect }: TopicChartProps) {
  const maxMinutes = Math.max(...topics.map((topic) => topic.total_minutes), 1);

  return (
    <div className="topic-chart" role="img" aria-label="Bar chart of top topics by estimated discussion time">
      {topics.map((topic) => {
        const width = `${Math.max((topic.total_minutes / maxMinutes) * 100, 8)}%`;
        return (
          <button
            type="button"
            key={topic.tag}
            className="topic-chart-row"
            onClick={() => onSelect(topic.tag)}
            aria-label={`Open ${formatTopicLabel(topic.tag)} details`}
          >
            <span className="topic-chart-label">{formatTopicLabel(topic.tag)}</span>
            <span className="topic-chart-bar-wrap">
              <span className="topic-chart-bar" style={{ width }} />
            </span>
            <strong className="topic-chart-value">{topic.total_minutes} min</strong>
          </button>
        );
      })}
    </div>
  );
}

function TopicCard({ topic, active, onToggle }: { topic: CivicWatchTopic; active: boolean; onToggle: () => void }) {
  return (
    <div className={`topic-card ${active ? 'active' : ''}`}>
      <button type="button" className="topic-toggle" onClick={onToggle} aria-expanded={active}>
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
          const summary = buildMeetingSummary(meeting, sortedTopics);
          return (
            <article className="civic-card" key={meeting.video_id}>
              <div className="civic-meta-row">
                <span className="civic-badge">{slugBody(meeting.title)}</span>
                <span className="small">Uploaded {normalizeUploadedDate(meeting.uploaded)}</span>
              </div>
              <h2>{meeting.title}</h2>
              <p className="meeting-lede">{summary}</p>
              {meeting.decision_points?.length ? (
                <ul className="meeting-decisions">
                  {meeting.decision_points.map((point, index) => (
                    <li key={`${meeting.video_id}-dp-${index}`}>{point.summary}</li>
                  ))}
                </ul>
              ) : null}

              <div className="meeting-summary-grid single-panel">
                <div className="meeting-summary-panel">
                  <div className="small">Top topics by estimated time</div>
                  {sortedTopics.length ? (
                    <>
                      <TopicChart
                        topics={sortedTopics.slice(0, 5)}
                        onSelect={(topicTag) => setSelectedTopicKey(`${meeting.video_id}:${topicTag}`)}
                      />
                      <div className="topic-glance-list">
                        {sortedTopics.slice(0, 4).map((topic) => (
                          <button
                            type="button"
                            key={`${meeting.video_id}-${topic.tag}`}
                            className="topic-glance"
                            onClick={() => setSelectedTopicKey(`${meeting.video_id}:${topic.tag}`)}
                            aria-label={`Open ${formatTopicLabel(topic.tag)} details`}
                          >
                            <span>{formatTopicLabel(topic.tag)}</span>
                            <strong>{topic.total_minutes} min</strong>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : <div className="muted">No topic estimates yet.</div>}
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
