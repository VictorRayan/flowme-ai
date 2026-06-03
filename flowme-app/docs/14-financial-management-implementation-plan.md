# Personal Finance Management Implementation Plan

## Product Goal

Build Flow Me's personal finance layer so the user can record expenses naturally through WhatsApp, Balys, or the web platform, then see a monthly dashboard and receive practical financial guidance in Weekly and Monthly Reviews.

The system should feel like a personal finance manager, not an accounting tool. The user says what happened in normal language; Flow Me stores the structured financial record, consolidates the month, and helps the user decide what to cut, preserve, or invest.

## Product Principles

1. Natural input first.
   - Users can say "gastei 42 no almoço", "Uber 28 ontem", or "paguei 1200 de imposto".
   - Balys resolves amount, date, category, and context internally.
   - Never ask the user for IDs, category IDs, transaction IDs, or technical terms.

2. Dashboard as the source of truth.
   - The platform must show the consolidated monthly financial picture.
   - Balys should answer from stored financial data, not from memory or chat history alone.

3. Default currency is defined during onboarding.
   - The user's main currency is collected once and used across finance screens, Balys summaries, and reviews.
   - MVP should support BRL, USD, EUR, GBP, ARS, MXN, and a controlled fallback list.

4. Deterministic numbers, AI interpretation.
   - Totals, category sums, savings rate, and month comparison must be computed deterministically.
   - AI should classify ambiguous expenses and provide advice, but it must not invent financial totals.

5. Review-ready evidence.
   - Weekly and Monthly Reviews should receive structured financial evidence.
   - The Council/personal finance specialist should reason from totals, category trends, investment rate, and anomalies.

6. Financial goals must be measured, not guessed.
   - If the user has a goal like "poupar R$12K ao ano", Flow Me should derive a monthly target of R$1K.
   - Dashboard and reviews should compare target vs. actual saved/invested for the month.
   - Balys should use deterministic `goal_alignment` evidence instead of loosely recalculating goal adherence.

## Target User Experience

### Onboarding

Add a lightweight finance setup step:

- Required: "Qual moeda você usa para organizar sua vida financeira?"
- Optional, skippable:
  - monthly income estimate
  - monthly investment target
  - emergency reserve target
  - main financial objective

The onboarding should not feel like a bank form. The first release can require only the default currency.

### WhatsApp and Balys Input

Examples:

- "gastei 42 reais no almoço hoje"
- "mercado 342 no cartão"
- "Uber 28,90 ontem à noite"
- "paguei 1200 de imposto"
- "recebi 8500 de salário"
- "investi 1000 no tesouro"

Expected behavior:

- High confidence: record immediately and confirm briefly.
  - "Registrei R$42,00 em alimentação para hoje."
- Missing amount: ask a simple follow-up.
  - "Qual foi o valor?"
- Ambiguous category: record as `needs_review` or ask if ambiguity affects the dashboard materially.
  - "Isso foi alimentação ou mercado?"
- Correction:
  - "Esse Uber foi trabalho" updates the most relevant recent transaction.
- Deletion:
  - "Apaga aquele gasto do mercado" resolves by recent visible human context and asks for confirmation only if ambiguous.

### Web Dashboard

Create `/app/finance` as a real working dashboard, not a marketing page.

Primary monthly view:

- month selector
- total expenses
- total income
- total invested
- monthly balance
- investment rate
- expenses by category
- largest expenses
- recent transactions
- transactions needing review
- month-over-month comparison

First viewport should make the current month understandable at a glance:

- "Junho 2026"
- "Gastos"
- "Receitas"
- "Investido"
- "Saldo"
- "Taxa de investimento"

Secondary areas:

- category breakdown table/chart
- transaction list with filters
- manual transaction entry
- review queue for low-confidence classifications

The interface should be dense, calm, and operational. This is a personal management dashboard, not a decorative landing page.

## Data Model

### `financial_profiles`

Stores user-level finance settings.

Suggested fields:

- `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `default_currency TEXT NOT NULL`
- `monthly_income_target NUMERIC(14,2)`
- `monthly_investment_target NUMERIC(14,2)`
- `emergency_reserve_target NUMERIC(14,2)`
- `main_financial_objective TEXT`
- `risk_profile TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Validation:

- `default_currency` must be an allowed ISO-like currency code.
- MVP accepted values: `BRL`, `USD`, `EUR`, `GBP`, `ARS`, `MXN`.
- Future releases can expand this list.

### `financial_categories`

Stores default and user-custom categories.

Suggested fields:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`
- `name TEXT NOT NULL`
- `kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'investment', 'transfer'))`
- `slug TEXT NOT NULL`
- `is_system BOOLEAN NOT NULL DEFAULT false`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Default expense categories:

- alimentação
- mercado
- transporte
- moradia
- saúde
- educação
- lazer
- assinaturas
- impostos
- família
- trabalho
- viagens
- dívidas
- outros

Default income categories:

- salário
- freelance
- venda
- rendimento
- outros

Default investment categories:

- reserva
- renda fixa
- renda variável
- previdência
- cripto
- outros

### `financial_transactions`

Stores each recorded financial event.

Suggested fields:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'investment', 'transfer'))`
- `amount NUMERIC(14,2) NOT NULL CHECK (amount > 0)`
- `currency TEXT NOT NULL`
- `converted_amount NUMERIC(14,2)`
- `converted_currency TEXT`
- `exchange_rate NUMERIC(18,8)`
- `occurred_on DATE NOT NULL`
- `category_id UUID REFERENCES financial_categories(id)`
- `category_name TEXT NOT NULL`
- `merchant TEXT`
- `description TEXT`
- `payment_method TEXT`
- `source TEXT NOT NULL CHECK (source IN ('web', 'balys', 'whatsapp', 'api', 'import'))`
- `raw_text TEXT`
- `confidence NUMERIC(4,3)`
- `status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'needs_review', 'ignored'))`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Notes:

- Keep `category_name` as a denormalized display fallback so historic transactions remain readable if category definitions change.
- MVP can store foreign-currency transactions without conversion. Dashboard should clearly separate or mark them if conversion is unavailable.
- Later release should add exchange-rate conversion by transaction date.

### `financial_monthly_summaries`

Optional cache for faster dashboard and Balys answers.

Suggested fields:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `month DATE NOT NULL`
- `currency TEXT NOT NULL`
- `total_income NUMERIC(14,2) NOT NULL DEFAULT 0`
- `total_expenses NUMERIC(14,2) NOT NULL DEFAULT 0`
- `total_invested NUMERIC(14,2) NOT NULL DEFAULT 0`
- `net_balance NUMERIC(14,2) NOT NULL DEFAULT 0`
- `investment_rate NUMERIC(8,4)`
- `category_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb`
- `largest_transactions JSONB NOT NULL DEFAULT '[]'::jsonb`
- `alerts JSONB NOT NULL DEFAULT '[]'::jsonb`
- `generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `UNIQUE (user_id, month, currency)`

MVP can compute summaries on read and add this table once volume or review generation needs it.

## APIs

Follow existing internal API conventions with `requireAuth`, `apiSuccess`, and `apiError`.

### `GET /api/finance/profile`

Returns finance profile and default currency.

### `PATCH /api/finance/profile`

Updates default currency and optional finance targets.

Validation:

- reject unsupported currency
- reject negative targets

### `GET /api/finance/transactions`

Query params:

- `month=YYYY-MM`
- `type=expense|income|investment|transfer`
- `category=...`
- `status=confirmed|needs_review|ignored`

Returns transaction list, newest first.

### `POST /api/finance/transactions`

Creates a transaction from structured input.

Required:

- `type`
- `amount`
- `currency` or use profile default
- `occurred_on`

Optional:

- `category_name`
- `merchant`
- `description`
- `payment_method`
- `raw_text`
- `source`
- `confidence`

### `PATCH /api/finance/transactions/[id]`

Updates editable fields.

Use human-facing resolution in Balys tools; do not expose this ID to users.

### `DELETE /api/finance/transactions/[id]`

Deletes or marks ignored, depending on product decision.

Recommendation:

- Web delete can hard delete.
- Balys "apaga" should set `status='ignored'` first for safer recovery.

### `GET /api/finance/summary`

Query params:

- `month=YYYY-MM`

Returns:

- default currency
- totals
- category breakdown
- largest expenses
- recent transactions
- review queue count
- previous-month comparison

## Balys Tools

Add a new tool domain: `finance`.

### `finance.record_transaction`

Use when the user mentions a concrete financial event.

Input:

- `raw_text`
- `type`
- `amount`
- `currency`
- `occurred_on`
- `category_name`
- `merchant`
- `description`
- `payment_method`
- `confidence`

Behavior:

- Use profile default currency when the user omits currency.
- Use today's date in the user's timezone when date is omitted.
- Classify obvious categories deterministically.
- Mark `needs_review` when category or amount confidence is low.

### `finance.get_month_summary`

Use when the user asks:

- "quanto gastei esse mês?"
- "como estão meus gastos?"
- "quanto investi?"
- "qual meu saldo?"

Returns only human-readable data and no technical IDs.

### `finance.list_transactions`

Use for recent transaction lookup, corrections, deletion, and drill-down.

### `finance.update_transaction`

Use for corrections like:

- "esse gasto era transporte"
- "foi ontem, não hoje"
- "o valor certo era 89"

Must resolve by recent context or visible human details.

### `finance.delete_transaction`

Use for:

- "apaga esse gasto"
- "desconsidera o mercado de ontem"

Ask a human-facing confirmation only when multiple transactions match.

### `finance.analyze_financial_health`

Use for higher-level advice.

Inputs:

- month
- optional user question

Should rely on deterministic summary and profile targets.

## Parsing and Classification

### Deterministic parser

Implement a pure helper in `lib/finance/parse-transaction.ts`.

It should handle:

- Brazilian decimal format: `28,90`
- currency symbols: `R$`, `$`, `€`, `£`
- currency words: reais, dólares, euros
- date words: hoje, ontem, amanhã should not apply to expenses except as clarification
- simple merchant/category keywords

Examples:

- "gastei 42 no almoço" -> expense, 42, alimentação
- "Uber 28,90 ontem" -> expense, 28.90, transporte, yesterday
- "recebi salário 8500" -> income, 8500, salário
- "investi 1000" -> investment, 1000

### AI classifier

Use AI only when deterministic rules are insufficient.

The classifier may suggest:

- type
- category
- merchant
- confidence

It must not be the authority for totals.

Low confidence threshold recommendation:

- `confidence < 0.75` -> `needs_review`

## Reviews Integration

### Weekly Review

Extend `WeeklyReviewEvidence` with a `financial` section.

Suggested shape:

```ts
financial: {
  currency: string;
  period_income: number;
  period_expenses: number;
  period_invested: number;
  month_to_date_income: number;
  month_to_date_expenses: number;
  month_to_date_invested: number;
  investment_rate_month_to_date: number | null;
  top_categories: Array<{ category: string; amount: number; share: number }>;
  largest_expenses: Array<{ label: string; amount: number; occurred_on: string; category: string }>;
  needs_review_count: number;
  alerts: string[];
}
```

Update the Weekly Review Council situation so the finance specialist can reason from the structured data.

Important advice rules:

- Do not recommend investment amount if income is missing; ask the user to set income or use only expense-control advice.
- Do not shame spending. Use practical tradeoffs.
- Distinguish fixed costs from discretionary costs when data supports it.
- Mention confidence gaps when there are many `needs_review` transactions.

### Monthly Review

Implemented as the finance-heavy monthly close ritual.

Two implementation options:

1. Extend reviews with `review_type = weekly | monthly`.
2. Create `monthly_reviews`.

Implementation:

- Uses a separate `monthly_reviews` table because monthly review has finance-heavy fields and cadence.
- Runs on the last day of each month at the time configured during onboarding.
- The same time can be edited later in Settings.
- Keep Weekly Review focused on week execution plus financial signals.

Monthly Review should answer:

- How much did I spend?
- Where did money go?
- How much did I invest?
- Did I stay within my targets?
- What should I cut next month?
- What should I automate?
- Is my financial health improving?

## Dashboard UX Specification

### Layout

`/app/finance`

Top bar:

- title: "Finanças"
- month selector
- add transaction button

Metric row:

- Gastos
- Receitas
- Investido
- Saldo
- Taxa de investimento

Main content:

- Category breakdown
- Recent transactions
- Review queue
- Largest expenses
- Monthly comparison

Mobile:

- Metrics stack into two-column cards.
- Category breakdown remains readable without horizontal overflow.
- Transaction list uses compact rows with amount, category, date, and merchant.

### Empty State

If no transactions:

- Show one clear action: "Adicionar despesa"
- Mention WhatsApp/Balys naturally:
  - "Você também pode registrar pelo Balys: 'gastei 42 no almoço'."

### Review Queue

Transactions with `needs_review` should be visible but not scary.

Copy:

- "Precisam de revisão"
- "Confirme a categoria para deixar o dashboard mais preciso."

Actions:

- choose category
- confirm
- ignore

### Manual Entry

Fields:

- type
- amount
- currency, defaulted from profile
- date
- category
- merchant/description
- payment method optional

The form should be optimized for fast entry, not exhaustive accounting.

## Implementation Phases

Progress:

- [x] Add checkboxes to this implementation plan.
- [x] Phase 1 - Finance Foundation
- [x] Phase 2 - Onboarding Currency
- [x] Phase 3 - Balys and WhatsApp Registration
- [x] Phase 4 - Finance Dashboard
- [x] Phase 5 - Weekly Review Evidence
- [x] Phase 6 - Monthly Review
- [x] Phase 7 - Financial Goal Alignment
- [x] Phase 8 - Proactive Finance Queries

### Phase 1 - Finance Foundation

Deliverables:

- [x] migration for `financial_profiles`, `financial_categories`, `financial_transactions`
- [x] RLS policies
- [x] default categories seed strategy
- [x] profile API
- [x] transaction API
- [x] tests for validation and CRUD

Acceptance criteria:

- [x] User has a default currency.
- [x] User can create, list, update, and delete transactions through authenticated API.
- [x] Invalid amount, type, date, and currency are rejected.

### Phase 2 - Onboarding Currency

Deliverables:

- [x] add onboarding step for default currency
- [x] persist to `financial_profiles`
- [x] update settings page to edit currency later
- [x] tests for API behavior
- [ ] e2e or focused UI verification if onboarding flow changes materially

Acceptance criteria:

- [x] New users define currency during onboarding.
- [x] Existing users get a default fallback, preferably `BRL` only if locale/profile indicates Brazil; otherwise ask in finance setup.
- [x] Dashboard and Balys use profile currency.

### Phase 3 - Balys and WhatsApp Registration

Deliverables:

- [x] `lib/finance/parse-transaction.ts`
- [x] finance tools
- [x] tool registry update
- [x] Balys prompt capability update
- [x] WhatsApp path works through the same tools
- [x] tests for parser and tools

Acceptance criteria:

- [x] "gastei 42 no almoço" records a confirmed expense.
- [x] "Uber 28,90 ontem" records transport on yesterday's date.
- [x] Missing amount triggers a natural follow-up.
- [x] Balys confirms in one short sentence.
- [x] No technical IDs appear in user-facing responses.

### Phase 4 - Finance Dashboard

Deliverables:

- [x] `/app/finance`
- [x] `GET /api/finance/summary`
- [x] category breakdown
- [x] monthly cards
- [x] recent transactions
- [x] review queue
- [x] manual entry dialog

Acceptance criteria:

- [x] User can understand current month from first viewport.
- [x] Totals match transaction data.
- [x] Values use the user's default currency formatting.
- [x] Mobile layout has no accidental horizontal overflow.

### Phase 5 - Weekly Review Evidence

Deliverables:

- [x] collect financial evidence in `collectWeeklyReviewEvidence`
- [x] update `WeeklyReviewEvidence`
- [x] update Council situation prompt
- [x] tests for evidence builder and review generation behavior

Acceptance criteria:

- [x] Weekly Review includes week and month-to-date financial signals.
- [x] Finance advice never invents totals.
- [x] If income is missing, review avoids precise investment recommendations.

### Phase 6 - Monthly Review

Deliverables:

- [x] monthly review data model
- [x] monthly review generation route/tool
- [x] monthly review UI section
- [x] Council finance specialist framing
- [x] onboarding configuration for last day of the month and time
- [x] settings configuration for monthly review time

Acceptance criteria:

- [x] User can ask Balys for monthly financial review.
- [x] Platform can show the latest monthly review.
- [x] Review recommends what to cut, what to preserve, and what to invest based on deterministic data.
- [x] Monthly Review runs against the month that closes on the configured last-day schedule.

### Phase 7 - Financial Goal Alignment

Deliverables:

- [x] deterministic parser for financial savings/investment goals
- [x] structured-goal support through `objective_metric`, `target_value`, `unit`, and `timeframe`
- [x] fallback text parsing for goals like "Poupar R$12K ao ano"
- [x] monthly target derivation
- [x] target vs. actual saved comparison
- [x] dashboard goal-adherence section
- [x] Weekly Review financial evidence includes goal alignment
- [x] Monthly Review alerts and next-month focus include goal alignment
- [x] Balys finance summary includes goal alignment
- [x] tests for goal parsing and adherence calculation

Acceptance criteria:

- [x] A yearly savings goal of R$12K becomes a R$1K monthly target.
- [x] Actual saved is computed from invested amount plus positive monthly balance.
- [x] Dashboard shows whether the user is behind or on track.
- [x] Reviews can say if the user is adherent without inventing the math.

### Phase 8 - Proactive Finance Queries

Deliverables:

- [x] deterministic period summaries for "today" and arbitrary date ranges
- [x] itemized transaction listing by month or date range
- [x] financial health evidence for cost-cutting questions
- [x] multi-month financial health trend
- [x] Balys prompt instructions for proactive finance queries
- [x] tests for period summary, itemized list, health analysis, and trends

Acceptance criteria:

- [x] User can ask "quanto gastei hoje?"
- [x] User can ask "quanto gastei do dia X ao dia Y?"
- [x] User can ask "quais foram os gastos deste mês?"
- [x] User can ask "o que deveria cortar?"
- [x] User can ask "como evoluiu minha saúde financeira nos últimos meses?"

## Testing Requirements

Follow the repo TDD rule.

Minimum tests:

- [x] parser tests:
  - [x] BRL format
  - [x] decimal comma
  - [x] date words
  - [x] income
  - [x] investment
  - [x] unknown category
- [x] API tests:
  - [x] profile get/update
  - [x] transaction CRUD
  - [x] validation errors
  - [x] summary totals
- [x] tools tests:
  - [x] record transaction from natural text
  - [x] summary read
  - [x] update by recent context
  - [x] no technical IDs in receipt
- [x] weekly review tests:
  - [x] financial evidence included
  - [x] no investment-rate advice when income absent

Run before completion:

```bash
npm test
npm run build
```

## Open Product Decisions

1. Should MVP hard-delete transactions or mark them as ignored?
   - Recommendation: API supports delete; Balys uses ignored for safer conversational undo.

2. Should default currency be required for all new users?
   - Recommendation: yes.

3. Should monthly income be required?
   - Recommendation: no. Ask optionally; many users will not want to answer during onboarding.

4. Should foreign-currency conversion be in MVP?
   - Recommendation: no. Store original currency first. Add conversion by transaction date after the dashboard is stable.

5. Should budgets by category be in MVP?
   - Recommendation: no. Start with actual spending, then add budgets after users trust the tracking.

## First Release Scope Recommendation

Ship this first:

- [x] onboarding default currency
- [x] transaction storage
- [x] Balys/WhatsApp expense registration
- [x] `/app/finance` monthly dashboard
- [x] summary questions through Balys

Defer:

- [ ] bank/card import
- [ ] automatic exchange rates
- [ ] category budgets
- [ ] recurring expense detection
- [x] dedicated Monthly Review

This first release is already useful: the user records spending naturally, sees the month consolidated on the platform, and starts receiving better financial advice in Weekly Review.
