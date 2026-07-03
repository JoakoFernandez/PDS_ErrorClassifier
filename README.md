# PDS Error Classifier

> A production-grade microservice that translates cryptic payment errors into kind, actionable messages — dramatically reducing call centre volume.

---

## Overview

The PDS Error Classifier sits between the PDS payment system and the frontend. Every error code — `Error 504`, `CARD_DECLINED`, `invalid param` — is intercepted, classified, and returned as a human-friendly response with clear next steps for the user.

---

## The Problem

Users encountering `Error 504` or `invalid param` have no idea what went wrong or what to do. They call support, wait on hold, and leave frustrated. The PDS payment system emits dozens of technical error codes that mean nothing to non-technical users.

## The Solution

A lightweight Node.js microservice that maps every error code to:

- **A human-friendly title** — calm, non-technical, 60 characters max
- **An empathetic message** — written in second person, never alarming
- **1–3 suggested actions** — specific steps the user can take right now
- **Escalation guidance** — when to route to support vs. self-serve
- **A support reference code** — so users can quote a short code when calling

---

## Architecture

```
  PDS Payment System
         │  error codes
         ▼
┌─────────────────────────────────────────────────────┐
│              Error Classifier Microservice            │
│                                                       │
│  POST /api/v1/classify                                │
│         │                                             │
│         ▼                                             │
│  ┌─────────────────┐    HIT → return immediately      │
│  │  Layer 1        │                                  │
│  │  Static Map     │  O(1) in-process lookup          │
│  │  (28+ codes)    │  No network, no cost             │
│  └────────┬────────┘                                  │
│           │ MISS                                      │
│           ▼                                           │
│  ┌─────────────────┐    HIT → return immediately      │
│  │  Layer 2        │                                  │
│  │  Redis Cache    │  < 2ms, ~$0.000001/call          │
│  │                 │  TTL: 1 hour (configurable)      │
│  └────────┬────────┘                                  │
│           │ MISS                                      │
│           ▼                                           │
│  ┌─────────────────┐    HIT → cache + return          │
│  │  Layer 3        │                                  │
│  │  OpenAI GPT     │  ~500ms, ~$0.001/call            │
│  │  (gpt-4o-mini)  │  Result is cached for future     │
│  └────────┬────────┘                                  │
│           │ MISS / low confidence                     │
│           ▼                                           │
│  ┌─────────────────┐                                  │
│  │  Layer 4        │  Always succeeds                  │
│  │  Safe Fallback  │  Generic but reassuring message   │
│  └─────────────────┘                                  │
└─────────────────────────────────────────────────────┘
         │  ClassifiedError
         ▼
  Frontend / Mobile App
```

### Why This Stack

| Technology | Role | Why |
|---|---|---|
| **Node.js + TypeScript** | API server | Non-blocking I/O for high-concurrency payment flows; type safety across the entire pipeline |
| **Redis** | Classification cache | Sub-millisecond reads; TTL-based expiry; prevents repeated AI calls for the same error |
| **OpenAI (gpt-4o-mini)** | AI fallback classifier | Handles novel/undocumented error codes; ~95% accuracy at low cost |
| **Vue.js** | Dashboard + Simulator | Lightweight reactive UI; single-file HTML for zero-build-step deployment |
| **Zod** | Request validation | Schema validation with TypeScript inference; fail-fast on malformed inputs |
| **Winston** | Logging | Structured JSON logs; child loggers with request IDs for full trace correlation |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Redis (or Docker)
- OpenAI API key *(only for AI-powered mode)*

### Option A — No API Key (Static Map Only)

Start with zero configuration. Known error codes work immediately:

```bash
cp .env.example .env
# Set AI_FALLBACK_ENABLED=false in .env
docker compose up
```

Verify:

```bash
curl -X POST http://localhost:3000/api/v1/classify \
  -H "Content-Type: application/json" \
  -d '{"errorCode": "504"}'
```

### Option B — AI-Powered (with API Key)

```bash
cp .env.example .env
# Set OPENAI_API_KEY, keep AI_FALLBACK_ENABLED=true (default)
docker compose up
```

### Local Development

```bash
npm install
cp .env.example .env
# Set AI_FALLBACK_ENABLED=false to skip OpenAI, or add OPENAI_API_KEY

redis-server        # start Redis (or use Docker)
npm run dev         # starts API in watch mode on port 3000
```

---

## API Reference

### `POST /api/v1/classify`

Classify a single payment error.

**Request body:**

```json
{
  "errorCode": "504",
  "rawMessage": "upstream gateway timeout",
  "context": {
    "paymentMethod": "credit_card",
    "transactionType": "checkout",
    "merchantName": "Acme Store",
    "amount": 99.99,
    "currency": "USD"
  }
}
```

> `rawMessage` and `context` are optional but dramatically improve AI classification accuracy for unknown codes.

**Response:**

```json
{
  "success": true,
  "data": {
    "originalCode": "504",
    "userTitle": "El pago esta tomando mas tiempo de lo normal",
    "userMessage": "Nuestro sistema de pagos esta tardando en responder. No se ha realizado ningun cargo a tu tarjeta. Por favor, intenta de nuevo en unos momentos.",
    "suggestedActions": [
      { "label": "Intentar de nuevo", "description": "Espera unos segundos e intenta realizar el pago otra vez." },
      { "label": "Contactar a soporte", "description": "Nuestro equipo de soporte puede investigar y procesar tu pago de forma manual.", "actionUrl": "/support/chat" }
    ],
    "severity": "high",
    "category": "timeout",
    "shouldEscalateToSupport": false,
    "supportReferenceCode": "PDS-A1B2C3D4",
    "classifiedAt": "2024-01-15T14:30:00.000Z",
    "source": "static_map",
    "confidence": 1.0
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### `POST /api/v1/classify/batch`

Classify up to 20 errors in parallel.

```json
{ "errors": [{ "errorCode": "504" }, { "errorCode": "CARD_DECLINED" }] }
```

### `GET /api/v1/health`

Returns service health including Redis status and static map size.

### `DELETE /api/v1/cache/:errorCode`

Invalidate a cached classification. Useful for hot-patching bad AI results without redeploying.

---

## Response Fields

| Field | Type | Description |
|---|---|---|
| `originalCode` | `string` | The raw error code exactly as received |
| `userTitle` | `string` | ≤60 char title for toast/modal headers |
| `userMessage` | `string` | ≤200 char empathetic explanation |
| `suggestedActions` | `SuggestedAction[]` | 1–3 ordered steps; include `actionUrl` for deep-link CTAs |
| `severity` | `low \| medium \| high \| critical` | Used for UI colour-coding and alerting |
| `category` | `ErrorCategory` | Groups errors for analytics and routing |
| `shouldEscalateToSupport` | `boolean` | `true` for critical/fraud errors |
| `supportReferenceCode` | `string` | Format `PDS-XXXXXXXX`; quote when calling support |
| `source` | `ClassificationSource` | Where the result came from; drives cost/cache analytics |
| `confidence` | `number` | 0–1; always 1.0 for static_map, variable for AI |

---

## Configuration Reference

All configuration is done via environment variables. See `.env.example` for a full template.

### Two Modes of Operation

| Mode | `AI_FALLBACK_ENABLED` | `OPENAI_API_KEY` | Coverage |
|---|---|---|---|
| **Static-only** | `false` | Not needed | 28 known codes + generic fallback |
| **AI-powered** | `true` (default) | Required | 28 known codes + AI for unknowns + fallback |

Start with **Static-only** (no key needed). All common errors work immediately. Add the API key later when you want AI coverage for novel/rare error codes.

### Free LLM Providers (No Credit Card Required)

These OpenAI-compatible APIs work as drop-in replacements:

| Provider | Sign Up | Model | `OPENAI_BASE_URL` |
|---|---|---|---|
| **Groq** | https://console.groq.com | `llama3-70b-8192` | `https://api.groq.com/openai/v1` |
| **Google Gemini** | https://aistudio.google.com | `gemini-2.0-flash` | `https://generativelanguage.googleapis.com/v1beta/openai/` |

Set all three env vars (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`) and it just works.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Required only when `AI_FALLBACK_ENABLED=true` |
| `OPENAI_BASE_URL` | — | API base URL for OpenAI-compatible providers |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name for your chosen provider |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `REDIS_TTL_SECONDS` | `3600` | How long AI results are cached (1 hour) |
| `AI_FALLBACK_ENABLED` | `true` | `false` = static map only; `true` = AI for unknown codes |
| `AI_CONFIDENCE_THRESHOLD` | `0.6` | Minimum AI confidence to accept; below this → fallback |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per IP per minute |
| `LOG_FORMAT` | `json` | `json` for production, `pretty` for development |

---

## Extending the Static Error Map

The static map in `src/utils/staticErrorMap.ts` is the primary extension point.

To add a new payment processor's error codes:

```typescript
// In STATIC_ERROR_MAP:
'STRIPE_CARD_VELOCITY_EXCEEDED': {
  userTitle: 'Demasiados intentos de pago',
  userMessage: "Has realizado demasiados intentos de pago en poco tiempo. Espera 10 minutos antes de intentar de nuevo.",
  suggestedActions: [
    { label: 'Esperar e intentar de nuevo', description: 'Intenta de nuevo despues de 10 minutos.' },
    contactSupport
  ],
  severity: 'medium',
  category: 'rate_limit',
  shouldEscalateToSupport: false,
},
```

**Rules for new entries:**
- `userMessage` must be under 200 characters (may appear in SMS notifications)
- Never mention the raw error code in user-facing fields
- Order `suggestedActions` by likelihood of resolving the issue
- Set `shouldEscalateToSupport: true` only for critical severity or fraud_risk category
- All user-facing text must be in neutral Spanish

---

## Testing

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Coverage report
```

Tests mock Redis and OpenAI so they run without any external services. **10 unit tests** cover all 4 pipeline layers, response shape, and edge cases.

---

## Project Structure

```
pds-error-classifier/
├── src/
│   ├── config/              # Environment configuration (Zod-validated)
│   ├── controllers/         # HTTP request handlers
│   ├── middleware/           # Request ID, logging, error handling, validation
│   ├── routes/              # Express router definitions
│   ├── services/
│   │   ├── cacheService.ts          # Redis cache layer
│   │   ├── openaiService.ts         # OpenAI classification (lazy client)
│   │   └── errorClassifierService.ts # 4-layer pipeline orchestrator
│   ├── types/               # TypeScript interfaces and type aliases
│   ├── utils/
│   │   ├── logger.ts               # Winston structured logger
│   │   └── staticErrorMap.ts       # Hand-curated error map (28 codes)
│   └── index.ts             # Express app bootstrap
├── __tests__/               # Jest unit tests
├── dashboard/
│   ├── index.html           # Vue.js classification dashboard
│   └── simulator.html       # Error simulation test harness
├── Dockerfile               # Multi-stage production build
├── docker-compose.yml       # API + Redis + optional Redis Commander
├── .env.example             # Configuration template
├── jest.setup.js            # Test environment setup
├── package.json             # Dependencies and scripts
└── tsconfig.json            # TypeScript compiler options
```

---

## Project Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API in watch mode (ts-node-dev) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output from `dist/` |
| `npm test` | Run Jest test suite with coverage |
| `npm run docs` | Generate API docs with TypeDoc |

---

## Notes and Observations

### Design Decisions

1. **Pipeline over monolith.** The original proposal suggested a single AI classifier. The 4-layer cascade reduces API costs by 80–90% (most traffic never reaches OpenAI) while maintaining full coverage for novel codes.

2. **Spanish as the interface language.** All user-facing messages — static map, fallback, AI prompt — are in neutral Spanish. This was chosen because the primary user base is Spanish-speaking. The system can be adapted to other languages by updating the static map entries and the AI system prompt.

3. **Optional AI dependency.** The service runs without an API key when `AI_FALLBACK_ENABLED=false`. This eliminates the single point of failure on OpenAI availability and reduces cost to zero for deployments that only need the static map.

4. **Lazy client initialization.** The OpenAI SDK client is created on the first request, not at startup. This prevents configuration errors from crashing the service before it serves a single request.

5. **Cache key design.** Cache keys use only the normalized error code — not the raw message or context. This is intentional: the user-facing message for a given code rarely varies, and including the full message text would create near-infinite unique keys.

6. **Confidence threshold.** When the AI returns a classification with confidence below the configurable threshold (default 0.6), it is discarded in favor of the generic fallback. This prevents the AI from confidently misclassifying obscure codes.

### Operational Considerations

- The `DELETE /api/v1/cache/:errorCode` endpoint allows operations teams to hot-patch a bad AI classification without flushing the entire Redis cache or redeploying the service.
- The health endpoint (`GET /api/v1/health`) returns `207 Multi-Status` when Redis is down — the service is degraded but functional. This is suitable for liveness probes that should not kill the pod on cache failures.
- Rate limiting is applied per IP address. In production, consider adding a second limiter keyed by API key or user ID if the service is exposed to multiple clients.

### Cost Estimate

With the static map handling 80–90% of traffic and Redis caching AI results:

| Volume/day | Redis hits | AI calls | OpenAI cost | Total |
|---|---|---|---|---|
| 10,000 errors | 9,000 | 500 | ~$0.50 | < $1/day |
| 100,000 errors | 90,000 | 5,000 | ~$5.00 | < $10/day |
| 1,000,000 errors | 900,000 | 50,000 | ~$50.00 | < $100/day |

Using free providers (Groq, Gemini) reduces this to near zero.

### Future Improvements

- **Multi-language support** — detect user locale and respond in the appropriate language
- **Analytics dashboard** — track classification sources, cache hit rates, and cost trends
- **Webhook notifications** — alert external systems when critical errors are classified
- **Feedback loop** — users rate the usefulness of each message for continuous improvement
- **A/B testing** — compare classification accuracy across different AI models
- **Expanded static map** — add error codes from Stripe, PayPal, Mercado Pago, and other processors

---

## License

This project is proprietary software developed for the PDS platform.
