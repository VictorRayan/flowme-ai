# Implementation — Daily briefings (Bom dia / Boa noite)

## Goal

Deliver two short-form summaries per user per day — morning and evening — via:

- Expandable card in `/app/today` (closed: pill with greeting; open: dialog with sections)
- WhatsApp message at the configured time
- Web push that opens the card

Each briefing includes: weather, calendar events from now forward, top active goal, 3 news items per user-selected topic, current online buzz around those topics.

## Decisions captured

| # | Decision |
|---|---|
| Slots | `morning` and `evening`, times configurable in onboarding |
| Topics | Max 3 topics, free-text chips |
| Trigger | Generated at `slot_time - 3 min` via `flowme-cron` so the card is warm when the user opens the app |
| Delivery channels | Web card + WhatsApp + Web Push (Service Worker + Web Push API) |
| News source | Gemini Grounded Search (Phase 2 of `implementation-grok-and-gemini-grounding.md`) |
| Trends source | Grok via `trends.from_topics` — never disclosed as X/Twitter to user |
| Persistence | `briefings` table — one row per `(user, date, slot)`, idempotent regeneration |
| Card UX | Closed = pill, Open = MUI Dialog (`fullScreen` on `xs/sm`) |
| Greeting | Time-based: Bom dia 05–11h59, Boa tarde 12–17h59, Boa noite 18–04h59 |

## Schema

```sql
-- 030_user_daily_routine.sql
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS morning_briefing_time TEXT,        -- "07:00"
  ADD COLUMN IF NOT EXISTS evening_briefing_time TEXT,        -- "21:00"
  ADD COLUMN IF NOT EXISTS briefing_timezone TEXT,            -- IANA tz
  ADD COLUMN IF NOT EXISTS news_topics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS daily_routine_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS briefing_delivery TEXT[] DEFAULT ARRAY['web']; -- web | whatsapp | push

-- 031_briefings.sql
CREATE TABLE IF NOT EXISTS public.briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('morning','evening')),
  briefing_date DATE NOT NULL,
  sections JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  channels_delivered TEXT[] DEFAULT '{}',
  UNIQUE (user_id, slot, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_briefings_user_recent
  ON public.briefings (user_id, briefing_date DESC);

ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY briefings_owner_all ON public.briefings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 032_web_push_subscriptions.sql
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);
```

## File plan

### Backend
| File | Purpose |
|---|---|
| `lib/briefings/composer.ts` (new) | Runs all section fetches in parallel, returns sections JSON |
| `lib/briefings/sections/*.ts` (new) | One file per section (weather, calendar, goal, news, trends) — each returns `{ ok, content }` |
| `lib/briefings/persist.ts` (new) | Upsert `briefings` row, mark delivered |
| `lib/briefings/deliver.ts` (new) | WhatsApp / push fan-out |
| `lib/briefings/scheduler.ts` (new) | List users with slot time within current window |
| `app/api/briefings/route.ts` (new) | `GET /api/briefings?slot=morning|evening|auto` — read or compose |
| `app/api/briefings/run/route.ts` (new) | `POST /api/briefings/run` — cron hook for one slot |
| `app/api/web-push/subscribe/route.ts` (new) | Save user's web push subscription |
| `app/api/web-push/vapid-public-key/route.ts` (new) | Return VAPID public key for client |
| `docker-compose.yml` | `flowme-cron` already in place — extend the bash loop to hit `/api/briefings/run` every 1 min (cheap; endpoint short-circuits if no slot due) |

### Frontend
| File | Purpose |
|---|---|
| `components/briefings/BriefingPill.tsx` (new) | Closed-state card at top of Today |
| `components/briefings/BriefingDialog.tsx` (new) | Open-state Dialog (fullScreen on mobile) |
| `components/briefings/sections/*.tsx` (new) | One Section component per type |
| `components/onboarding/DailyRoutineStep.tsx` (new) | Onboarding step for times + topics + delivery |
| `lib/web-push/client.ts` (new) | Service Worker registration + subscribe helper |
| `public/sw.js` (new) | Service Worker for push handler |
| `app/app/today/page.tsx` (touched) | Mount `BriefingPill` above the day list |
| `app/onboarding/page.tsx` (touched) | Add the new step to the flow |

## Section composition (server side)

```ts
async function composeBriefing(user, slot, ctx) {
  const settled = await Promise.allSettled([
    weatherSection(user.city, ctx),               // weather.get
    calendarSection(user.id, slotWindow(slot), ctx), // calendar.list_events
    goalSection(user.id, ctx),                    // goals.list top active
    newsSection(user.news_topics, ctx),           // web.grounded_search per topic
    trendsSection(user.news_topics, ctx),         // trends.from_topics
  ]);

  return {
    weather:  settled[0].status === 'fulfilled' ? settled[0].value : null,
    calendar: settled[1].status === 'fulfilled' ? settled[1].value : null,
    goal:     settled[2].status === 'fulfilled' ? settled[2].value : null,
    news:     settled[3].status === 'fulfilled' ? settled[3].value : null,
    trends:   settled[4].status === 'fulfilled' ? settled[4].value : null,
  };
}
```

Each section receives a 6-second timeout. Failures show as a friendly "Não consegui pegar X agora" inside the dialog rather than blowing up the whole card.

## Scheduler logic (in `/api/briefings/run`)

```
1. Compute current minute in UTC.
2. SELECT user_id, morning_briefing_time, evening_briefing_time, briefing_timezone, news_topics
   FROM user_profile WHERE daily_routine_enabled = true;
3. For each user:
   - Translate (morning_time - 3min) and (evening_time - 3min) into UTC using their timezone for today.
   - If current minute matches either, dispatch composeBriefing.
4. For each generated briefing:
   - Save to briefings table.
   - If 'whatsapp' in briefing_delivery → send WhatsApp message (deep link to /app/today).
   - If 'push' in briefing_delivery → fan out to all web_push_subscriptions for that user.
5. Log to console with structured fields.
```

## UI states

### BriefingPill
- Loading (composing): "Preparando seu resumo…" + small spinner
- Ready: greeting + subtitle + chevron
- Error: still shows pill, but subtitle is "Toque para tentar de novo"

### BriefingDialog
- Each Section renders one of:
  - Loading: skeleton block (3 lines)
  - Loaded: section-specific render
  - Empty: muted "Sem dados pra esse item agora"
  - Error: "Não consegui pegar X — tenta de novo daqui a pouco"
- Pull-down to dismiss on mobile
- ESC / click-outside / X button on desktop

## Onboarding step

`DailyRoutineStep`:
- TimePicker × 2 (default 07:00 / 21:00)
- ChipInput max 3 topics, placeholder "Adicione tópicos do seu interesse"
- Toggle group for delivery: Web (always on) / WhatsApp (if connected) / Push (browser support check)
- "Pular" button — sets `daily_routine_enabled = false`
- Button "Continuar" enabled when at least 1 topic OR pulado

No technical jargon: "horário", "tópicos do seu interesse", "como quer receber".

## Web Push setup

- Generate VAPID keypair (one-time): `npx web-push generate-vapid-keys` → put in env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `lib/web-push/client.ts` exports `registerWebPush()` — registers `/sw.js`, asks permission, subscribes with `applicationServerKey`, POSTs to `/api/web-push/subscribe`
- `public/sw.js`:
  ```js
  self.addEventListener('push', e => {
    const data = e.data.json();
    self.registration.showNotification(data.title, { body: data.body, icon: '/icon-192.png', data: { url: '/app/today' } });
  });
  self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(clients.openWindow(e.notification.data.url));
  });
  ```
- Server-side: `web-push` npm package signs deliveries with VAPID, hits each subscription's `endpoint`.

## Acceptance criteria

- User completes onboarding choosing 07:00 morning, 21:00 evening, 3 topics — values persisted.
- At 06:57 UTC-adjusted, `flowme-cron` calls the run endpoint and a briefing is generated.
- Opening `/app/today` at 07:01 shows the pill "Bom dia, Victor" already populated (no spinner).
- Tapping the pill opens a dialog showing weather, agenda, goal, 3 news cards, 2-3 trends.
- WhatsApp delivers a short plain-text version with a link to the app.
- Push notification fires; clicking it opens `/app/today` directly.
- No section failure brings down the entire card.
- Mobile: all touch targets ≥ 48px, dialog is fullscreen, copy is in user's language.
- Desktop: dialog centered, max 720px wide.
- Trends section never contains `@handle`, `x.com`, `t.co`.

## Cost back-of-envelope (10k users)

| Item | Per user/day | 10k/day |
|---|---|---|
| Grounded search (3 queries × 2 slots) | 6 calls | 60k calls/day |
| Trends (1 call × 2 slots) | 2 calls | 20k calls/day |
| Briefing storage | ~2 KB JSONB | ~20 MB/day |
| WhatsApp / push delivery | 2 sends | 20k sends/day |

Briefings are generated on a known schedule — load is amortized across the hour matching configured times. No burst from chat path.

## Rollback

- Disable scheduler: set `daily_routine_enabled = false` for all users via single SQL.
- Hide UI: feature flag `BALYS_BRIEFING_UI_ENABLED` gates the pill.
- All net-new tables — drop is safe if the feature is killed entirely.
