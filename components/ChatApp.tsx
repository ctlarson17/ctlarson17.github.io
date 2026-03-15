'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UiMessage } from '@/lib/types';
import { MarkdownMessage } from '@/components/MarkdownMessage';

export function ChatApp({ initialMessages }: { initialMessages: UiMessage[] }) {
  const starter: UiMessage[] = initialMessages.length
    ? initialMessages
    : [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Your private site is connected, but this conversation has no history yet. Say hi and we will start a fresh thread.',
        },
      ];

  const [messages, setMessages] = useState<UiMessage[]>(starter);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const status = useMemo(() => (loading ? 'Thinking…' : 'Ready'), [loading]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

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
          <div>Auth: username + password</div>
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
            <div className="small">Latest messages stay pinned above the composer.</div>
          </div>
        </div>

        <div className="messages">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <MarkdownMessage content={message.content} />
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="composer sticky-composer">
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
