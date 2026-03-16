'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UiMessage, UploadedFile } from '@/lib/types';
import { MarkdownMessage } from '@/components/MarkdownMessage';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const status = useMemo(() => (loading ? 'Thinking…' : 'Ready'), [loading]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  async function submit() {
    const text = draft.trim();
    if ((!text && pendingFiles.length === 0) || loading) return;

    const uploads: UploadedFile[] = pendingFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    }));

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text || 'Attached files',
      uploads,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', text);
      pendingFiles.forEach((file) => formData.append('files', file));

      const res = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
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
          <p>A private, warm-toned shell for talking with Vince without the cold SaaS look.</p>
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
              {message.uploads?.length ? (
                <div className="attachments">
                  {message.uploads.map((file) => (
                    <div key={`${message.id}-${file.name}-${file.size}`} className="attachment-pill">
                      <span>{file.name}</span>
                      <span className="attachment-meta">{formatBytes(file.size)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="composer sticky-composer">
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            multiple
            onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
          />
          {pendingFiles.length ? (
            <div className="attachments pending-attachments">
              {pendingFiles.map((file) => (
                <div key={`${file.name}-${file.size}`} className="attachment-pill">
                  <span>{file.name}</span>
                  <span className="attachment-meta">{formatBytes(file.size)}</span>
                </div>
              ))}
            </div>
          ) : null}
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
            <button className="btn secondary" type="button" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              Attach files
            </button>
            <div className="small">⌘/Ctrl + Enter to send</div>
            <div className="spacer" />
            <button className="btn" onClick={() => void submit()} disabled={loading || (!draft.trim() && pendingFiles.length === 0)}>
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
