# Goal Operating System PRD

Status: living product requirements and revalidation checklist.

Last updated: 2026-05-02

This document defines what the Goal Operating System must do before implementation details are chosen. Each checkpoint has product requirements, validation gates, and common implementation mistakes to avoid.

## Product Thesis

Flowme turns long-term goals into daily execution. Balys helps the user define meaningful goals, translate them into monthly and weekly commitments, create daily tasks, and adapt the plan when life changes.

The product should feel like an operating system for intent: the user says where they want to go, Balys helps build and maintain the day-to-day path.

## Core Definitions

### Events

Every executable user commitment is an Event.

Flowme Events and Google Calendar events differ by source and sync behavior, not by duration or importance:

- Flowme Event: a Flowme-native commitment that appears in Today and Calendar.
- Google Calendar event: a synced external calendar event.

Duration only affects display and scheduling. Quick, flexible, goal-driven, action-plan-driven, and time-blocked commitments are all events.

### Goal Plan

A long-term plan tied to a yearly, monthly, or weekly goal. It exists to move the user toward a desired future state.

### Short-Term Action Plan

A focused plan to solve a specific recurring or acute problem. It may stand alone, or it may connect to one or more long-term goals when the problem affects goal progress.

Examples:

- Sleep recovery plan after repeated poor sleep.
- Relationship repair plan after recurring conflict.
- Revenue gap plan after discovering compensation is below market.
- Study catch-up plan before an exam.
- Health recovery plan after sickness or injury.

### Priority Labels

Use these labels across Today, Calendar, Goal dashboards, and Balys decisions:

- `non_negotiable`: critical to goals, deadlines, health, revenue, or important relationships.
- `negotiable`: valuable but movable.
- `routine`: maintenance or repeated baseline activity.

Balys can suggest label changes when context changes, but destructive or major rescheduling changes need user confirmation.

## Planning Framework

Balys should use SMART and GROW silently:

- SMART validates that goals are specific, measurable, achievable, relevant, and time-bound.
- GROW asks clarifying questions about goal, reality, options, and way forward.

Balys should not expose the framework names unless the user asks.

## Product Surfaces

- Balys Chat: creates, updates, reprioritizes, skips, regenerates, and explains goals/plans/tasks.
- Today Dashboard: today's unified execution path from events, not just another calendar view.
- Goals Dashboard: yearly, monthly, and weekly progress.
- Action Plans Dashboard: short-term plans, blockers, linked goals, and review status.
- Calendar: Google Calendar events and Flowme events in schedule context.
- Daily Briefing: today's progress, notable events, and tomorrow's likely focus.

## Out Of Scope For Now

Reminder channels are intentionally out of scope in this PRD.

Do not implement or plan channel-specific reminders yet:

- email reminders
- WhatsApp reminders
- push/browser reminders
- notification queues
- reminder cooldown preferences

Tasks and priorities should still be structured so reminder channels can be added later, but there is no reminder-channel implementation in the current scope.

## Technical Review Observations

These observations exist to prevent implementation mistakes before any checkpoint is coded.

### 1. Unified Task Abstraction Is Mandatory

The product language says "events", but the current system has multiple backing sources: Flowme events, Google Calendar events, and future goal/action-plan generated events.

Implementation must expose a normalized task DTO to UI and Balys:

- stable `task_id`
- `source_type` (`calendar_event`, `goal_task`, `action_plan_task`, `manual`)
- `source_id`
- title
- date/unit day
- duration estimate
- status
- priority label
- goal/action-plan linkage
- whether it is time-blocked

The UI should not need to know every storage detail to render Today.

### 2. Event Must Not Mean "Google Calendar Only"

An event is any user commitment. It may sync to Google Calendar when integration is available and the user allows it, but the product must still work without Google Calendar.

This avoids making core goal execution dependent on an external calendar provider.

### 3. Day Units Need Stable History

The Today path is a day unit. Past day units must preserve what happened that day.

Implementation should avoid recomputing history only from current task state. If a task was moved from Monday to Tuesday, Monday's history should still be able to show that the task was moved, not pretend it never existed.

Expected historical outcomes:

- completed
- skipped with reason
- moved/rescheduled
- incomplete
- newly created that day

### 4. Plan Tasks Need Templates And Occurrences

The system should represent all planned work. When the user accepts a goal or action plan for a defined period, Flowme should materialize concrete Flowme event occurrences for that full period.

Recommended mental model:

- plan template: the intended recurring or future work
- occurrence: the concrete event node for a specific day/week
- scheduled event: time-blocked occurrence, when needed

This preserves the user's full plan without forcing every occurrence into Google Calendar.

### 5. Timezone And Day Boundary Must Be Explicit

Daily units must use the user's timezone, not server UTC. A task near midnight should belong to the user's local day.

Any API that returns a day unit should accept or infer:

- user timezone
- local date
- start/end boundaries for that local day

### 6. Priority Is A Decision, Not Just A Label

`non_negotiable`, `negotiable`, and `routine` affect replanning behavior. They should not be treated as simple UI tags.

Implementation must preserve:

- who set the priority: user, Balys, system default
- why it was set
- whether Balys is allowed to change it without confirmation

### 7. Idempotency Is Required

Goal planning, onboarding persistence, Balys tools, and adaptive replanning must be idempotent enough to survive retries.

Avoid duplicate goals, duplicate tasks, duplicate daily nodes, and duplicate action plans when the same tool/API call is retried.

### 8. Confirmation Boundaries Must Be Consistent

Balys can add low-risk helpful tasks directly. Balys should ask confirmation before:

- deleting/canceling tasks
- moving non-negotiable tasks
- changing long-term goal scope
- creating many future scheduled events
- converting a short-term problem into a long-term goal

### 9. UX Must Separate Calendar From Execution

Calendar answers "when is it?". Today answers "what should I do next and why?".

If Today becomes a calendar clone, the product loses the daily execution loop.

### 10. Reminder Channels Stay Out Of Scope

Do not add channel implementation while building task structure. The data model can remain future-compatible, but email, WhatsApp, push, queues, and reminder preferences are not part of this phase.

## Implementation Revalidation Protocol

Before implementing each checkpoint, revalidate:

- Product: does this match the user-facing behavior in this PRD?
- Data: can the model preserve source, status, history, and links?
- AI: can Balys act safely with the available tool schema?
- UX: can the user understand what happened and undo/adjust when needed?
- Tests: is there at least one realistic scenario test for the behavior?

## Checkpoint 0 - Product Decisions And Cleanup

### Requirement

The product must have one coherent model before new goal features are built:

- all user commitments are events
- duration affects scheduling/display, not event category
- broken or abandoned surfaces should not confuse navigation
- "self" must mean the authenticated user, not a hardcoded person

### Revalidation Gate

- [x] Product definition says every user commitment is an event.
- [x] Broken Flow/Cowork surfaces are removed from navigation and routes.
- [x] Self identity is SaaS-safe and works for any user name.
- [x] Dashboard SQL contains the current goals/rhythm/task foundation needed by future checkpoints.

### Error Risks To Avoid

- Do not hardcode Victor, Leticia, Myself, or any user-specific identity.
- Do not expose separate event categories when the user just asked what they must do.
- Do not keep dead product surfaces that imply features are working when they are not.

## Checkpoint 1 - Data Model And API Requirements

### Requirement

Flowme must persist goals, action plans, tasks, and links between them in a way that supports both long-term plans and short-term problem-solving plans.

### Scope

The data model must support:

- yearly, monthly, and weekly goals
- standalone short-term action plans
- action plans linked to one or more goals
- task origin and linkage
- task priority/category
- concrete task occurrences for day units
- historical task outcomes
- provider-independent event-style tasks
- review and success criteria for action plans

### Revalidation Gate

- [x] `smart_goals` supports yearly, monthly, and weekly goal hierarchy.
- [x] `action_plans` supports `goal_plan` and `short_term_problem`.
- [x] Short-term plans can exist without a linked goal.
- [x] Short-term plans can link to one or more long-term goals.
- [x] Events expose origin: goal, action plan, Balys-created/manual, or calendar.
- [x] Task API exposes a normalized task DTO for Today and Balys.
- [x] Task occurrences preserve historical outcomes at the schema/DTO layer.
- [x] Event-style tasks work even if Google Calendar is not connected.
- [x] APIs protect user data with RLS/auth checks.
- [x] API responses give the UI enough data to show source, priority, and progress.

### Error Risks To Avoid

- Do not store goal progress only as text if dashboards need calculations.
- Do not require every action plan to belong to a goal.
- Do not create task records that cannot trace back to why they exist.

## Checkpoint 2 - Goal Planning Engine Requirements

### Requirement

Balys must convert accepted long-term goals into a concrete plan: yearly goal, monthly milestones, weekly commitments, and executable work.

The full plan must be represented. Concrete daily task occurrences should be created for the active execution window, while future work may be stored as templates/recurrence rules until it becomes actionable.

### Scope

The planning engine must:

- ask clarifying questions when the goal is vague
- create measurable milestones
- estimate task durations or ask if needed how much time each task takes to user
- create Flowme events for all executable work
- use duration and preferred time only to decide whether events are flexible or time-blocked
- ask for time preference when schedule placement is ambiguous
- tag tasks with goal, action plan, day, category, and priority

### Revalidation Gate

- [x] A vague annual goal becomes concrete before persistence.
- [x] Accepted proposal creates a goal hierarchy, not just prose.
- [x] Full future work is represented as templates, recurrence rules, or future occurrences.
- [x] The full accepted period has concrete event nodes.
- [x] Generated events do not split by duration category.
- [ ] Balys asks before placing ambiguous events on the calendar.
- [x] Generated tasks are linked to the source goal/action plan.
- [x] Tests cover duration classification and task generation.

### Error Risks To Avoid

- Do not create daily/weekly tasks without linking them to the accepted plan.
- Do not silently create calendar events when the user has not given enough schedule context.
- Do not create generic motivational tasks that are not measurable.
- Do not limit accepted year-long plans to a seven-day window.

## Checkpoint 3 - Short-Term Action Plan Requirements

### Requirement

Balys must recognize recurring or acute problems and create focused short-term action plans that either solve the problem locally or adjust long-term plans when needed.

### Scope

Balys must evaluate:

- Is this a local problem that needs a short plan?
- Does this problem block an existing goal?
- Does the long-term goal need more steps, a softer schedule, a deadline change, or a priority change?

Short-term action plans may create:

- immediate next action
- daily support tasks
- weekly support tasks
- review/checkpoint task
- events when duration is 5 minutes or more
- Flowme events for all executable work, whether quick, flexible, or time-blocked

### Revalidation Gate

- [ ] A recurring problem can create a standalone short-term action plan.
- [ ] A problem affecting a goal can link to that goal.
- [ ] Balys can suggest long-term plan adjustments when the problem changes reality.
- [ ] Major goal changes require confirmation.
- [ ] Tests cover sleep, revenue, relationship, and repeated-missed-task scenarios.

### Error Risks To Avoid

- Do not treat every bad day as a long-term plan failure.
- Do not change a long-term goal silently because of one short-term disruption.
- Do not create tasks that increase load when the problem is exhaustion or overload.

## Checkpoint 4 - Onboarding Persistence Requirements

### Requirement

The onboarding flow must persist accepted AI goal proposals into real product objects, not just chat text.

### Scope

When a user accepts an onboarding plan, Flowme must create:

- yearly goal
- monthly milestone(s)
- weekly commitment(s)
- action plan
- initial tasks for the first execution window

### Revalidation Gate

- [x] Accepted onboarding proposal survives page navigation within the onboarding flow.
- [x] Complete route receives structured plan payload.
- [x] Partial failures are handled with rollback or clear best-effort reporting.
- [x] Successful setup sends user to the Today Dashboard.
- [x] Tests cover success and required-field failure.

### Error Risks To Avoid

- Do not lose accepted AI proposals between onboarding steps.
- Do not create only a summary note and call it a plan.
- Do not leave orphan tasks if goal creation fails.

## Checkpoint 5 - Balys Goal Tools Requirements

### Requirement

Balys must be able to inspect and modify the user's goal operating system through tools, with confirmation for risky changes.

### Scope

Balys must support:

- listing goals and action plans
- creating long-term goals
- creating short-term action plans
- updating action plans
- linking action plans to goals
- adjusting long-term plans
- creating tasks
- rescheduling tasks
- reprioritizing the day
- marking tasks done
- skipping tasks with a reason

### Revalidation Gate

- [x] Tools return clear receipts that the chat timeline can show.
- [x] Destructive changes require confirmation. No destructive goal tools are shipped in this checkpoint.
- [x] Tool schemas prevent invalid arguments.
- [x] Balys instructions explain when to create tasks vs adjust plans.
- [x] Tool tests cover common and invalid calls.

### Error Risks To Avoid

- Do not let the model pass loose strings where structured objects are required.
- Do not allow silent deletion/cancellation of important user commitments.
- Do not create duplicated tasks when a plan update should modify existing tasks.

## Checkpoint 6 - Today Dashboard Requirements

### Requirement

The Today Dashboard must show the user's executable day as one unified progression path, regardless of whether each task is backed by Google Calendar or Flowme-native storage.

This surface is deliberately different from Calendar. Calendar already shows time and schedule. Today must show momentum, sequence, and focus, similar to a Duolingo-style unit path.

In this model, each day is a unit and each activity inside that day is a task node. The user sees what is next, what is completed, what is locked/dependent, and what matters most.

### Scope

The Today Dashboard must show:

- all today's events
- all today's Flowme events
- non-negotiable tasks
- negotiable tasks
- routine tasks
- goal tags
- action plan source
- completion state
- skip/reschedule options
- Balys priority note when relevant

The primary visual model should be a daily path:

- each day is a unit
- task nodes ordered by recommended execution sequence
- current task highlighted as "continue" or "next"
- completed nodes visually distinct
- blocked or deferred nodes visually distinct
- non-negotiable nodes visually stronger than negotiable nodes
- checkpoint moments for groups of tasks or goal milestones
- ability to open details for any task without losing the path context

The user must be able to navigate across days:

- today opens by default
- previous days are available as history units
- future days may be visible when already planned
- completed historical days show what was done, skipped, moved, or left incomplete
- historical navigation should help the user understand streaks, consistency, and recurring blockers without feeling punished

### Revalidation Gate

- [ ] Today's Google Calendar events and Flowme events appear together.
- [x] Today API can return a day unit with normalized Flowme and Google calendar event nodes.
- [x] The primary view is a progression path, not a calendar clone.
- [x] Each day behaves as a unit.
- [x] Each activity/task behaves as a node inside the day unit.
- [x] Day units use the user's local timezone at the API boundary.
- [x] Today API uses the normalized task DTO rather than leaking storage details.
- [x] The user can immediately identify the next task to continue.
- [x] Completed, blocked, deferred, negotiable, and non-negotiable states are visually distinct.
- [x] User can navigate to past days and review task outcomes.
- [x] Historical days show completed, skipped, moved, and incomplete tasks through the day-unit API.
- [x] Moving a task preserves the previous day's historical outcome.
- [ ] Task source is visible without clutter.
- [x] User can mark done, skip, and move internal tasks to tomorrow.
- [x] Mobile layout works for a daily execution view.
- [ ] No reminder-channel logic appears in this surface yet.

### Error Risks To Avoid

- Do not split the user's day into separate Google and Flowme lists.
- Do not make Today a second calendar.
- Do not copy Duolingo's exact visual identity; use the unit-path concept as interaction inspiration.
- Do not hide why a task matters.
- Do not make non-negotiable tasks impossible to renegotiate when life changes.

## Checkpoint 7 - Goals Dashboard Requirements

### Requirement

The Goals Dashboard must let the user understand year, month, and week progress at a glance, then drill into supporting tasks and plans.

### Scope

The dashboard must support:

- annual goal overview
- monthly milestone progress
- weekly commitment progress
- adherence/completion metrics
- goal detail view
- linked tasks/events
- linked short-term action plans

### Revalidation Gate

- [x] Year view explains high-level progress.
- [x] Month view explains milestone state.
- [x] Week view explains execution/adherence.
- [ ] Goal detail shows linked work and blockers.
- [x] Progress calculations are deterministic and testable.

### Error Risks To Avoid

- Do not infer progress from prose only.
- Do not show vanity progress that is not tied to task completion or measurable milestones.
- Do not hide short-term action plans that are affecting a goal.

## Checkpoint 8 - Action Plans Dashboard Requirements

### Requirement

The Action Plans Dashboard must make short-term problem-solving plans visible, reviewable, and adjustable.

### Scope

The dashboard must show:

- active short-term action plans
- problem statement
- linked goals, if any
- current blockers
- next review date
- success criteria
- next tasks
- status: active, resolved, extended, converted to long-term goal

### Revalidation Gate

- [ ] User can see why each short-term plan exists.
- [ ] User can mark a plan resolved.
- [ ] User can extend a plan.
- [ ] User can convert a recurring plan into a long-term goal.
- [ ] Linked goals are shown when the plan affects broader progress.

### Error Risks To Avoid

- Do not bury short-term plans inside goal detail only.
- Do not leave action plans open forever without review.
- Do not convert a short problem into a long-term goal without user confirmation.

## Checkpoint 9 - Adaptive Reprioritization Requirements

### Requirement

Balys must help the user adapt when life changes, preserving important commitments while reducing unrealistic load.

### Inputs

Adaptive reprioritization should consider:

- current tasks/events
- goal importance
- user context from chat
- available time
- missed/completed task history
- active short-term action plans
- blockers and recurring problems

### Outputs

Balys may propose:

- keep task
- move task
- skip/cancel task
- create new task
- change category
- change priority
- create short-term action plan
- adjust long-term goal plan

### Revalidation Gate

- [ ] Sick/exhausted user gets reduced load, not more load.
- [ ] Major opportunity can create a new high-priority task.
- [ ] Relationship issue can create a repair/reconnection task when aligned.
- [ ] Repeated missed tasks trigger plan difficulty review.
- [ ] Destructive or major changes require confirmation.
- [ ] Tests cover realistic disruption scenarios.

### Error Risks To Avoid

- Do not shame the user for missing tasks.
- Do not optimize for completion rate at the expense of meaning.
- Do not cancel important tasks silently.
- Do not create endless new tasks when the right move is reducing scope.

## Cross-Cutting Requirements

### SaaS Identity

- [ ] The authenticated user may have any name.
- [ ] "Myself" always resolves to the authenticated user's self profile.
- [ ] Named people are user-scoped and must not leak across users.
- [ ] Generated notes must not create fake people such as product names unless explicitly requested.

### Data Integrity

- [ ] Append structured information without overwriting existing notes.
- [ ] Preserve links between goals, plans, tasks, and people.
- [ ] Avoid duplicate tasks, duplicate facts, and duplicate people.
- [ ] RLS protects all user-owned data.

### AI Behavior

- [ ] Balys asks when ambiguity changes schedule, priority, or long-term plan.
- [ ] Balys can act directly for low-risk additive changes.
- [ ] Balys explains tradeoffs for major replans.
- [ ] Balys uses plain language instead of exposing internal frameworks.

### Testing Expectations

- [ ] Unit tests cover planners, cadence parsing, and event normalization.
- [ ] API tests cover auth, invalid payloads, and partial failures.
- [ ] UI tests or manual QA cover Today, Goals, and Action Plans dashboard flows.
- [ ] Realistic scenario tests cover disruption and reprioritization.

## First Complete Loop Acceptance Criteria

- [ ] A new user enters one annual goal during onboarding.
- [ ] Balys asks clarifying questions until the goal is concrete.
- [ ] User accepts the proposal.
- [ ] App persists the yearly goal, monthly milestone, weekly routine, action plan, and first week of tasks.
- [ ] Tasks appear in Today Dashboard and Calendar.
- [ ] User can mark a task done.
- [ ] Balys can update or reprioritize the plan through chat.
- [ ] Balys can create a short-term action plan when a recurring problem threatens a goal.
- [ ] Balys can suggest long-term plan adjustments when the short-term problem changes reality.
- [ ] Daily Briefing can summarize progress.

## Current Product Gaps

- Onboarding AI proposals now persist as goals/plans/tasks when accepted.
- Goal/action-plan foundation API exists, and Balys has initial read/create tools for plans.
- Task/event distinction is now represented in the normalized task DTO and Today MVP, but Calendar/Goals surfaces still need to adopt it more deeply.
- Today Dashboard MVP exists; Goals Dashboard MVP exists.
- Balys can create accepted operating plans and short-term action plans, but does not yet have safe update/reprioritization tools.
- Short-term action plans are modeled in schema/API and Balys tools, but do not yet have a dedicated UI.
- Action Plans Dashboard and problem-resolution loop do not exist yet.

## Implementation Log

### 2026-05-02 - Goal Operating System Foundation

Implemented:

- Migration `022_goal_operating_system_foundation.sql`.
- Dashboard catch-up SQL updated with migration 022.
- `GET/POST /api/goals`.
- `PATCH/DELETE /api/goals/[id]`.
- `GET/POST /api/action-plans`.
- `PATCH/DELETE /api/action-plans/[id]`.
- Multi-goal action-plan linking through `action_plan_goal_links`.
- Goal/task metadata fields needed for Today path, historical outcomes, priority semantics, and source tracing.
- Normalized task DTO in `lib/goals/task-dto.ts`.
- `GET /api/tasks/day` day-unit endpoint.
- `POST /api/tasks/[id]/move` creates a new occurrence and marks the original as moved.
- `lib/goals/planner.ts` deterministic goal planner.
- `lib/goals/persist-plan.ts` shared server-side persistence for accepted plans.
- `POST /api/goals/plan` persists a proposal into goals, action plan, and active task occurrences.
- Onboarding complete route can persist accepted goal proposals.
- Onboarding UI stores accepted proposals and submits them at completion.
- Tests for goals, action plans, task DTO, Today day endpoint, and expanded task metadata.
- Tests for planner, plan persistence route, and onboarding completion.
- Rollback-style cleanup in `persistGoalOperatingPlan` prevents orphan goals/action plans/tasks on partial failure.
- Goal tools registered for Balys: `goals.list`, `goals.create_operating_plan`, and `goals.create_short_action_plan`.
- BALYS.md now explains goal operating behavior, short-term action plans, task duration semantics, and priority labels.
- Today listens for goal/task invalidation signals from Balys-created plans.
- Note editor mention popup cleanup no longer crashes when the popup was already gone.
- `/app/goals` MVP dashboard added with year/month/week goal bands, action plans, linked tasks, and deterministic progress.
- Sidebar navigation now includes Goals.

Validation:

- Jest: 32 suites passed, 226 tests passed.
- TypeScript: no new errors from this slice; existing project-level type errors remain in excluded component tests and linked-accounts test typing.

### 2026-05-02 - Today Day-Unit MVP

Implemented:

- `/app/today` route.
- Sidebar navigation entry for Today.
- Day navigation for previous/today/next units.
- Duolingo-style vertical task path where each task is a node inside the day.
- Current task panel.
- Progress summary for completed/pending/blocked/moved tasks.
- Visual state distinction for completed, pending/current, blocked/deferred, moved/skipped.
- Quick actions for internal task nodes: done, skip, move tomorrow.
- Move tomorrow uses the move endpoint so the original day keeps a moved historical outcome.
- Calendar event nodes are read-only in the path for now.

Validation:

- Jest: 30 suites passed, 221 tests passed.
- TypeScript: no new errors from this slice; existing project-level type errors remain in excluded component tests and linked-accounts test typing.
