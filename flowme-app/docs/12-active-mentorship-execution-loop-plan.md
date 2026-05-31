# Active Mentorship and Execution Loop

## 1. Objective

Flow Me should move from a set of useful productivity actions to an active
mentorship loop:

1. Understand what the user planned.
2. Observe what actually happened.
3. Detect recurring execution problems.
4. Help the user reorganize the agenda with precision.
5. Ask for a daily briefing note at the right moment.
6. Turn evidence into practical feedback and action plans.

The product must preserve a simple mental model:

- Google Calendar events are the source of truth for scheduled commitments.
- Reminders are notifications, not tasks.
- Balys speaks in natural language and never asks the user for event IDs,
  connector IDs, OAuth terms, or tool names.
- Potentially disruptive calendar mutations require a preview and explicit user
  approval.

## 2. Product Vocabulary

Use distinct names for distinct concepts. This avoids turning every daily
artifact into a "briefing".

| Concept | PT-BR label | Meaning |
| --- | --- | --- |
| Daily summary | Resumo do dia | Generated snapshot of the day. Existing briefing infrastructure. |
| Daily briefing note | Nota de daily briefing | Existing daily note where the user writes or sends audio about what happened and why. |
| Weekly review | Revisao semanal | Generated mentorship review based on execution evidence and daily briefing notes. |
| Postponed | Adiado | Event moved to a later time. |
| Advanced | Adiantado | Event moved to an earlier time. |
| Not done | Nao feito | Explicit user response that a commitment was not completed. |
| Incomplete | Sem resposta | Event ended and the user has not answered the post-event check-in yet. |

Keep historical `skipped` outcomes readable for backward compatibility, but
write new explicit failures as `not_done`. The UI should render legacy
`skipped` records as `Nao feito` until they are migrated.

## 3. Existing Foundations to Reuse

The repository already contains important parts of this direction:

- `calendar_event_outcomes` stores event completion state and a free-text
  reason.
- `goal_calendar_events` links Google Calendar events to goals and action plans.
- `action_plan_tasks` stores plan execution outcomes.
- `reminders` and `reminder_deliveries` schedule WhatsApp reminder delivery.
- `sendDueReminders()` is already invoked by the cron container.
- Briefing delivery already supports WhatsApp and web push.
- The Today trail already opens event actions and writes outcomes.
- Balys already has Google Calendar tools, goal replanning tools, council tools,
  memory tools, and WhatsApp conversations.

Extend these pieces. Do not create a second task model or a separate
notification system.

## 4. Architecture Principles

### 4.1 Preserve both current state and history

The current start time of an event is not enough to understand behavior. Every
reschedule must append an immutable ledger entry. Never overwrite history.

For each change, preserve:

- initial allocation;
- previous allocation;
- final allocation after the change;
- signed offset from the previous allocation;
- total signed offset from the initial allocation;
- whether the event was `postponed` or `advanced`;
- how long before the previous event start the change happened;
- who or what caused the change;
- whether the change belonged to an approved multi-event proposal.

This supports observations such as:

> You postponed four study blocks this week. Three were changed less than one
> hour before they started. This suggests the problem is anticipation, not only
> lack of available time.

### 4.2 Use deterministic evidence before AI interpretation

SQL and application services compute facts: completion rate, postponement rate,
late changes, recurring reasons, affected goals, and time offsets.

Balys and the Council interpret those facts, identify patterns, and recommend
next steps. They must not invent evidence or infer missing outcomes as facts.

### 4.3 Separate proposals from mutations

Multi-event replanning has two moments:

1. Build and revise a proposal.
2. Apply an explicitly approved proposal.

Balys may inspect availability and prepare a precise agenda without changing
Google Calendar. Only the apply step mutates upstream events.

### 4.4 Deliver notifications idempotently

Every scheduled notification needs a stable dedupe key. Cron may run repeatedly
without sending duplicates.

## 5. Data Model

Use staged migrations after `038_slack_connector.sql`.

### 5.1 Migration 039: calendar reschedule history

Create `calendar_event_snapshots`.

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `user_id` | Owner |
| `linked_account_id` | Google linked account |
| `provider_event_id` | Internal storage only; never shown to the user |
| `event_title` | Latest observed title |
| `initial_start_at`, `initial_end_at` | Immutable first observed allocation |
| `current_start_at`, `current_end_at` | Latest observed allocation |
| `provider_updated_at` | Latest Google Calendar update timestamp |
| `observed_at` | Last reconciliation timestamp |
| `created_at`, `updated_at` | Audit timestamps |

Add a unique constraint on `(user_id, linked_account_id, provider_event_id)`.

Create `calendar_event_reschedules`.

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `user_id` | Owner |
| `linked_account_id` | Google linked account |
| `provider_event_id` | Event reference |
| `event_title` | Human-readable snapshot |
| `initial_start_at`, `initial_end_at` | Original allocation |
| `previous_start_at`, `previous_end_at` | Allocation before this change |
| `new_start_at`, `new_end_at` | Allocation after this change |
| `offset_minutes` | `new_start_at - previous_start_at`, signed |
| `total_offset_minutes` | `new_start_at - initial_start_at`, signed |
| `movement_type` | `postponed`, `advanced`, or `unchanged` |
| `minutes_before_previous_start` | Previous start minus change time |
| `changed_by` | `user_ui`, `balys`, `batch_replan`, `google_external`, `system` |
| `proposal_id` | Nullable approved proposal reference |
| `source_context` | JSONB for origin metadata |
| `changed_at` | Effective observation or mutation time |

Add indexes for user/date-range analysis, provider event history, and proposal
history.

Create `lib/calendar/event-reschedule-history.ts` with:

- `observeCalendarEvent()`;
- `recordCalendarReschedule()`;
- `listCalendarRescheduleHistory()`;
- `summarizeCalendarReschedulePatterns()`.

Instrument every mutation path:

- calendar drag-and-drop and edit API;
- `calendar.update_event`;
- goal calendar rescheduling;
- approved batch replanning;
- external Google Calendar reconciliation.

Start with periodic reconciliation. A later optimization may use Google
Calendar watch channels, but polling is simpler and sufficient for the first
reliable version.

### 5.2 Migration 040: replanning proposals

Create `calendar_reschedule_proposals`.

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `user_id` | Owner |
| `status` | `draft`, `awaiting_approval`, `approved`, `applying`, `applied`, `partially_applied`, `rejected`, `expired` |
| `problem_summary` | What the user is trying to solve |
| `diagnosis_summary` | Council-backed diagnosis when applicable |
| `recommendation_summary` | Human-readable proposed solution |
| `created_by` | `balys` or `user` |
| `expires_at` | Proposal lifetime |
| `created_at`, `updated_at`, `applied_at` | Audit timestamps |

Create `calendar_reschedule_proposal_items`.

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `proposal_id` | Parent proposal |
| `linked_account_id`, `provider_event_id` | Internal event reference |
| `event_title` | Human-readable receipt |
| `previous_start_at`, `previous_end_at` | Existing slot |
| `proposed_start_at`, `proposed_end_at` | Suggested slot |
| `availability_status` | `available`, `conflict`, `needs_review` |
| `apply_status` | `pending`, `applied`, `failed` |
| `failure_reason` | Nullable retry/debug context |
| `sort_order` | Stable display order |

The apply service updates events one by one, records immutable receipts, and
returns partial failure details. It must never report full success if one event
failed.

### 5.3 Migration 041: notification orchestration and check-ins

Evolve `reminders` rather than replacing it.

Add:

| Column | Notes |
| --- | --- |
| `reminder_kind` | `manual`, `calendar_pre_event`, `event_outcome_check`, `daily_briefing_note_prompt`, `weekly_review_prompt` |
| `delivery_channels` | Array containing `whatsapp` and/or `push` |
| `cta_url` | Optional internal app deep link |
| `payload` | JSONB for provider-independent context |
| `source_occurrence_key` | Stable key for recurring event occurrences |

Keep `channel_preference` temporarily for backward compatibility. Migrate the
sender toward one delivery record per selected provider.

Create `notification_targets`.

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `token` | Opaque unique URL token |
| `user_id` | Owner |
| `target_kind` | `today_task`, `daily_briefing_note`, `weekly_review` |
| `target_payload` | JSONB internal reference |
| `expires_at`, `consumed_at` | Lifecycle |
| `created_at` | Audit timestamp |

Use `/app/today?focus=<opaque-token>` for post-event CTAs. The Today page
resolves the token for the authenticated user, scrolls to the commitment, and
opens its action component. Do not expose Google event IDs in the URL.

Extend outcome storage:

- add canonical `not_done`;
- add `reason_code`;
- retain `outcome_reason` as the short free-text detail;
- add `answered_at`;
- add `answer_source`: `today_ui`, `push`, `whatsapp`, or `balys`.

### 5.4 Migration 042: reviews and mentorship preferences

Reuse the existing `notes` record with `note_type=daily_briefing` as the
canonical user-authored daily briefing note. Do not create a parallel reflection
record for the same content.

Create `weekly_reviews`.

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `user_id` | Owner |
| `period_start`, `period_end` | User-local review period |
| `status` | `collecting`, `awaiting_briefing`, `generating`, `ready`, `failed` |
| `evidence` | JSONB deterministic metrics and source references |
| `review_content` | JSONB structured Council-backed feedback |
| `suggested_action_plan` | JSONB nullable proposal, never auto-created |
| `created_at`, `updated_at`, `delivered_at` | Lifecycle |

Add user preferences:

- `daily_briefing_note_prompt_enabled`;
- `daily_briefing_note_time`;
- `weekly_review_enabled`;
- `weekly_review_weekday`;
- `weekly_review_time`;
- `notification_timezone`;
- `notification_language`;
- `mirror_calendar_reminders_to_whatsapp`;
- `post_event_checkin_channels`;
- `daily_briefing_note_channels`;
- `weekly_review_channels`.

## 6. Feature Delivery Plan

### Phase 1: Event allocation history

Deliver the immutable reschedule ledger first. It creates evidence for every
later mentorship feature.

Tasks:

1. Add migration 039 and history service.
2. Instrument app-originated Google Calendar mutations.
3. Add a small reconciliation cron for externally edited events.
4. Add `calendar.list_reschedule_history` for Balys.
5. Add human-friendly summaries: number of postponements, advancements, average
   offset, total offset, and late postponements.
6. Define `late postponement` as a configurable threshold. Start with a
   24-hour product default.

Acceptance:

- Moving an event from 14:00 to 16:00 creates `movement_type=postponed` and
  `offset_minutes=120`.
- Moving it later to 17:00 preserves the initial 14:00 allocation, records
  `offset_minutes=60`, and stores `total_offset_minutes=180`.
- Editing the same event directly in Google Calendar is captured by
  reconciliation with `changed_by=google_external`.
- Balys can explain the pattern without exposing IDs.

### Phase 2: Precise multi-event replanning

Build a reviewable replanning workflow for arbitrary calendar events, not only
goal-linked events.

Balys flow:

1. Understand the user's problem in natural language.
2. Gather relevant events, availability, goals, recent outcomes, and reschedule
   patterns.
3. Invoke the Council when diagnosis benefits from multiple perspectives.
4. Explain the diagnosed problem and recommended approach.
5. Offer an action plan when the solution is complex.
6. Produce a rescheduling proposal with conflict checks.
7. Show the proposed agenda for approval.
8. Revise based on user feedback.
9. Apply only after explicit confirmation.

Add Balys tools:

- `calendar.list_reschedule_history`;
- `calendar.propose_batch_reschedule`;
- `calendar.revise_batch_reschedule`;
- `calendar.apply_batch_reschedule`.

Tool rules:

- Proposal tools may persist drafts but do not mutate Google Calendar.
- Apply requires `confirmed: true`.
- Balys resolves human descriptions such as "move my study sessions from this
  week" internally.
- The apply result lists successful and failed event titles with their old and
  new times.
- Applied items write reschedule ledger entries with
  `changed_by=batch_replan`.

Acceptance:

- The user can reject or adjust only one item without rebuilding the whole
  proposal.
- Conflicting events are surfaced before approval.
- Partial upstream failure is visible and retryable.
- Balys never asks the user to provide Google Calendar IDs.

### Phase 3: Calendar reminder mirroring to WhatsApp

Mirror the event's configured Google Calendar reminder timing into Flow Me
WhatsApp reminders.

Google Calendar behavior to support:

- Event-level reminder overrides.
- `useDefault=true`, resolved from the calendar list entry's
  `defaultReminders`.
- Recurring event occurrences with unique dedupe keys.
- Calendar changes that require reminder cancellation and rematerialization.

Add a cron materializer that looks ahead and creates idempotent
`calendar_pre_event` reminder intents. The existing sender delivers them.

User control:

- Add an onboarding and settings opt-in:
  `Enviar no WhatsApp os lembretes dos meus eventos`.
- Respect linked WhatsApp channel status and `reminders_enabled`.
- Explain timing in user language, such as "15 minutos antes", without exposing
  provider internals.

Acceptance:

- An event configured with a 30-minute reminder creates one WhatsApp delivery
  intent for 30 minutes before the occurrence.
- Re-running cron does not duplicate the delivery.
- Changing the event reminder from 30 to 10 minutes cancels the obsolete intent
  and schedules the new one.
- Default Google Calendar reminders are resolved correctly.

### Phase 4: Post-event completion check-in

After a calendar event ends, ask whether the commitment was completed.

Flow:

1. Materializer finds ended events without an explicit outcome.
2. Create one `event_outcome_check` reminder with WhatsApp and push delivery.
3. Notification CTA links to `/app/today?focus=<opaque-token>`.
4. Today trail opens the exact commitment action component.
5. User chooses `Feito` or `Nao feito`.
6. `Nao feito` opens a compact reason input before saving.

UX for `Nao feito`:

- Suggested reason chips:
  `Imprevisto`, `Nao tive tempo`, `Subestimei a duracao`,
  `Perdeu prioridade`, `Outro`.
- Save at least one reason chip or a short text explanation.
- `Outro` requires free text.
- Keep text concise and mobile friendly.

Keep `incomplete` for events without a response. Do not silently transform an
unanswered event into `not_done`.

Later improvement:

- Let the user answer directly in WhatsApp with natural language such as
  "nao fiz porque surgiu uma reuniao urgente".
- Resolve the answer against the user's pending check-in context and store the
  same structured outcome.

Acceptance:

- The same event receives at most one post-event prompt per occurrence.
- Push and WhatsApp share the same outcome target.
- `Nao feito` cannot be saved without a reason.
- Balys can later compare done, not done, and unanswered commitments.

### Phase 5: Daily briefing note ritual

The current generated evening briefing is useful, but it is different from the
requested user-authored daily briefing note. Keep the existing
`note_type=daily_briefing` note as the canonical place for this ritual.

Flow:

1. At the user's configured local time, send WhatsApp and push prompts.
2. Push CTA opens today's daily briefing note directly:
   `/app/notes?daily_briefing=<YYYY-MM-DD>&focus=editor`.
3. Resolve or create the existing `note_type=daily_briefing` note for the
   authenticated user's local day.
4. Focus the note editor immediately.
5. Accept typed text or audio transcription in the note.
6. Keep the note available to Balys memory and weekly-review evidence through
   the existing daily briefing knowledge-graph flow.

Suggested command palette action:

- `/nota-diaria` - Abrir a nota de daily briefing de hoje.

Keep the existing `/briefing` command unchanged: it generates the automatic
daily summary.

Suggested default:

- Ask for the daily briefing note time during onboarding.
- During migration, seed it from the selected evening briefing time when
  available.
- Keep its configuration separate from generated summary timing so the push
  always represents an invitation to write, not an automatic summary delivery.

Acceptance:

- Scheduling respects the user's timezone.
- Re-running cron does not resend the same daily prompt.
- Push opens or creates today's daily briefing note and focuses its editor.
- A text or transcribed audio note is available to weekly review evidence.

### Phase 6: Weekly mentorship review

Ask the user to configure the weekly review weekday and time during onboarding.
Pre-fill Sunday at 18:00 local time as the suggested default, while allowing the
user to change both values.

At the configured time, send a push notification inviting the user to begin the
review. Its CTA opens Balys with a localized message already filled into the
composer, ready for the user to send:

- PT-BR: `Iniciar Revisao semanal`
- EN: `Start Weekly Review`

Use `/app/ai?prompt=<localized-message>&autofocus=1` as the deep link contract.
Do not auto-send the message: the user sees and confirms the start of the
review.

Evidence collector:

- notes, including daily briefing notes, created during the period;
- calendar commitments and outcomes;
- `not_done` reason distribution;
- unanswered events;
- postponed and advanced events;
- late postponements;
- goal and action-plan progress;
- relevant Balys thread summaries and recent challenges.

If the period has no useful notes or daily briefing content:

1. Mark the review as `awaiting_briefing`.
2. Ask the user for a short weekly briefing.
3. Generate the final review after the response.

Do not fabricate a diagnosis from missing context.

Council-backed output:

1. What happened.
2. What pattern was detected.
3. Evidence behind the pattern.
4. How it affected goals and execution.
5. A practical recommendation.
6. Whether the recommendation is simple enough to apply immediately.
7. When complex, an offer to create an action plan after user approval.

Add a `Revisao` surface in the app and a WhatsApp/push CTA. Keep action plan
creation as a separate confirmed step.

Acceptance:

- A review cites concrete execution evidence.
- Missing daily briefing context creates a prompt, not an invented conclusion.
- Complex recommendations can become action-plan proposals.
- No action plan is created without explicit user approval.

### Phase 7: Onboarding, settings, and education

Update onboarding after the execution loop works end to end.

Teach:

- Writing the daily briefing note helps Balys understand why the day diverged
  from the plan.
- Post-event answers improve the quality of future advice.
- Weekly review converts evidence into a practical recommendation.
- WhatsApp reminder mirroring follows the user's calendar reminder timing.

Collect:

- daily briefing note time;
- weekly review weekday and time;
- WhatsApp reminder mirroring preference;
- post-event notification channels;
- push permission;
- WhatsApp channel readiness.

Update the guided tour and settings UI with the same vocabulary.

Persist the onboarding language as `notification_language`. Push delivery runs
server-side and cannot depend on browser `localStorage` to choose between
`Iniciar Revisao semanal` and `Start Weekly Review`.

## 7. API and Cron Surface

Suggested APIs:

| Route | Purpose |
| --- | --- |
| `GET /api/calendar/reschedule-history` | Authenticated event-history query |
| `POST /api/calendar/reschedule-proposals` | Create a draft proposal |
| `PATCH /api/calendar/reschedule-proposals/[id]` | Revise selected items |
| `POST /api/calendar/reschedule-proposals/[id]/apply` | Apply explicit approval |
| `POST /api/calendar/events/[eventId]/outcome` | Save done or not-done answer |
| `GET /api/notification-targets/[token]` | Resolve authenticated deep-link target |
| `GET /api/weekly-reviews/latest` | Load latest review |
| `POST /api/weekly-reviews/[id]/briefing` | Supply missing weekly context |

Suggested cron endpoints:

| Route | Frequency | Purpose |
| --- | --- | --- |
| `POST /api/cron/reconcile-calendar-events` | Every 5 minutes | Observe external moves |
| `POST /api/cron/materialize-event-notifications` | Every minute | Create pre-event and post-event intents |
| `POST /api/cron/materialize-briefing-note-prompts` | Every minute | Create daily briefing note intents |
| `POST /api/cron/generate-weekly-reviews` | Every 15 minutes | Generate due reviews |
| `POST /api/cron/send-reminders` | Existing cadence | Deliver due intents |

Protect every cron route with the existing cron secret pattern.

## 8. Balys Tool Contracts

Expose narrow tools and keep provider details internal.

### `calendar.list_reschedule_history`

Input:

- natural date range;
- optional human event-title filter;
- optional goal context.

Output:

- human-readable event summaries;
- aggregated postponed/advanced counts;
- late-change signals;
- no raw provider identifiers.

### `calendar.propose_batch_reschedule`

Input:

- natural-language problem summary;
- selected event context resolved internally;
- user constraints;
- target date range.

Output:

- proposal receipt;
- proposed slots;
- conflicts or caveats;
- explicit instruction that approval is still required.

### `calendar.apply_batch_reschedule`

Input:

- internal proposal reference;
- `confirmed: true`.

Output:

- applied event titles and times;
- failed items;
- next action for any partial failure.

### Daily briefing and review tools

Add:

- existing `memory.append_to_briefing`;
- `reviews.get_latest`;
- `reviews.save_weekly_briefing`.

Council tools consume structured evidence assembled by the app. They should not
query broad connector data independently when the app can provide a bounded
weekly context.

## 9. UI Work

### Today trail

- Replace `Pular`/`Skip` with `Nao feito`.
- Remove stale local-task move affordances that call deprecated local move
  routes.
- Add reason dialog or bottom sheet.
- Resolve `focus` token, scroll into view, and open the targeted action bubble.
- Show clear feedback after save.

### Calendar

- Keep drag-and-drop behavior.
- Add a proposal review card for multi-event replanning.
- Show event title, old time, new time, and conflict status.
- Allow item-level revision before applying.

### Settings

- Add a `Mentoria e notificacoes` section.
- Include daily briefing note schedule.
- Include weekly review schedule.
- Include WhatsApp calendar reminder mirroring.
- Include post-event channels.

### Weekly review

- Add a dedicated review page or panel.
- Render evidence, diagnosis, recommendation, and optional action-plan CTA.
- Render an input prompt when status is `awaiting_briefing`.

## 10. Suggested File Map

Likely application areas:

| Area | Files |
| --- | --- |
| Migrations | `supabase/migrations/039_*.sql` through `042_*.sql` |
| History service | `lib/calendar/event-reschedule-history.ts` |
| Reconciliation | `lib/calendar/reconcile-events.ts`, cron route |
| Proposal engine | `lib/calendar/reschedule-proposals.ts` |
| Calendar APIs | `app/api/calendar/**` |
| Balys tools | `lib/ai/tools/calendar-tools.ts`, `lib/ai/tools/registry.ts` |
| Reminder orchestration | `lib/reminders/**`, cron routes |
| Push extraction | Move generic web-push delivery out of briefing-only code |
| Outcomes | `lib/today/event-outcomes.ts`, Today API, Today page |
| Daily briefing note prompt | notification materializer, notes deep link, notes page |
| Reviews | `lib/reviews/**`, API, app page |
| Onboarding | onboarding page, tour content, preference APIs |
| Deployment | `docker-compose.yml` cron command |

Keep `run_on_supabase_dashboard.sql` synchronized with production migration
requirements if that file is still part of the deployment workflow.

## 11. Test Strategy

### Unit tests

- signed movement type and offset calculations;
- initial allocation remains immutable;
- late-postponement threshold;
- Google default reminder resolution;
- reminder dedupe keys for recurring events;
- weekly metric aggregation;
- legacy `skipped` rendering compatibility.

### API tests

- outcome requires a reason for `not_done`;
- opaque focus token enforces ownership and expiry;
- proposal apply requires explicit confirmation;
- partial batch apply returns per-item receipts;
- cron routes reject missing secret;
- repeated materializer runs remain idempotent.

### Integration tests

- UI drag move writes one ledger entry;
- Balys single-event update writes one ledger entry;
- Balys approved batch move writes one entry per event;
- external Calendar edit is recorded by reconciliation;
- post-event prompt reaches WhatsApp and push;
- CTA opens the correct Today action;
- no-briefing week enters `awaiting_briefing`;
- weekly briefing completion regenerates a weekly review;
- weekly review push opens Balys with the localized prompt ready to send;
- daily briefing push opens today's note with the editor focused.

### Manual scenarios

1. Postpone the same event twice and ask Balys what changed.
2. Ask Balys to reorganize three commitments after an unexpected meeting.
3. Reject one suggested slot, revise it, approve the rest, and inspect Google
   Calendar.
4. Configure a Google Calendar event reminder and confirm WhatsApp timing.
5. Mark a commitment `Nao feito`, provide a reason, and verify weekly review
   evidence.
6. Open the daily briefing push and complete the note with an audio message.
7. Open the weekly-review push in PT-BR and confirm that Balys is focused with
   `Iniciar Revisao semanal` ready to send.

## 12. Observability and Safety

Log structured events:

- `calendar_reschedule_observed`;
- `calendar_reschedule_proposal_created`;
- `calendar_reschedule_proposal_applied`;
- `calendar_reschedule_proposal_partial_failure`;
- `notification_intent_materialized`;
- `notification_delivery_sent`;
- `event_outcome_answered`;
- `daily_briefing_note_updated`;
- `weekly_review_generated`.

Monitor:

- duplicate notification prevention;
- failed Google Calendar writes;
- external reconciliation lag;
- notification provider failures;
- unanswered post-event prompts;
- review generation failures.

Use feature flags for:

- reschedule-history reconciliation;
- WhatsApp calendar mirroring;
- post-event check-ins;
- daily briefing note prompts;
- weekly reviews;
- generic batch replanning.

Roll out to internal users first, then a small opt-in cohort.

## 13. Recommended Delivery Order

| Milestone | Scope | Why first |
| --- | --- | --- |
| M1 | Reschedule ledger, instrumentation, reconciliation, Balys read tool | Creates trustworthy evidence |
| M2 | `not_done` UX, reason capture, opaque Today focus link | Captures execution quality |
| M3 | Push extraction, reminder fan-out, post-event prompts | Closes the feedback loop |
| M4 | Google reminder mirroring to WhatsApp | Adds proactive execution support |
| M5 | Proposal-based multi-event replanning | Lets Balys intervene safely |
| M6 | Daily briefing note prompt and deep link | Adds qualitative context |
| M7 | Weekly Council-backed review and action-plan offer | Turns evidence into mentorship |
| M8 | Onboarding, settings polish, cohort rollout | Makes behavior understandable |

M1 through M3 form the smallest useful vertical slice: Flow Me observes a
commitment, asks what happened, records the answer, and gives Balys reliable
history. M4 through M7 make that loop proactive and strategic.

## 14. Product Decisions to Confirm Before Implementation

Recommended defaults:

1. `postponed` and `advanced` are the canonical English movement types.
2. A postponement is considered late when changed 24 hours or less before the
   previous start time.
3. Post-event check-ins are sent immediately after event end with one reminder
   per occurrence.
4. The user configures a daily briefing note time during onboarding. Its push
   opens today's note directly and supports text or audio.
5. The user configures a weekly review weekday and time during onboarding.
   Sunday at 18:00 local time is the pre-filled default.
6. Google Calendar reminder mirroring is an explicit WhatsApp opt-in.
7. `Nao feito` requires a reason chip or short free-text explanation.
8. Weekly review push opens Balys with localized text ready to send:
   `Iniciar Revisao semanal` or `Start Weekly Review`.
9. Weekly review proposes, but never auto-creates, action plans.
