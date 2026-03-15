# Vince private chat

This repo used to hold the public portfolio site. The old files were preserved in `legacy-portfolio/`.

## Current goal

Build a private assistant web app for Lars that is:

- easy to deploy on Vercel
- simple to maintain
- portable enough to move to Cloudflare later
- locked down with basic auth first

## Current state

- Next.js app scaffolded
- password login via secure cookie
- protected chat UI shell
- isolated server-side gateway client layer in `lib/openclaw.ts`
- current `/api/chat` is a stub so the shell can be tested safely before wiring live OpenClaw transport

## Environment variables

Copy `.env.example` to `.env.local` for local dev and set values:

- `APP_PASSWORD`
- `SESSION_COOKIE_SECRET`
- `OPENCLAW_GATEWAY_HTTP_URL`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_SESSION_KEY`

## Local dev

```bash
npm install
npm run dev
```

## Next steps

1. Wire live OpenClaw chat transport over Gateway WebSocket.
2. Improve auth (single-user magic link, OAuth, or Cloudflare Access later).
3. Add conversation history + streaming.
4. Deploy to Vercel and connect the custom domain.
