# Reminders Implementation Plan

## Product Rule

Status: Phase 1 backend, WhatsApp delivery, Balys tools, Settings UI, and create-event modal reminder attachment are implemented. Instagram/ManyChat and Push remain future providers.

Reminders are notifications, not tasks. They must not recreate microactivities, local tasks, or "Flow me event" behavior.

Calendar events remain the source of truth for scheduled work. Reminders may be attached to a Google Calendar event or may exist alone as a notification, but they do not become tasks.

## UX Model

The user manages reminders through channels, not providers.

- WhatsApp appears as the existing WhatsApp channel card used by Balys.
- The card should add reminder controls once the channel is active:
  - "Use for Balys messages"
  - "Use for reminders"
  - "Default reminder channel"
- ManyChat is internal infrastructure and must never appear in customer-facing UI or Balys responses.
- Future Instagram reminders should appear as an Instagram channel, even if the backend provider is ManyChat.
- Future mobile reminders should appear as Push Notifications, backed by native device tokens in a React Native WebView app.

Reminder creation must be available through both:

- UI modal/forms.
- Balys tools using the same service interface as the UI.

## Architecture

Use a provider-agnostic reminders domain:

- `reminders` stores user intent, schedule, message, status, source metadata, and channel preference.
- `reminder_deliveries` stores provider attempts, provider message IDs, delivery status, errors, and retry metadata.
- Channel selection is customer-facing: `default`, `whatsapp`, `instagram`, `push`.
- Provider selection is internal: `whatsapp`, `manychat`, `push`.

Mapping:

| Channel preference | Internal provider | Customer-facing label |
| --- | --- | --- |
| `default` | user's default active reminder channel | Default |
| `whatsapp` | `whatsapp` via Evolution API | WhatsApp |
| `instagram` | `manychat` | Instagram |
| `push` | `push` | Push Notification |

## Database

Add a migration for:

- `reminders`
  - `id`
  - `user_id`
  - `title`
  - `message`
  - `scheduled_for`
  - `timezone`
  - `status`: `scheduled`, `sent`, `cancelled`, `failed`
  - `channel_preference`: `default`, `whatsapp`, `instagram`, `push`
  - `source_type`: currently `calendar_event` or null
  - `source_provider`: currently `google_calendar` or null
  - `source_id`
  - `source_title`
  - `source_start_at`
  - `created_by`: `balys`, `user`, `system`
  - `dedupe_key`
  - `created_at`, `updated_at`
- `reminder_deliveries`
  - `id`
  - `reminder_id`
  - `user_id`
  - `provider`: `whatsapp`, `manychat`, `push`
  - `status`: `pending`, `sent`, `failed`, `retrying`
  - `attempt`
  - `scheduled_for`
  - `sent_at`
  - `provider_message_id`
  - `error`
  - `created_at`, `updated_at`
- Extend `whatsapp_channels`
  - `reminders_enabled`
  - `is_default_reminder_channel`

All tables must use owner-scoped RLS.

## Services

Create `lib/reminders/`:

- `reminders.ts`
  - `createReminder`
  - `listReminders`
  - `cancelReminder`
  - `sendDueReminders`
- `providers.ts`
  - provider interfaces
  - channel-to-provider resolution
  - no customer-facing mention of ManyChat
- `whatsapp-provider.ts`
  - finds the user's active WhatsApp channel with reminders enabled
  - sends via Evolution API `sendText`
- later:
  - `manychat-provider.ts`
  - `push-provider.ts`

`sendDueReminders` must be idempotent enough for cron retries:

- avoid duplicate successful deliveries for the same reminder/provider
- record failed delivery attempts
- move reminder status to `sent` only after provider success
- move reminder status to `failed` when no eligible provider/channel exists or provider send fails

## API

Internal authenticated routes:

- `GET /api/reminders`
  - list reminders, default upcoming/scheduled
  - filters: status, source_type, source_id, date range
- `POST /api/reminders`
  - create standalone or event-attached reminder
  - validate message, scheduled date, channel preference, source metadata
- `PATCH /api/reminders/[id]`
  - update allowed fields before send: message, scheduled_for, channel_preference
- `DELETE /api/reminders/[id]`
  - cancel reminder, returning `{ ok: true, deleted: true }`
- `GET /api/cron/send-reminders`
  - protected by Vercel cron header or `CRON_SECRET`
  - calls `sendDueReminders`

Update `vercel.json` with a reminder cron. Start conservative with every five minutes unless product requires minute-level delivery.

## Balys Tools

Add `lib/ai/tools/reminders-tools.ts` and register the `reminders` domain.

Tools:

- `reminders.create`
  - creates a standalone reminder or an event-attached reminder
  - input includes message, scheduled time, timezone, channel preference, and optional calendar event source
  - when Balys creates a calendar event and the user asks for a reminder, Balys should create the Google Calendar event first, then create the reminder with source metadata from the event receipt
- `reminders.list`
  - reads upcoming reminders
- `reminders.cancel`
  - cancels an existing reminder after resolving it internally

Tool contract:

- Never ask the user for technical IDs.
- Never expose provider names like ManyChat.
- Never claim a reminder was created unless the tool returns success.
- If no active reminder channel exists, return a clear tool error so Balys asks the user to activate a channel.

## Calendar Integration

Calendar event creation must remain Google Calendar only.

Reminder behavior:

- If user says "crie uma reunião amanhã e me lembre 30 minutos antes":
  - create Google Calendar event
  - create reminder attached to that event
- If user says "me lembre amanhã de beber água":
  - create standalone reminder
- If user says "todo plano de ação precisa me lembrar":
  - action plan tools must create Google Calendar events for work items first
  - reminders attach to those events when requested or when a future explicit product setting enables automatic reminders

Do not silently create reminders for every event until the product has an explicit default reminder setting.

## UI Rollout

Phase 1:

- Reuse the existing WhatsApp channel card. Status: implemented.
- Add toggles for reminder activation/default channel. Status: implemented.
- Add basic reminder list to settings or notifications area. Status: implemented in Settings:
  - upcoming
  - sent
  - failed
  - cancelled
- Add reminder modal. Status: implemented for standalone reminders:
  - message
  - date/time
  - channel
  - optional linked calendar event context. Status: implemented through the calendar event modal after event creation.

Phase 2:

- Calendar event modal supports "add reminder". Status: implemented for new Google Calendar events.
- Event detail shows reminders attached to that event.
- Balys event receipts can include attached reminder confirmation.

Phase 3:

- Instagram channel UI, backed internally by ManyChat.
- Push Notifications channel UI for the React Native WebView app.
- Device token registration and push provider.

## Tests

TDD coverage required:

- Migration existence and schema smoke checks where practical.
- `lib/reminders/reminders.test.ts`
  - create/list/cancel
  - invalid schedule/message/channel
  - source metadata preservation
- `lib/reminders/providers.test.ts`
  - channel-to-provider mapping
  - ManyChat remains internal
- `lib/reminders/send-due-reminders.test.ts`
  - WhatsApp success marks sent
  - no active channel marks failed
  - duplicate cron run does not duplicate successful delivery
- `api/reminders.test.ts`
  - GET/POST/PATCH/DELETE
  - required-field validation
  - enum validation
- `api/reminders-cron.test.ts`
  - cron auth
  - service invocation
- `lib/reminders-tools.test.ts`
  - Balys can create standalone reminder
  - Balys can create event-attached reminder
  - registry exposes reminders domain
- Update WhatsApp channel tests for reminder toggles/default channel.

## Open Decisions

- Exact default reminder schedule behavior: none by default, or user-configurable default like 10 minutes before event.
- Retry policy: fixed retry count versus exponential backoff.
- Whether failed reminders should notify Balys/admin logs only or surface in UI immediately.
- Where the first reminder list lives: settings channel area versus a dedicated notifications page.
