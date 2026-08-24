# HB Real Estate CRM

Independent Next.js CRM starter for HB Real Estate.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- MongoDB Atlas
- Mongoose
- Zod validation
- Vercel-ready serverless API routes

## Development

```bash
npm run dev
```

## HB AI Assistant (Phase 8)

The `/ai` workspace uses a server-only, provider-independent AI layer. Gemini can call only the approved read-only CRM tools; every tool reapplies the authenticated agent scope before querying MongoDB. Conversations belong to the signed-in user and usage/rate limits are stored in MongoDB for serverless compatibility.

Configure these values locally and in Vercel (never use a `NEXT_PUBLIC_` prefix):

```env
GEMINI_API_KEY=
AI_PROVIDER=gemini
AI_MODEL=gemini-3.5-flash
AI_MAX_TOOL_CALLS=6
AI_MAX_CONTEXT_ITEMS=20
AI_MAX_HISTORY_MESSAGES=8
AI_DAILY_REQUEST_LIMIT_AGENT=50
AI_DAILY_REQUEST_LIMIT_ADMIN=200
AI_REQUESTS_PER_MINUTE=8
AI_REQUEST_TIMEOUT_MS=25000
```

Without `GEMINI_API_KEY`, the AI page remains available but chat is disabled and no production-like mock data is generated.

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run build
```

## Key Routes

- `/dashboard`
- `/properties`
- `/projects`
- `/customers`
- `/matches`
- `/follow-ups`
- `/agents`
- `/import-center`
- `/automation`
- `/reports`
- `/notifications`
- `/settings`

## API Routes

- `GET /api/health`
- `GET|POST /api/agents`
- `GET|POST /api/customers`
- `GET|POST /api/follow-ups`
- `GET|POST /api/properties`

## Environment

Use `.env.local` for local secrets and `.env.example` as the shareable template.
Do not commit real database credentials.
