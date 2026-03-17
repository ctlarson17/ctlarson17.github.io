'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClientAttachment, UiMessage, UploadedFile } from '@/lib/types';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { prepareClientAttachments } from '@/lib/client-uploads';
import { formatUserFacingError, normalizeMessageContent } from '@/lib/error-format';
import { uploadAssets } from '@/lib/upload-assets';

const STORAGE_KEY = 'vince-chat-messages-v1';
const MAX_LOCAL_MESSAGES = 150;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fallbackStarter(): UiMessage[] {
  return [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Your private site is connected, but this conversation has no history yet. Say hi and we will start a fresh thread.',
    },
  ];
}

function sanitizeMessage(message: UiMessage): UiMessage {
  return {
    ...message,
    content: normalizeMessageContent(message.content),
  };
}

function sameMessage(a: UiMessage, b: UiMessage) {
  return a.role === b.role && a.content === b.content;
}

function mergeMessages(base: UiMessage[], incoming: UiMessage[]) {
  const merged = [...base.map(sanitizeMessage)];
  for (const rawMessage of incoming) {
    const message = sanitizeMessage(rawMessage);
    const exists = merged.some((entry) => entry.id === message.id || sameMessage(entry, message));
    if (!exists) merged.push(message);
  }
  return merged.slice(-MAX_LOCAL_MESSAGES);
}

export function ChatApp({
  initialMessages,
  appVersion,
}: {
  initialMessages: UiMessage[];
  appVersion: string;
}) {
  const starter: UiMessage[] = initialMessages.length ? initialMessages : fallbackStarter();

  const [messages, setMessages] = useState<UiMessage[]>(starter);
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const status = useMemo(() => {
    if (loading) return 'Thinking…';
    if (historyLoading) return 'Syncing…';
    return 'Ready';
  }, [loading, historyLoading]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedRef = useRef(false);

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(event.clipboardData?.items || []);
    const pastedFiles = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item, index) => makePastedFile(item, index))
      .filter((file): file is File => Boolean(file));

    if (!pastedFiles.length) return;

    event.preventDefault();
    setPendingFiles((current) => [...current, ...pastedFiles]);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window === 'undefined' || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as UiMessage[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      setMessages((current) => mergeMessages(parsed, current));
    } catch {
      // ignore bad local cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-MAX_LOCAL_MESSAGES).map(sanitizeMessage)),
      );
    } catch {
      // ignore storage failures
    }
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function refreshHistory() {
      setHistoryLoading(true);
      try {
        const res = await fetch('/api/history', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'History request failed');
        if (cancelled) return;
        const nextMessages = Array.isArray(json.messages) && json.messages.length ? json.messages : fallbackStarter();
        setMessages((current) => mergeMessages(current, nextMessages));
      } catch {
        // keep local view if remote history fetch fails
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    void refreshHistory();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshHistory();
      }
    };

    window.addEventListener('focus', refreshHistory);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshHistory);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  async function submit() {
    const text = draft.trim();
    if ((!text && pendingFiles.length === 0) || loading) return;

    const uploadedAssets = pendingFiles.length ? await uploadAssets(pendingFiles) : [];
    const attachments: ClientAttachment[] = await prepareClientAttachments(pendingFiles);
    const uploads: UploadedFile[] = [
      ...attachments.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        note: file.note,
      })),
      ...uploadedAssets.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        path: file.path,
        note: file.path,
      })),
    ];

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text || 'Attached files',
      uploads,
    };

    setMessages((current) => [...current, userMessage].slice(-MAX_LOCAL_MESSAGES));
    setDraft('');
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, attachments, uploadedAssets }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chat request failed');

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant' as const, content: String(json.reply) },
      ].slice(-MAX_LOCAL_MESSAGES));
    } catch (error) {
      console.error('[vince-image] submit failure', error);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'system' as const,
          content: formatUserFacingError(error),
        },
      ].slice(-MAX_LOCAL_MESSAGES));
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
            <div className="small code">{appVersion}</div>
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
                      {file.note ? <span className="attachment-note">{file.note}</span> : null}
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
