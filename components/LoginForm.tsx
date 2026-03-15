'use client';

import { useState } from 'react';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Login failed');
      setLoading(false);
      return;
    }

    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="card login-card">
      <div className="brand">
        <div className="small">🌊 Private assistant</div>
        <h1>Vince</h1>
        <p>A private front door with a warmer, more polished feel. Simple username + password auth first; stronger auth later.</p>
      </div>

      <label className="field">
        <span className="muted">Username</span>
        <input
          className="input"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>

      <label className="field">
        <span className="muted">Password</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />
      </label>

      {error ? <div className="error">{error}</div> : null}

      <button className="btn" disabled={loading || !username.trim() || !password.trim()}>
        {loading ? 'Signing in…' : 'Enter'}
      </button>
    </form>
  );
}
