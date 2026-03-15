'use client';

import { useMemo, useState } from 'react';
import type { UiMessage } from '@/lib/types';

const starter: UiMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Private chat UI is live. Right now the backend is scaffolded in a portable way. Next wiring step is live OpenClaw Gateway chat transport.',
  },
  {
    id: 'note',
    role: 'system',
    content: 'Old portfolio files were moved into legacy-portfolio/ so nothing got lost.',
  },
];

export function ChatApp() {
  const [messages, setMessages] = useState<UiMessage[]>(starter);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const status = useMemo(() => (loading ? 'Thinking…' : 'Ready'), [loading]);

  async function submit() {
    const text = draft.trim();
    if (!text || loading) return;

    const userMessage: UiMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chat request failed');

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: json.reply },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: error instanceof Error ? error.message : 'Something went wrong.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card chat-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="small">🌊 Vince</div>
          <h1>Private chat</h1>
          <p>A Vercel-friendly shell built to stay portable if you ever move to Cloudflare.</p>
        </div>

        <div className="sidebar-section sidebar-kv">
          <div><span className="dot" />{status}</div>
          <div>Auth: password cookie</div>
          <div>Host target: Vercel</div>
          <div>Gateway layer: isolated</div>
        </div>

        <div className="sidebar-section">
          <form action="/api/logout" method="post">
            <button className="btn secondary" type="submit">Log out</button>
          </form>
        </div>
      </aside>

      <section className="main">
        <div className="header">
          <div>
            <h2>Chat</h2>
            <div className="small">Start simple. Tighten auth and wire live OpenClaw transport next.</div>
          </div>
        </div>

        <div className="messages">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              {message.content}
            </div>
          ))}
        </div>

        <div className="composer">
          <textarea
            className="textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message Vince…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="row wrap">
            <div className="small">⌘/Ctrl + Enter to send</div>
            <div className="spacer" />
            <button className="btn" onClick={() => void submit()} disabled={loading || !draft.trim()}>
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
