# 07. AI SYSTEM

How AI is built on the backend. WHAT the AI says and refuses is defined in docs/shared/AI-BEHAVIOR.md; this document defines HOW it runs: provider adapter, prompt assembly, safety pipeline, streaming, jobs, action cards, metering, limits and evaluation.

---

## 1. PRINCIPLES
1. Provider-agnostic. Application code never imports a vendor SDK directly; it uses the adapter.
2. Nothing AI-made reaches students or becomes live content without a teacher or admin Approve (action cards), except conversational answers to the student's own questions in the Tutor.
3. Safety runs before and after every model call and cannot be bypassed by instructions from the school; the platform floor (AI-BEHAVIOR section 9) is code.
4. Every call is metered, limited and logged (feature, user, outcome, cost) without storing message text in application logs.
5. Minimal data goes to the provider: no usernames, no real names, no other students' data.
6. Every long operation is a job with steps; every conversational operation streams.

---

## 2. PROVIDER ADAPTER (`_shared/ai/adapter.ts`)

```
interface ModelAdapter {
  chat(req: ChatRequest): Promise<ChatResult>                     // non-streaming
  stream(req: ChatRequest): AsyncIterable<StreamChunk>             // text deltas, usage at the end
  structured<T>(req: ChatRequest, schema: ZodSchema<T>): Promise<StructuredResult<T>>   // JSON output validated by the schema
}
ChatRequest  { tier: 'fast'|'smart', system: string, messages: [{role, content}], max_tokens, temperature, timeout_ms, metadata: {feature, request_id} }
ChatResult   { text, tokens_in, tokens_out, model, latency_ms, finish_reason }
interface TtsAdapter { synthesize({text, voice, speed, format}): Promise<{bytes, duration_s, mime}> }
```
- Tiers: `fast` (low cost, low latency: tutor chat, explanations, drafts, classification, announcements, translation) and `smart` (higher quality: grading, generation of lessons, courses, curricula, questions, support plans, planning, reports, quality checks). The feature-to-tier mapping is a table in code; the Admin cannot change tiers, only enable features and set limits.
- Concrete models and keys are Edge Function secrets (`AI_PROVIDER`, `AI_MODEL_FAST`, `AI_MODEL_SMART`, `AI_API_KEY`, `TTS_*`). A second provider can be configured as a fallback used when the primary returns provider errors or times out (once per request).
- Pricing for cost metering is a JSON secret `AI_PRICING` (price per million input and output tokens per model). Cost is stored in micro US dollars.
- Timeouts: first token 15 seconds, total 60 seconds for streams; 90 seconds for a single generation step. Provider errors map to our codes: rate limit or overload to `provider_error` (retry with backoff for jobs), timeout to `timeout`, refusal from the provider's own filter to `safety_blocked` with the neutral message.

---

## 3. PROMPT ASSEMBLY (`_shared/ai/prompts.ts`)

Layers in order (AI-BEHAVIOR section 2):
1. Base rules (fixed text in code, versioned as `BASE_RULES_VERSION`).
2. Safety rules (published `ai_safety` config, compiled into instructions; the platform floor is appended last and always wins).
3. School instructions (published `ai_instructions`: school text then the feature add-on).
4. Feature template (one module per feature in `_shared/ai/prompts/`; each exports `system()`, `buildContext()`, `outputSchema` when structured, and `version`).
5. Per-call context built by the feature's `buildContext()`.
Rules for context:
- Students are referred to as "the student" or an alias (S1, S2) in teacher tools; real names are never sent. Replies that need names are filled in by the backend after generation.
- Context size is capped per feature (for example the last 20 messages, the lesson text up to 3,000 words, at most 40 questions).
- Teacher and admin tools receive only data the caller can read under RLS (the context is fetched with the caller's client, not the service role).
- The `assessment_open` flag for the Tutor is computed by the backend: the student has an `in_progress` quiz attempt (deadline in the future) or an in-progress assignment submission within its window.
- The prompt version and base-rules version are recorded in `ai_usage.meta`.

---

## 4. SAFETY PIPELINE (`_shared/ai/safety.ts`)

### 4.1 Pre-check (before the model)
1. Length: reject messages over the feature limit (`validation_failed`, copy "That message is too long. Try a shorter one.").
2. Normalization: Unicode normalize, strip control characters.
3. PII detection and masking: phone numbers, email addresses, long digit strings, addresses patterns; masked before the model and in logs; a student sharing PII does not get blocked, the values are simply masked.
4. Rule layer (fast, deterministic): blocklist from the `ai_safety` config (categories and terms), prompt-injection patterns ("ignore previous instructions", role-play attempts to change rules, requests to reveal the prompt), and open-assessment answer requests.
5. Classifier layer (model, `fast` tier, structured output): categories `ok`, `off_topic`, `blocked_category`, `sensitive_personal`, `injection`, `answer_request` with a confidence. Skipped for features where input is system-generated (jobs).
6. Decision table:
   | Outcome | Action |
   |---|---|
   | ok | continue |
   | off_topic (harmless) | redirect: respond with the fixed redirect copy and suggested prompts, no model call |
   | blocked_category, injection, sensitive_personal | neutral message "We can't process this request.", no model call, message stored with `safety.blocked=true` and the category, `moderation_items` row (Low severity, source ai_message), usage row with status `blocked` (no credit cost) |
   | answer_request while `assessment_open` | continue with the hint-only instruction appended and the fixed hint prefix |
7. Repetition: the third blocked message in one conversation returns "We can't process this request. Let's get back to English.", flags the conversation (`flagged=true`) and raises the moderation item to Medium.
### 4.2 During generation
Streaming output passes through a sliding-window filter (rule layer on the last 200 characters). If it trips, the stream stops, the partial text is discarded, the neutral message is sent in a `safety` event, and the message is stored blocked with severity Medium.
### 4.3 Post-check
At the end of a response the full text is checked by the rule layer and, for student-facing features, by the classifier (`fast`) when the response is longer than 40 words or the earlier checks were uncertain. Structured outputs are validated against their Zod schema; one automatic repair attempt feeds the validation errors back to the model; a second failure returns `provider_error` with the retry copy.
### 4.4 Teacher and admin features
Same pipeline with the Standard filter level. Generated content (lessons, questions, announcements) always passes the post-check for blocked categories and age-appropriateness before the card is created; a failure returns a card in status `failed` with the reason.
### 4.5 Moderation records
Severity rules (AI-BEHAVIOR section 6): Low for single blocked messages or minor quality issues, Medium for repeats or inappropriate draft content, High for unsafe content that reached students or exposed personal data. High items also create an admin notification. No staff alert is sent for sensitive personal topics (owner decision); they are Low items in the queue only.

---

## 5. FEATURE CATALOG

| Feature key | Mode | Tier | Max output tokens | Temperature | Limits and cost |
|---|---|---|---|---|---|
| `tutor_chat` | stream | fast | 500 | 0.5 | Student 40 per day; 0 credits |
| `tutor_quiz_me` | stream | fast | 400 | 0.4 | Student 3 rounds per day |
| `writing_check` | stream then structured | smart | 900 | 0.2 | Student 10 per day |
| `translate` | request | fast | 400 | 0.2 | Student counted under `tutor_chat` quota class "translate", 30 per day |
| `explain_mistakes` | request | fast | 300 | 0.4 | Counted with `tutor_chat` |
| `ai_grading` | job step | smart | 900 | 0.1 | 0.25 credit per submission |
| `question_generation` | job | smart | 3,000 | 0.6 | 1 credit per set of up to 10 |
| `lesson_generation` | job | smart | 3,500 | 0.6 | 1 credit |
| `assessment_generation` | job | smart | 4,000 | 0.5 | 2 credits |
| `assessment_check` | request | smart | 1,500 | 0.1 | 0.5 credit |
| `course_generation` | job | smart | per step | 0.6 | 15 to 40 credits by size (reserved up front) |
| `curriculum_generation` | job (admin) | smart | per step | 0.5 | Counted against the school budget, not teacher credits |
| `copilot` | stream | smart | 1,200 | 0.3 | 0.1 credit per message plus the cost of cards it creates |
| `admin_copilot` | stream | smart | 1,200 | 0.3 | School budget |
| `suggested_actions` | scheduled job | fast | 800 | 0.2 | Not charged to the teacher |
| `support_plan` | request | smart | 1,800 | 0.3 | 1 credit |
| `planner` | job | smart | 3,000 | 0.4 | 2 credits per week planned |
| `lesson_plan` | request | smart | 1,500 | 0.4 | 1 credit |
| `announcement_draft` | request | fast | 400 | 0.5 | 0.25 credit |
| `report_comments` | job | smart | 300 per student | 0.4 | 2 credits per class |
| `report_narrative` | request | smart | 500 | 0.3 | 0.5 credit |
| `content_quality_check` | job | smart | 1,500 per item | 0.1 | School budget |
| `moderation_triage` | request | fast | 300 | 0.1 | School budget |
| `import_assistant` | request | fast | 800 | 0.1 | School budget |
| `usage_explain` | request | fast | 400 | 0.2 | School budget |
| `instruction_assistant` | request | smart | 1,500 | 0.3 | School budget |
| `theme_generation` | request | fast | 600 | 0.8 | School budget |
| `quest_badge_ideas`, `price_suggestions` | request | fast | 800 | 0.7 | School budget |
| `tts` | batch job | tts | n/a | n/a | School budget, cached |
Limits and credit costs come from the published `ai_limits` config (the numbers above are the AI-BEHAVIOR defaults).

---

## 6. STREAMING FUNCTIONS

Applies to `ai_tutor_chat`, `ai_writing_feedback`, `ai_copilot`, `ai_admin_copilot`.
Sequence in the Edge Function:
1. Verify JWT; `require_writable()` (view-as tokens are rejected).
2. Feature gate: `ai_features` config for this feature, user role, grade and class, and the schedule windows; otherwise `feature_disabled` as an `error` event before any text.
3. Limits: `check_and_reserve(user, feature, units)` atomically increments the counters in `ai_limit_counters` (day and month) against the limits plus overrides; over the limit returns `limit_reached`; also checks the school monthly budget behavior (stop all, stop non-essential, warn only).
4. Pre-check (section 4.1). On a blocked outcome: send `safety`, store the exchange, send `done`.
5. Persist the user message; build the prompt; call `adapter.stream`.
6. Forward `delta` events; accumulate text; run the sliding-window filter; on `AbortSignal` stop, save the partial.
7. Post-check; persist the assistant message with usage and safety metadata; write `ai_usage` and `ai_activity_log`; adjust the counters with actual usage; send `usage` and `done`.
8. Copilot only: when the model requests creating an action card (a tool call with structured arguments validated by the card kind's schema), the function creates the `ai_action_cards` row (`status='ready'`) and sends a `card` event.
First event within 1.5 seconds: `meta` and `status` are sent immediately after the limits check, before the model call.

---

## 7. STRUCTURED OUTPUTS
Features that return structured data (writing feedback, grading, generation, support plans, planner, suggestions, triage, classification) define a Zod schema; the adapter asks the provider for JSON (using the provider's structured-output mode where available) and validates; one repair attempt on failure. Schemas live in `_shared/schemas.ts` and are exported to the frontend package for typing.
Key schemas (fields summarized):
- WritingFeedback: summary, scores {task, grammar, vocabulary, organization, spelling_punctuation} 0 to 4, corrections [{span, issue, suggestion, reason}], corrected_text, tips[3].
- GradeResult: per_criterion [{key, score 0..4, rationale <=25 words}], comment <=60 words, confidence 0..1, flags[].
- QuestionSet: questions [{type, prompt, options, answer, explanation, skill, difficulty}] matching `questions` payloads.
- LessonDraft: intro, body, examples[], keywords[], check_questions[3], audio_script?.
- CoursePlan: units [{title, objectives[], lessons[{title, minutes}], activities[], quiz_topics[]}].
- ActionCard: kind, summary, preview, changes[], sources[], notes[].
- SupportPlan, PlannerPlan, TriageResult and others follow AI-BEHAVIOR sections 5 and 6.

---

## 8. ACTION CARDS

### 8.1 Creation
Features create `ai_action_cards` rows with `status='generating'` then `ready`. Fields: `summary`, `preview` (renderable content), `changes` (typed operations), `sources` (links to data used), `notes`, and `stamps` (the `version` or `updated_at` of every existing record the card depends on).
### 8.2 Change operations
`changes` is a list of operations the apply function understands: `create_draft {entity, data}`, `update {entity, id, patch, before}`, `publish {entity, id, schedule}`, `assign {entity, id, class_ids}`, `schedule {entity, id, at}`, `notify {audience, template}`, `award {student_ids, xp, coins, reason}`, `create_quest {...}`. The preview shows each operation in plain words ("Creates 1 quiz with 10 questions. Assigns it to 8B and 8C. Opens Thursday 08:00. Notifies 46 students.").
### 8.3 Applying (`ai_action_apply` to `apply_action_card(card_id, edits)`)
A single SQL function, SECURITY INVOKER (so the approver's RLS applies), dispatches by kind to internal apply functions inside one transaction:
1. Lock the card row; require status `ready`.
2. Stale check: compare `stamps` to the current rows; a mismatch sets status `stale` and returns `stale_card`.
3. Apply the operations in order; each uses the same RPC rules as manual actions (publish validation, caps, notifications). Any failure rolls back the whole card.
4. Record `result` (created ids, changed ids), set status `approved` (or `edited` when the user edited the preview), `resolved_at`, `resolved_by`; write `ai_activity_log` (result approved or edited) and audit for privileged kinds.
5. Return an `undo_token`.
`ai_action_undo` within 30 seconds: reverts what the result lists (deletes created drafts; reverts publish to draft; cancels scheduled items) only if no student interaction has happened on the created items yet; otherwise returns `invalid_state`.
### 8.4 Kinds and their effects
| Kind | Apply effect |
|---|---|
| create_questions | Inserts questions into the bank (origin ai) and optionally attaches them to a target quiz or assignment draft |
| create_quiz / create_assignment | Inserts the draft, snapshots questions, optionally publishes and schedules |
| create_lesson / content_item | Inserts blocks into a lesson or new content (origin ai, unreviewed) |
| create_course | Course draft created by the job; the card marks it for review; publishing still needs `reviewed_ack` |
| create_announcement | Creates the announcement and publishes or schedules it |
| grade_draft | Writes teacher fields from AI values (accept) for the chosen submissions |
| support_plan_step | Creates the assignment, quest, announcement or bonus for the plan |
| schedule_change / planner | Creates planner items and scheduled releases, assignments, announcements |
| bonus_award | Calls `award_bonus` with the caps |
| quest | Creates a class quest |
| report_comments | Stores comments into the report snapshot |
| class_setup, rules_suggestion | Updates class rules with version check |
| curriculum_draft | Creates the curriculum version content as drafts |
### 8.5 Rejection and regeneration
`ai_action_discard` sets `discarded` and logs it; `ai_action_regenerate` creates a new card from the same inputs plus the instruction and marks the old one discarded.

---

## 9. JOB RUNNER (`job-runner` Edge Function)

- Trigger: a DB trigger on `jobs` insert calls the function through pg_net (fire and forget); cron `run_jobs` calls it every minute as a safety net.
- Claiming: `claim_next_job(worker_id)` selects the next runnable job with `FOR UPDATE SKIP LOCKED` ordered by priority and `run_after`, sets `locked_by`, `locked_at`, `status='running'`. Per-user concurrency limit 2 and per-kind limits (course and curriculum generation 2 concurrent in total) are enforced by the claim function.
- Steps: each job kind has a planner that returns step definitions; the runner executes steps one by one (some kinds allow 2 steps in parallel), each under 100 seconds. It writes `job_steps`, updates `jobs.progress`, and checks `cancel_requested` between steps. The runner invocation exits before the platform time limit and re-invokes itself (or leaves the remaining steps to the next trigger) so long jobs continue.
- Retries: a failed step is retried with exponential backoff (30 s, 2 min, 10 min) up to `max_attempts`; transient provider errors count; validation failures retry once with repair. After the last attempt the job is `failed` and a `moderation_items` row (type failed_job, Low) is created; the user sees "We could not finish this. Your progress is saved. Retry the failed step."
- Reaper: `job_reaper` re-queues jobs with a stale lock.
- Idempotent steps: each step has a deterministic key; completed steps are never re-run on retry; partial output is already stored as drafts with origin `ai`.
### Example: `ai_course`
Steps: (1) outline from source and shape (structured CoursePlan); (2) for each unit in order, generate its lessons (up to 2 lessons in parallel), activities and the unit quiz questions; (3) validate (checklist, duplicates, reading level) and mark low-confidence items; (4) assemble: set statuses draft, origin ai; (5) finish: `result = {course_id, counts, low_confidence_items}` and notify the teacher. The wizard's step 3 (review outline) is a separate synchronous call (`ai_page_action: course_outline`) before the job is started with the approved outline.

---

## 10. METERING, LIMITS AND BUDGET

- `ai_usage` gets a row per model call (user, role, grade, class, feature, tokens, cost micro, credits, status, safety category, dry_run flag, meta with prompt version and model).
- `ai_limit_counters` holds per-user per-feature counters by period (`day:` and `month:` keys); `check_and_reserve` increments in a single statement and returns the remaining; the final adjustment replaces the estimate with actual tokens and credits.
- Limit resolution: published `ai_limits` default, then `ai_overrides` for the class, then for the user (most specific wins; the latest unexpired override).
- School budget: `ai_month_totals(month, cost_micro, requests)` maintained by a trigger on `ai_usage`. The hourly `ai_budget_check` compares with the thresholds (70, 90, 100 percent) and notifies admins. At 100 percent the configured behavior applies: `stop_all` (every feature returns `limit_reached` copy for the school), `stop_non_essential` (keep tutor chat, grading and safety features), or `warn_only`.
- Dry runs (test sandbox and test suites) write usage with `dry_run=true`, are excluded from user counters, and are reported as test usage.
- Reservation for jobs: the full credit cost is reserved when a job is created and refunded proportionally for steps that never ran.

---

## 11. EVALUATION AND TEST HARNESS

- Safety suite: the test cases in `ai_test_cases` (starter set from AI-BEHAVIOR section 7: 6 allowed, 6 off-topic, 6 blocked categories, 4 sensitive, 4 injection, 4 open-assessment) run through the REAL pipeline in dry-run mode (`ai_run_test_suite`), comparing the outcome (allowed, redirect, blocked, hint_only) to `expected`. All cases must pass for `publish_config` of `ai_safety` and `ai_instructions` unless a Super admin overrides with a reason (audited).
- Quality sets (run manually or nightly in CI against the dev provider key): 20 sample lessons, 40 questions, and 20 sample writing gradings with teacher reference scores. Targets: grading within one point per criterion of the reference on at least 85 percent of samples; exactly one correct answer in at least 98 percent of generated questions; zero blocked-category content. Results are stored and charted; a regression blocks a prompt version release.
- Prompt changes follow the same review as code: a pull request that changes a prompt module runs the suites.
- Feedback signals (thumbs, reports, approval rate) feed AD-23 and the next prompt iteration.

---

## 12. PRIVACY OF AI DATA
- Prompts contain no usernames, real names, emails or student codes; aliases map back server-side.
- Provider settings must disable training on customer data and use the shortest retention option the provider offers (a launch requirement; see 10-SECURITY-PRIVACY.md).
- Conversation text is stored only in `ai_messages`; application logs hold ids and metrics only.
- Admin access to conversations is only through `view_ai_conversation` with a logged reason.
- Deleting a student's AI history is a documented admin operation that nulls message content and keeps usage rows (retention policy decided later).

---

## 13. TEXT TO SPEECH
Described in 08-STORAGE-REALTIME-NOTIFICATIONS.md section 4. It uses `TtsAdapter`, the `tts_batch` job, the `media_assets.tts_hash` cache, and the school budget.
