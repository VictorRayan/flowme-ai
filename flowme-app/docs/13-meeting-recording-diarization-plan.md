# Meeting Recording, Diarization and Daily Briefing

## 1. Objective

Flow Me should let the user record an in-person or remote conversation from the
device they are already using, turn it into a speaker-separated transcript, and
attach a structured meeting section to the daily briefing note.

The daily briefing meeting section must contain:

1. Meeting name.
2. Subject.
3. Objective.
4. Speaker-attributed transcript.
5. Tasks.

The feature is not a generic voice-note extension. A voice note is short,
single-speaker dictation appended directly to a note. A meeting recording is a
long-running capture with durable audio upload, asynchronous processing,
speaker review, extracted tasks, people mentions, and an immutable transcript.

## 2. Product Contract

The product must be honest about speaker identity:

- Diarization separates voices into stable labels such as `Speaker A` and
  `Speaker B`.
- A name is only applied automatically when there is reliable identity
  evidence.
- When identity is uncertain, Flow Me asks the user to confirm a short speaker
  mapping after processing.
- Flow Me must never silently assign a real person's name from a weak guess.
- Once confirmed, the meeting note uses `@Person` mentions and updates the
  person's profile note with the meeting context.

The user-facing language should be simple:

- `Gravar reuniao`
- `Processando gravacao`
- `Identificamos 3 vozes. Confirme quem participou.`
- `Falante A`, never an internal provider label or technical ID
- `Nao tenho certeza`, when the user cannot identify a speaker

## 3. Market Pattern and Technical Reality

Products use different evidence depending on the capture channel:

| Capture mode | Available evidence | Expected identity quality |
| --- | --- | --- |
| Meeting bot in Zoom, Meet, or Teams | Participant list and platform audio channels | High |
| Desktop app with microphone and system audio | Audio source separation plus calendar attendees | Medium to high for small meetings |
| Mobile or browser recording of a room | One mixed microphone track | Diarization is viable; names need confirmation |
| Uploaded audio file | Audio plus user-provided context | Diarization is viable; names need confirmation |

This distinction matters. A phone on a table can separate different voices, but
it does not inherently know that `Speaker B` is Joao. Market products also ask
users to tag speakers, use calendar context, or learn from prior confirmed
speaker profiles.

Relevant references:

- Notion AI Meeting Notes documents that browser capture receives microphone
  audio only, while its desktop app can receive system audio and microphone
  audio. It also states that speaker labels may be limited for in-person and
  group meetings:
  <https://www.notion.com/help/ai-meeting-notes>
- Otter documents automatic speaker grouping, generic labels for unknown
  speakers, and improvement after the user tags a speaker:
  <https://help.otter.ai/hc/en-us/articles/21665587209367-Speaker-Identification-Overview>
- Fireflies documents that mobile recording can capture in-person meetings,
  while automatic name labels depend on richer meeting-channel evidence:
  <https://fireflies.zendesk.com/hc/en-us/articles/360020248498-How-Fireflies-joins-and-records-your-meetings-FAQs>
- Google Gemini 2.5 Pro and 2.5 Flash accept audio input directly via
  `generateContent` and can return structured output. Diarization is not a
  turnkey field — it is obtained by asking the model for a JSON array of
  segments with `speaker`, `start_s`, `end_s` and `text`. Quality on PT-BR is
  good when the prompt fixes the schema and the audio is normalized:
  <https://ai.google.dev/gemini-api/docs/audio>
- OpenAI exposes `gpt-4o-transcribe-diarize` through the Transcription API with
  `diarized_json` segments containing speaker, start, end, and text:
  <https://developers.openai.com/api/reference/resources/audio>
- AssemblyAI exposes generic speaker diarization and a separate speaker
  identification stage using candidate names or roles:
  <https://www.assemblyai.com/docs/pre-recorded-audio/label-speakers>
  <https://www.assemblyai.com/docs/speech-understanding/speaker-identification>

## 4. Recommended User Experience

### 4.1 Entry points

Add one primary entry point: `Gravar reuniao`.

Expose it in:

- Notes page header next to `Nova nota`.
- Daily briefing note toolbar next to the existing voice-note microphone.
- Mobile bottom action menu.
- Balys command palette as `/reuniao` and `/meeting`.

The existing daily briefing microphone remains unchanged. It is for dictation,
not meeting recording.

### 4.2 Before recording

Open a mobile-friendly full-screen dialog on small screens and a centered dialog
on desktop:

| Field | Behavior |
| --- | --- |
| Meeting name | Required. Suggest nearby calendar event title when available. |
| Subject | Optional before recording. Balys fills it after processing if empty. |
| Objective | Optional before recording. Balys fills it after processing if empty. |
| Participants | Optional people autocomplete. Suggest calendar attendees and existing people. |
| Consent | Required checkbox confirming participants agreed to recording and transcription. |

Primary button: `Iniciar gravacao`.

### 4.3 During recording

Two surfaces coexist during capture: a full recorder page and a persistent
floating popup that follows the user across the app, modeled on the Google Meet
floating window.

#### Full recorder page

Opens when the user starts a recording. Shows:

- elapsed time and live audio-level meter;
- recording indicator and meeting name;
- speaker source toggles (`Microfone`, `Audio do sistema`, `Camera`);
- `Pausar`, `Continuar`, and `Finalizar`;
- periodic chunk upload status with retry hint;
- local recovery state while upload is pending;
- warning before fully leaving the recording.

#### Floating popup (Google Meet style)

The user can navigate away from the recorder page without stopping. A small
draggable floating widget stays on top of the app, on both desktop and mobile,
showing:

- elapsed time;
- audio-level dot;
- `Parar` button (primary, single click to stop and go to finalization);
- expand button to return to the full recorder page;
- mute toggle.

Behavior:

- mounted at the root layout so it persists across page transitions;
- draggable on desktop, snapped to the bottom edge on mobile;
- one global `RecordingProvider` context holds the `MediaRecorder` instance and
  the meeting id, so navigation never tears down the recorder;
- `beforeunload` warns if the user closes the tab;
- the popup is the canonical stop control. Even with the popup hidden, an
  alternate stop control must be available from the recorder page and from the
  notification badge.

#### Chunked upload to keep memory low

Do not keep an entire one-hour meeting only in browser memory. The recorder
cycles audio chunks every two minutes (configurable per environment, default
`120` seconds):

1. `MediaRecorder.start(chunkMs)` emits a `dataavailable` event at each tick.
2. The handler uploads that chunk to `/api/meetings/[id]/chunks` immediately
   and discards the Blob from memory once the server acknowledges.
3. The server stores each chunk in a private R2 prefix
   (`meetings/<meeting_id>/chunks/<sequence>.ext`) — this is the temporary
   processing area Flow Me uses to hold raw audio until transcription consumes
   it.
4. Pending chunks while offline are buffered to IndexedDB with a maximum
   buffer size; if the buffer fills the recorder shows a soft warning.
5. On `Finalizar` the last partial chunk is flushed and the meeting flips to
   `processing`.

A one-hour meeting therefore never accumulates more than two minutes of audio
in JavaScript memory, even on mobile Safari.

### 4.4 After recording — finalization screen

When the user taps `Parar` (popup or recorder page), the app immediately
navigates to a dedicated finalization screen at
`/app/notes/meetings/[id]/finalize`. The meeting status transitions
`recording -> uploading -> processing -> finalization_review`.

The user can also navigate away. The meeting then appears in a `Reunioes`
section under Notes with one of:

- `Enviando audio`
- `Audio pronto, processando` *(post Boundary 1: audio playable from the note)*
- `Refinar falantes`
- `Pronta`
- `Falhou - tentar novamente` *(audio still playable; retry available)*

Tapping `Refinar falantes` re-opens the finalization screen. Tapping
`Falhou - tentar novamente` re-opens the screen in its **failure state**
described below.

#### Failure state on the finalization screen

Once durability boundary 1 has been crossed (Stage 1 finished), any
downstream failure shows the same screen with a different layout:

- the audio player sits at the top, full-width — the user can listen to
  exactly what was recorded;
- a clear status line describes what failed
  (`Falha ao transcrever`, `Falha ao gerar resumo`, `Falha ao salvar`)
  using `failed_stage` from the meeting row;
- a primary button `Tentar de novo` re-queues the pipeline from the failed
  stage — never from Stage 1, so the audio is reused;
- a secondary button `Baixar audio` exports the raw audio for manual
  handling;
- the audio-correction lane stays available even in failure mode for cases
  where a previous run produced a partial transcript that the user wants to
  guide;
- the meeting note is already attached to the recording, so closing the
  screen leaves the user with at least a playable audio in their notes.

This guarantees the recording itself is **never lost** by an AI failure.

#### Stage 1: processing

Polled progress while the server runs the pipeline (Section 8). Shows estimated
time and a single line of context (`Transcrevendo`, `Identificando vozes`,
`Sumarizando`). The user can leave; a web push notification fires when
finalization is ready.

#### Stage 2: refinement (`finalization_review`)

Three regions, stacked:

1. **Cabecalho gerado pela IA** — meeting name, subject, objective. All
   inline-editable. Each field shows a small `Gerado pela IA` label so the
   user understands they can override.

2. **Cartoes de falantes** — one card per detected speaker.

   Each card contains:

   - speaker badge (`Falante A`, color-coded);
   - duration spoken and number of turns;
   - **resumo de falas**: 2-4 sentence summary of what that speaker said,
     generated by the LLM from segments belonging to them;
   - two or three quoted excerpts as evidence;
   - assignment control:
     - search field that filters existing `people` (typeahead);
     - inline button `Criar pessoa` that creates a `people` row on the fly
       using the typed name; the new person is immediately selectable;
     - option `Manter como Falante A` to preserve the generic label.

   The assignment is per-speaker, not per-segment. Reassigning the speaker
   propagates to every segment attributed to that provider label.

3. **Faixa de correcao por audio** — a secondary lane below the cards:

   - prompt: `A IA confundiu vozes? Grave um audio explicando.`
   - record button → captures a short voice note in the same component used
     for daily briefing dictation;
   - the user can say things like
     `Falante 1 e Falante 2 sao a mesma pessoa, o Joao`, or
     `O que esta atribuido ao Falante C na verdade foi a Ana`;
   - submit posts to `POST /api/meetings/[id]/corrections` with the audio;
   - the server transcribes the correction, feeds it together with the
     current transcript and current speaker mapping to the reanalysis
     model, and writes new speaker assignments;
   - the screen returns to processing with `Reanalisando com sua correcao`
     and reopens with refreshed cards. The original transcript text is not
     re-transcribed: only the speaker attribution is recomputed.

   The correction loop is bounded (at most three reanalyses per meeting) to
   avoid runaway costs. Each correction is persisted for debugging.

#### Stage 3: finalize

Primary button at the bottom: `Salvar reuniao`.

When tapped:

1. Persist confirmed speaker mappings.
2. Upsert any newly created `people` rows.
3. Render the standalone meeting note with attributed transcript and the
   `Reuniao` section described in Section 7.
4. Append the meeting block to today's daily briefing note.
5. Write `@Person` mentions for every confirmed participant.
6. Append a compact meeting reference to each participant's profile note.
7. Set status to `ready` and navigate to the standalone meeting note.

The user cannot finalize while any speaker card is in an inconsistent state
(e.g. a half-typed person name without a save). The Save button is disabled
with an inline hint until every card is resolved.

### 4.5 Audio capture surfaces — all sources

Capturing every voice in the room is essential when both sides of the call are
on the same device or when a remote call plays through speakers.

The intent is the same on every platform — `microfone + audio do sistema +
mistura num único stream` — but the technical contract changes by platform.
Flow Me must pick the best legal route per platform and degrade gracefully.

| Platform | Microphone | System audio (loopback) | First-release strategy |
| --- | --- | --- | --- |
| Desktop browser (Chromium) | `getUserMedia({ audio: true })` | `getDisplayMedia({ audio: true })` with the user picking `Esta aba` or `Tela inteira` and toggling `Compartilhar audio` | Offer "Capturar audio do sistema" toggle. When enabled, request display media, drop the video track, and mix the audio track with the microphone via the WebAudio API. |
| Desktop browser (Safari/Firefox) | `getUserMedia` | Limited or unsupported `getDisplayMedia({audio:true})` | Fall back to microphone only and surface a hint: "Seu navegador nao expoe o audio do sistema. Use Chrome ou o app desktop para capturar a outra ponta." |
| Mobile browser | `getUserMedia` | Not exposed by any mobile browser | Microphone only. The recorder is presented as "ideal para reunioes presenciais". |
| Installed PWA (mobile) | Same as mobile browser | Same as mobile browser | Same as mobile browser. |
| Native mobile app (Phase 2) | OS audio session | Android `MediaProjection` (with the OS dialog), iOS `ReplayKit` for screen + system audio (with the OS dialog) | Capture mic plus system audio and merge before chunking. Use OS recording indicator. |
| Desktop app (Phase 3) | Native audio input | Native loopback (CoreAudio on macOS, WASAPI loopback on Windows, PulseAudio monitor on Linux) | Capture mic plus system audio in two raw tracks, mix server-side or in the desktop app, send chunks to the same API. |

#### Mixing two streams in the browser

Use a single `AudioContext`:

1. Create `MediaStreamAudioSourceNode` for the microphone stream.
2. Create `MediaStreamAudioSourceNode` for the display media stream (audio
   track only — discard `videoTrack.stop()` immediately).
3. Pipe both into a `GainNode` per source so the user can independently
   mute either side from the recorder controls.
4. Pipe the gains into a `MediaStreamAudioDestinationNode`.
5. Feed `destination.stream` into the `MediaRecorder`.

This keeps timestamps coherent and avoids encoding two parallel files.

#### When system-audio capture is not granted

If the user denies the screen-share dialog, the recorder must continue with
microphone only and show a non-blocking banner inside the floating popup:
`Gravando so o microfone. Toque para tentar capturar o audio do sistema.`
Tapping prompts the screen-share dialog again without restarting the meeting.

## 5. Speaker Identity Strategy

Use a layered strategy. Each layer may increase confidence, but only explicit
confirmation or reliable provider evidence writes a person's identity.

### 5.1 Phase 1: reliable and shippable — Gemini-first

Use **Google Gemini** as the default transcription + diarization provider.
The application is standardizing on Gemini (see Tasks 7 and 8 in the
implementation plan) and Gemini 2.5 Pro can transcribe + diarize in a single
`generateContent` call by asking for a structured JSON response. This is
roughly five times cheaper per hour of audio than the OpenAI alternative.

Provider hierarchy:

| Provider | Model | When |
| --- | --- | --- |
| Primary | `gemini-2.5-pro` (or `gemini-2.5-flash` for short meetings) | Default for every meeting. |
| Fallback | OpenAI `gpt-4o-transcribe-diarize` | Triggered when the Gemini response fails JSON validation, contains zero segments, or the meeting exceeds a configurable duration where Gemini quality regresses. |

Both adapters live behind a shared `TranscriptionDiarizationAdapter`
interface so swapping providers requires no changes downstream:

```text
interface TranscriptionDiarizationAdapter {
  transcribeWithDiarization(input: {
    audioR2Key: string;
    language: 'pt' | 'en' | 'auto';
    expectedSpeakerCount?: number;
    participantsHint?: string[];
  }): Promise<{
    segments: Array<{ providerLabel: string; startSeconds: number; endSeconds: number; text: string }>;
    detectedLanguage: string;
    providerName: 'gemini' | 'openai';
    providerReceiptId: string | null;
  }>;
}
```

Inputs (for both adapters):

- audio joined into a single normalized artifact (Section 8.2);
- typed participants;
- nearby calendar event attendees;
- existing Flow Me people;
- self identity from the authenticated user.

Outputs:

- transcript segments with generic labels;
- candidate person suggestions generated from meeting context;
- confidence and evidence type;
- a mandatory review step for uncertain mappings.

The first version must prefer `Falante A` over an incorrect name regardless of
provider. The structured-output prompt for Gemini explicitly forbids the model
from inventing a real name: speaker labels must remain `A`, `B`, `C`, etc., and
identity mapping happens only on the finalization screen.

Cost / quality target for Phase 1:

- target Gemini 2.5 Pro for every meeting longer than 5 minutes;
- target Gemini 2.5 Flash for shorter snippets and for the correction-audio
  transcription step (Section 8.3);
- if Gemini returns an invalid JSON or fewer segments than expected for the
  audio length, log it and retry once on OpenAI;
- emit usage metrics so we can revisit the routing rule when we have
  production data.

All other AI calls in the pipeline (summary, objective, task extraction,
correction reassignment) also default to Gemini.

### 5.2 Phase 2: voice profiles with explicit opt-in

Add optional voice profiles after the first reliable release:

- Store a short confirmed reference clip per person only after explicit user
  consent.
- Encrypt storage metadata and keep clips private in R2.
- Add a preference to disable voice profile creation and delete existing
  profiles.
- Use known-speaker references when the transcription provider supports them.
- Require review when confidence is below the product threshold.

Voice biometrics is sensitive personal data. It must not be enabled silently.

### 5.3 Phase 3: richer desktop capture

Phase 1 already captures microphone + system audio on Chromium desktop by
mixing `getUserMedia` with `getDisplayMedia` (Section 4.5). Phase 3 closes the
remaining gaps:

- a native desktop app that captures microphone and system loopback without
  requiring the screen-share dialog every time;
- per-window or per-app audio routing (e.g. only the Zoom window);
- always-on background recording with the OS recording indicator;
- active calendar event context;
- support for browsers that do not expose `getDisplayMedia({ audio: true })`
  (Safari, Firefox).

The web app remains the right tool for in-person conversations and for ad-hoc
remote calls when the user can grant tab-audio sharing. The native desktop app
exists to make remote-call capture frictionless rather than possible.

## 6. Data Model

Create migration `043_meeting_recordings.sql`. Migrations `040`, `041`, and
`042` remain reserved by the active mentorship plan.

### 6.1 `meeting_recordings`

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `user_id` | Owner |
| `note_id` | Standalone meeting note. **Created at Stage 1 (durability boundary 1)** so the note + audio exist even if Stage 2+ fails |
| `daily_briefing_note_id` | Daily briefing note after finalization (Stage 6) |
| `calendar_event_id` | Optional provider event reference; internal only |
| `meeting_date` | User-local date |
| `title` | Meeting name |
| `subject` | Generated or user-entered subject |
| `objective` | Generated or user-entered objective |
| `status` | `recording`, `uploading`, `audio_persisted`, `processing`, `finalization_review`, `reanalyzing`, `ready`, `failed`, `awaiting_retry` |
| `failed_stage` | Nullable. When `status = failed` or `awaiting_retry`, names the stage that broke (`assemble`, `transcribe`, `diarize`, `summarize`) so the retry knows where to resume |
| `captured_sources` | JSONB describing which sources were live (`microphone`, `system_audio`) for transparency in the UI |
| `consent_confirmed_at` | Required before capture |
| `duration_seconds` | Total recording duration |
| `language` | Detected or selected language |
| `provider` | `gemini` by default; `openai` only when fallback fired |
| `provider_transcript_id` | Nullable provider receipt |
| `fallback_reason` | Nullable string describing why the OpenAI fallback was used (e.g. `gemini_invalid_json`, `gemini_zero_segments`, `gemini_timeout`) |
| `final_audio_r2_key` | Set the moment Stage 1 succeeds. From this point on the audio is durably attached to `note_id` regardless of downstream failures |
| `final_audio_mime_type` | Stored alongside the key so playback can pick the correct `audio/` MIME |
| `summary` | Structured JSONB |
| `failure_reason` | Nullable internal debugging context |
| `attempts` | JSONB array of past pipeline runs: `[{ stage, started_at, ended_at, ok, error_code, provider }]`. Trimmed to the last 20 entries for size |
| `created_at`, `updated_at`, `completed_at` | Lifecycle |

### 6.2 `meeting_recording_chunks`

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `meeting_recording_id` | Parent meeting |
| `sequence_number` | Stable chunk order |
| `r2_key` | Private audio object |
| `mime_type` | Captured content type |
| `duration_seconds` | Chunk duration |
| `upload_status` | `pending`, `uploaded`, `failed` |
| `created_at` | Audit timestamp |

Add unique constraint on `(meeting_recording_id, sequence_number)`.

### 6.3 `meeting_speakers`

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `meeting_recording_id` | Parent meeting |
| `provider_label` | `A`, `B`, `C`; internal only |
| `display_label` | Fallback such as `Falante A` |
| `person_id` | Nullable confirmed person |
| `suggested_person_id` | Nullable suggestion |
| `identity_status` | `unknown`, `suggested`, `confirmed`, `generic` |
| `confidence` | Nullable numeric score |
| `evidence` | JSONB with non-sensitive explanation |
| `created_at`, `updated_at` | Audit timestamps |

### 6.4 `meeting_transcript_segments`

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `meeting_recording_id` | Parent meeting |
| `meeting_speaker_id` | Speaker reference |
| `sequence_number` | Stable order |
| `start_seconds`, `end_seconds` | Playback timestamps |
| `text` | Verbatim transcript segment |
| `created_at` | Audit timestamp |

### 6.5 `meeting_tasks`

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `meeting_recording_id` | Parent meeting |
| `description` | Extracted task |
| `assignee_person_id` | Nullable confirmed person |
| `due_at` | Nullable extracted deadline |
| `status` | `suggested`, `accepted`, `dismissed` |
| `created_at`, `updated_at` | Lifecycle |

Tasks remain suggestions until the user explicitly adds them to an action plan
or calendar. A meeting must not silently create commitments.

### 6.6 `meeting_speaker_corrections`

One row per audio correction submitted from the finalization screen.

| Column | Notes |
| --- | --- |
| `id` | UUID primary key |
| `meeting_recording_id` | Parent meeting |
| `sequence_number` | Stable order; capped at three per meeting |
| `correction_audio_r2_key` | Private R2 object with the user's correction audio |
| `correction_text` | Transcribed correction text (verbatim user instruction) |
| `prior_speaker_map` | JSONB snapshot of speaker-to-person mapping before this correction |
| `applied_speaker_map` | JSONB snapshot of the new speaker mapping after reanalysis |
| `applied_segment_changes` | JSONB summary of which `meeting_transcript_segments` had their `meeting_speaker_id` reassigned (counts per provider label) |
| `status` | `pending`, `applied`, `rejected`, `failed` |
| `failure_reason` | Nullable internal debugging context |
| `created_at`, `applied_at` | Lifecycle |

The original `meeting_transcript_segments.text` is never rewritten by a
correction — only the `meeting_speaker_id` (and downstream the speaker label)
may change. This preserves the audit trail: a user can review every correction
that has been applied to their meeting.

## 7. Daily Briefing Integration

Reuse the canonical `notes.note_type = 'daily_briefing'` record for the day.
Do not create a parallel briefing model.

Append a structured TipTap section after speaker review:

```text
Reuniao: Planejamento comercial

Assunto
Meta Ads e lancamento mobile

Objetivo
Definir o funil inicial e os proximos experimentos.

Transcricao
@Victor: ...
@Joao: ...
Falante C: ...

Tarefas
- @Victor: preparar landing page ate sexta-feira.
- @Joao: revisar criativos.
```

Persist the transcript in the meeting tables as the source of truth. The daily
briefing contains a readable snapshot and a link to the complete meeting note.

For every confirmed participant:

1. Upsert the `people` row.
2. Insert `note_mentions` for the standalone meeting note and daily briefing
   note.
3. Ensure the person's profile note exists.
4. Append a compact meeting reference to the profile note:
   meeting name, date, subject, objective, tasks assigned to that person, and a
   link to the meeting note.

Do not duplicate the full transcript inside every person's profile note.

## 8. Processing Pipeline

The pipeline is organised as a sequence of **independent stages** with two
**durability boundaries**. Once a boundary is crossed, the work that came
before cannot be lost by an AI failure — only retried.

```
┌──────────────────────────────────────────────────────────────────┐
│ Stage 0 — Capture        client MediaRecorder + chunk uploader   │
│   ⇩                                                              │
│ Stage 1 — Assemble       ffmpeg join + normalize + persist       │
│   ╪══════════ DURABILITY BOUNDARY 1 ═══════════                  │
│   ⇩  final_audio_r2_key is set, the audio belongs to the note    │
│ Stage 2 — Transcribe     provider call (Gemini → OpenAI fb)      │
│   ⇩                                                              │
│ Stage 3 — Diarize        same provider call when combined        │
│   ⇩                                                              │
│ Stage 4 — Summarize      subject, objective, tasks               │
│   ⇩                                                              │
│ Stage 5 — Speaker review user-driven on finalization screen      │
│   ⇩                                                              │
│ Stage 6 — Save           writes meeting note + briefing block    │
│   ╪══════════ DURABILITY BOUNDARY 2 ═══════════                  │
│   ⇩  meeting note + daily briefing references are committed     │
└──────────────────────────────────────────────────────────────────┘
```

### Boundary 1 — audio durability

The moment Stage 1 finishes successfully:

- the assembled audio is saved under
  `meetings/<id>/audio.<ext>` in R2 (private, signed-URL access);
- `meeting_recordings.final_audio_r2_key` is set;
- a standalone meeting note is created (or the prepared one is unlocked) with
  the audio attached for playback. The note exists even when transcription has
  never succeeded — the user can always replay what they recorded.

Any failure from Stage 2 onward leaves the note + audio intact. The meeting
flips to `failed` (or `awaiting_retry` for transient errors) and the user can
re-run the pipeline through the same finalization flow described in §4.4.

### Boundary 2 — note durability

After Stage 6, the meeting note, daily briefing block, mentions and
person-note references are committed. The audio retention policy of §11 then
applies.

### Failure isolation rules

- Stage failures **never** corrupt the data of earlier stages.
- The processor is idempotent per stage: a retry of Stage 2 must drop the
  prior segments, speakers and summary before inserting fresh ones.
- A failure in Stage 4 (summarize) does not invalidate the transcript from
  Stage 3 — the user can still finalize with manually filled subject /
  objective.
- The user can trigger a retry from the finalization screen or from the
  meeting card in `Reunioes` at any time after Boundary 1.

### 8.1 Client capture

1. Create a meeting row after consent confirmation.
2. Start `MediaRecorder`.
3. Close and upload a chunk every five minutes.
4. Persist pending chunk metadata locally until the server acknowledges upload.
5. On finalize, upload the last chunk and set meeting status to `processing`.

Use a supported MIME type detected at runtime. Do not hardcode
`audio/webm` because Safari and native WebViews may require another format.

### 8.2 Server processing — stages

Each stage is a separate function and a separate retry surface. The processor
records its progress in `meeting_recordings.attempts` and sets
`status` / `failed_stage` accordingly. **No AI stage runs before durability
boundary 1.**

#### Stage 1 — Assemble (durability boundary 1)

1. Download chunks from `meetings/<id>/chunks/` in `sequence_number` order.
2. Join and normalize them into one audio artifact with `ffmpeg`. Do not
   transcribe chunks independently: provider speaker labels are scoped to a
   single request, so chunk-by-chunk runs would assign the same voice
   different labels.
3. Upload the assembled artifact to `meetings/<id>/audio.<ext>` in R2.
4. In a single transaction:
   - set `final_audio_r2_key` and `final_audio_mime_type`;
   - ensure the standalone meeting note exists with the audio attached
     (playable from the note even before transcription);
   - set `status` to `audio_persisted`.
5. Optionally delete the `chunks/` prefix once the assembled audio is
   verified. Keep chunks for at least one hour to support rollback if the
   join is detected as corrupt later.

If Stage 1 fails (rare — ffmpeg / network / R2), status becomes `failed`
with `failed_stage = 'assemble'`. The user sees a card with `Audio nao foi
montado` and a `Tentar de novo` button. The chunks remain so a retry can
re-attempt.

#### Stage 2 — Transcribe + diarize

1. Run the assembled audio through `TranscriptionDiarizationAdapter`.
   Default provider Gemini (`gemini-2.5-pro` for >5 min, `gemini-2.5-flash`
   otherwise). The prompt forces a strict JSON shape and forbids real names.
2. If the response fails schema validation, returns zero segments, or times
   out, retry once on the OpenAI adapter (`gpt-4o-transcribe-diarize`) and
   record the reason in `fallback_reason`.
3. Merge adjacent segments from the same speaker.
4. Store immutable transcript segments and the corresponding
   `meeting_speakers` rows (provider labels `A`, `B`, ... and
   `display_label` = `Falante A`, `Falante B`, ...).

If Stage 2 fails on both providers, status becomes `failed` with
`failed_stage = 'transcribe'`. **The audio is intact.** The meeting card
shows `Falha na transcricao` with an inline audio player and a `Tentar
diarization de novo` button. Retry resumes from Stage 2.

#### Stage 3 — Summarize

1. From the stored transcript, generate subject, objective, and task
   suggestions with structured model output (Gemini Flash by default).
2. Suggest speaker mappings using participants, calendar context, self
   identity, and transcript context.

If Stage 3 fails, status becomes `failed` with `failed_stage = 'summarize'`.
The transcript and speakers are already saved, so the user can still open
the finalization screen and finalize with manually typed subject / objective.
A retry re-runs only the summary call.

#### Stage 4 — Hand off to user

When Stages 1–3 complete successfully, set `status = finalization_review`.
The finalization screen (§4.4) is the single entry point for user review,
even when the model produced high-confidence suggestions.

#### Stage 5 — User review

Speaker assignments, optional audio corrections (§8.3), edits to subject /
objective / tasks. Driven by the user.

#### Stage 6 — Save (durability boundary 2)

Render meeting HTML, append it to daily briefing, update mentions and
person notes, set `status = ready`. This is the only stage that mutates the
daily briefing note.

If Stage 6 fails (e.g. transient Supabase error), status becomes
`awaiting_retry` with `failed_stage = 'save'`. The finalization screen
shows `Algo deu errado ao salvar. Tentar de novo`. The user's pending
speaker choices are already persisted to `meeting_speakers`, so a retry
just replays the write half.

### 8.3 Audio correction reanalysis

When the user posts a correction audio from the finalization screen:

1. Persist the uploaded audio under
   `meetings/<meeting_id>/corrections/<sequence>.<ext>` in R2.
2. Transcribe the correction audio with the same provider used for the
   meeting (microphone-only short clip, no diarization needed).
3. Set meeting status to `reanalyzing` and create a
   `meeting_speaker_corrections` row in `pending`.
4. Build a reassignment prompt with:
   - the full current transcript with current speaker labels;
   - the current speaker-to-person mapping (including generic labels);
   - the verbatim correction text from step 2.
5. Call a structured model output (no audio retranscription) returning a
   new speaker mapping — either merging two provider labels into one, or
   reassigning specific segments to a different speaker. The model returns
   JSON: `{ "merges": [{ "from": ["A","B"], "into": "A" }], "reassignments": [{ "segment_ids": [...], "to_speaker_label": "B" }] }`.
6. Validate the response: every referenced label must exist; no orphan
   segments; merges must collapse cleanly. Reject and store
   `failure_reason` if invalid.
7. Apply the mapping inside a transaction: update
   `meeting_transcript_segments.meeting_speaker_id`, deactivate merged
   `meeting_speakers` rows, and write `applied_speaker_map` +
   `applied_segment_changes` on the correction row.
8. Set status back to `finalization_review` and notify the client.

This step never re-transcribes the meeting and never modifies segment text.
It only changes how segments are grouped under speakers.

The processor must be retryable and idempotent. A retry must not duplicate
transcript segments, daily briefing sections, mentions, or person-note
references.

Install `ffmpeg` in the production application runner image. The worker should
write temporary files under the container's ephemeral storage, delete them
after processing, and never log audio contents.

### 8.4 Background execution

Do not process long meetings inside the upload request.

Initial production implementation:

- cron route claims queued meetings;
- server processor handles one meeting at a time per user;
- status polling updates the UI.

Later optimization:

- move processing to a dedicated queue worker;
- fan out chunk transcription with bounded concurrency;
- add push notification when speaker review or final result is ready.

## 9. API Surface

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/meetings` | `GET` | List recent meetings and statuses |
| `/api/meetings` | `POST` | Create meeting after consent confirmation |
| `/api/meetings/[id]` | `GET` | Read detail, speakers, transcript, tasks |
| `/api/meetings/[id]` | `PATCH` | Update title, subject, objective |
| `/api/meetings/[id]/chunks` | `POST` | Upload one audio chunk to private R2 |
| `/api/meetings/[id]/finalize` | `POST` | Queue transcription |
| `/api/meetings/[id]/speakers` | `PATCH` | Confirm speaker-to-person mappings |
| `/api/meetings/[id]/corrections` | `POST` | Upload a correction audio and trigger speaker-attribution reanalysis (no retranscription) |
| `/api/meetings/[id]/corrections` | `GET` | List prior corrections and their applied changes |
| `/api/meetings/[id]/retry` | `POST` | Re-queue the pipeline from `failed_stage` for a meeting whose audio is already persisted. Body specifies the stage if the user wants to override (e.g. force a re-summary). Never re-runs Stage 1: the assembled audio is reused. |
| `/api/meetings/[id]/audio` | `GET` | Return a short-lived signed URL for `final_audio_r2_key` so the finalization screen and the standalone meeting note can play the recording inline |
| `/api/meetings/[id]/tasks` | `PATCH` | Accept or dismiss extracted tasks |
| `/api/meetings/[id]/finalize-save` | `POST` | Commit speaker mappings, write standalone meeting note, append daily briefing block, upsert @mentions and person-note references |
| `/api/cron/process-meetings` | `POST` | Claim and process queued meetings (initial pipeline runs, queued reanalyses, and queued retries) |

All internal IDs remain internal. UI routes may use opaque meeting tokens when
opened from notifications.

## 10. Mobile and Desktop Delivery

### 10.1 First release

Ship web and installed PWA recording for in-person meetings:

- mobile browser or mobile WebView microphone;
- desktop browser microphone;
- uploaded audio files;
- responsive full-screen recorder on mobile;
- foreground capture only.

### 10.2 Native mobile apps

When Android and iOS wrappers are added:

- use native background audio recording;
- persist chunks while the screen is locked;
- resume interrupted uploads;
- show OS recording indicator;
- preserve the same server APIs and data model.

### 10.3 Desktop remote calls

Remote calls with headphones require system-audio capture. Add this only in a
desktop app or supported browser capture flow with explicit permission. Keep it
separate from the first in-person recording release.

## 11. Privacy and Consent

Recording laws depend on jurisdiction. Product behavior must be conservative:

- require a consent checkbox before recording starts;
- show a visible recording state throughout capture;
- provide delete controls for transcript and audio;
- define an audio retention policy;
- keep audio private in R2;
- never store voice profiles unless the user explicitly opts in;
- log consent timestamp and deletion events;
- do not send transcript contents to analytics logs.

Default retention recommendation:

- keep transcript and meeting note until user deletion;
- the assembled audio (`final_audio_r2_key`) is the canonical recording and
  belongs to the note; delete it automatically 30 days after Stage 6 unless
  the user chooses to keep it longer in `Configurações → Privacidade`;
- meetings stuck in a failed pipeline state keep their assembled audio for
  **at least 30 days from the failure** so the user always has time to retry
  diarization later;
- chunk objects under `meetings/<id>/chunks/` are temporary; delete one hour
  after a successful assembly. If assembly failed, keep chunks for 7 days so
  an engineer can investigate or the user can retry assembly;
- correction audios follow the same 30-day window as the meeting audio;
- allow immediate manual deletion after processing for any of the above.

## 12. Implementation Sequence

### Phase 1: durable in-person meeting notes

1. Add migration `043_meeting_recordings.sql` (includes
   `meeting_speaker_corrections` table and `captured_sources` column).
2. Add R2 meeting-audio key builder and upload route. The chunk prefix
   `meetings/<id>/chunks/` is the temporary processing area; corrections live
   under `meetings/<id>/corrections/`.
3. Add meeting CRUD, chunk upload, finalize, corrections, retry, audio
   signed-URL, and processing cron routes.
4. Build the pipeline as **isolated stages**: separate functions for
   assemble, transcribe-diarize, summarize, and save. Each writes
   `attempts`, `status` and `failed_stage` and can be re-entered
   independently. Stage 1 (assemble) is the durability boundary — it must
   set `final_audio_r2_key` and create the meeting note before any AI call.
5. Add `TranscriptionDiarizationAdapter` interface with a Gemini-primary
   adapter (`gemini-2.5-pro` + Flash for shorter clips) and an OpenAI
   fallback adapter (`gpt-4o-transcribe-diarize`). Route through the primary
   first; fall back on schema or timeout failures.
5. Add structured summary and task extraction.
6. Add `RecordingProvider` context + floating recording popup mounted at the
   root layout. Persists across navigation on desktop and mobile, with the
   `Parar` button as the canonical stop control.
7. Add browser audio capture pipeline: microphone always on, optional system
   audio via `getDisplayMedia` mixed into one stream with WebAudio. Toggleable
   from the recorder controls and from the floating popup.
8. Add finalization screen with speaker cards (search + create person inline,
   `Manter como Falante A` option) and the audio-correction lane.
9. Add reanalysis endpoint backed by a structured-output call that merges /
   reassigns speakers without retranscribing.
10. Add finalize-save endpoint: standalone meeting note, daily briefing
    append, @mentions, profile-note references.
11. Add responsive recorder entry point in Notes, Daily Briefing, mobile
    bottom action menu, and `/reuniao` command palette entry.
12. Add upload retry, processing retry, correction-loop cap (max 3), tests,
    and a feature flag.

### Phase 2: faster and more helpful

1. Push notification when processing finishes.
2. Calendar event suggestion and participant autocomplete.
3. Upload existing audio file.
4. Task acceptance flow into calendar or action plans.
5. Balys tools to list, inspect, and discuss meetings without exposing IDs.

### Phase 3: identity learning and richer capture

1. Opt-in voice profiles with deletion controls.
2. Known-speaker reference transcription when supported.
3. Native mobile background recording.
4. Desktop microphone plus system-audio capture.
5. Optional meeting-platform integrations.

## 13. Test Plan

### Pure functions

- chunk timestamp normalization;
- adjacent segment merge;
- speaker fallback labels in PT-BR and English;
- daily briefing HTML rendering;
- idempotency keys;
- task extraction schema validation.

### API routes

- meeting creation rejects missing consent and missing title;
- chunk upload rejects unknown meeting and invalid MIME type;
- finalize rejects meetings without chunks;
- speaker review accepts existing person, creates a person, or preserves generic
  label;
- speaker review cannot write a person outside the authenticated user's account;
- processing retry does not duplicate sections or mentions.

### UI

- recorder entry exists in Notes and Daily Briefing;
- consent is required;
- runtime MIME selection supports Safari-compatible fallbacks;
- periodic chunk upload survives a transient error;
- small screens use the full-screen flow;
- speaker review allows generic labels instead of forcing a name.

## 14. Definition of Done for the First Release

- A user can start an in-person recording from mobile or desktop browser.
- A floating recording popup (Google-Meet style) follows the user across the
  app on both desktop and mobile, with a single-tap `Parar` that routes to the
  finalization screen.
- On Chromium desktop, the recorder can capture microphone plus system audio
  in a single mixed stream when the user opts in via the screen-share dialog;
  on other browsers and on mobile, microphone-only capture works and the UI
  states that limitation clearly.
- A one-hour meeting never accumulates more than one chunk window in browser
  memory; chunks are uploaded to R2 every two minutes as a temporary
  processing area.
- Audio chunks are stored privately and processed asynchronously by a cron
  worker, not inside the upload request.
- Default transcription + diarization runs through Gemini (2.5 Pro or 2.5
  Flash by meeting length); OpenAI is only used as a fallback and the
  fallback reason is recorded for observability.
- The pipeline is composed of **isolated stages** (assemble, transcribe +
  diarize, summarize, save). Each stage records `attempts` and `failed_stage`
  and can be retried independently.
- **The assembled audio is durable** the moment Stage 1 finishes: it is
  saved under `final_audio_r2_key` and attached to the standalone meeting
  note. Any failure in Stage 2 or later **never loses the recording** — the
  user always sees the audio inline in the meeting note and can re-run
  diarization through `/api/meetings/[id]/retry`, which lands on the same
  finalization screen + audio-correction loop.
- The retry endpoint never re-runs Stage 1: it reuses the persisted audio.
- Transcript segments preserve timestamps and distinct speakers.
- Unknown identities remain `Falante A`, `Falante B`, and so on until reviewed.
- The finalization screen exposes per-speaker resumo de falas, search +
  inline `Criar pessoa`, and an audio-correction lane that triggers a
  reanalysis without retranscribing.
- The correction loop is capped at three reanalyses per meeting and every
  correction is persisted in `meeting_speaker_corrections`.
- Confirmed identities create or reuse people, write `@mentions`, and append a
  compact profile-note reference.
- The standalone meeting note and today's daily briefing contain meeting name,
  subject, objective, attributed transcript, and tasks.
- Raw audio can be deleted; correction audios follow the same retention
  policy as the meeting audio.
- Feature flag disables new recording without affecting existing notes.
- `npm test` and `npm run build` pass.
