# Day 3: Spec frameworks, decomposition & architecture

*Claude Code Upskilling — Day 3 of 5*

## Overview

*Day 03 · Spec, Decomposition & Architecture · ~80–120 min*

Eight concepts. This is where a spec stops being a one-off habit and becomes a repeatable process — tool-enforced checkpoints, planning kept separate from building, and one ordered chain that turns an approved spec into tasks small enough to check off.

### Today’s chapters

- **3.1. Spec frameworks: Spec Kit & BMAD** (~20–35 min) — Topics 20–21: GitHub Spec Kit, BMAD-METHOD
- **3.2. HLD, LLD & the Decomposition Pipeline** (~30–35 min) — Topics 22–23: HLD & LLD, The Decomposition Pipeline
- **3.3. Acceptance criteria & task decomposition** (~20 min) — Topics 24–25: Acceptance criteria, Task decomposition
- **3.4. Architecture-first & feeding the right context** (~10–30 min) — Topics 26–27: Architecture-first, Feeding the right context
- **Recap & takeaways** (Wrap-up) — Key takeaways and the day’s checkpoint.

*Each chapter ends with FAQs and a short practice quiz. Topic numbers run 1–43 across the five days, so a cross-reference such as “Topic 12” may point to another day’s playbook. Where the text says “Chapter 1” to “Chapter 5”, it means Day 1 to Day 5.*

### The topics

- **20. GitHub Spec Kit** (10 / 20 min) — Turning a repeatable spec habit into a tool-enforced, checkpointed workflow.
- **21. BMAD-METHOD** (10 / 15 min) — Keeping planning decisions out of the hands of whoever is mid-function.
- **22. HLD & LLD** (10 min) — Deciding what the pieces are before deciding what’s inside each one.
- **23. The Decomposition Pipeline** (20 / 25 min) — One ordered chain from feature to task, with frontend starting in parallel.
- **24. Acceptance criteria** (10 / 10 min) — Writing “done” so precisely nobody has to ask what you meant.
- **25. Task decomposition** (10 min) — Breaking the pipeline’s output into tasks small enough to check off cleanly.
- **26. Architecture-first** (— / 20 min) — Making sure every real design decision gets at least one honest alternative.
- **27. Feeding the right context** (10 min) — Pointing Claude Code at exactly the files a task needs — no more, no less.

---

## Chapter 3.1: Spec frameworks: Spec Kit & BMAD

*Day 03 · Chapter 3.1 · ~20–35 min*

### Topic 20: GitHub Spec Kit (10 / 20 min)

> **Core idea:** Spec Kit turns the SPEC framework from Chapter 2 into an actual five-phase workflow with checkpoints, so “write a spec” stops being a one-off habit and becomes a repeatable process with a tool watching each phase.

- **a. Five-phase flow & checkpoints** — Spec Kit breaks into five phases, listed below: Constitution, Specify, Plan, Tasks, Implement. Each is gated by a checkpoint: nothing moves to the next phase until the current one has something concrete to show for it, not just a feeling that it’s ready.
- **b. The constitution file** — This is the project’s non-negotiables, written down once — the same role CLAUDE.md plays from Topic 8, but scoped specifically to how a spec gets built rather than how the codebase gets touched. The two files coexist; they don’t compete.
- **c. Agent role by phase** — Claude Code’s job changes shape across the five phases: drafting principles in Constitution, drafting requirements in Specify, proposing an approach in Plan, breaking the plan down in Tasks, and executing a locked list in Implement. The same tool is doing meaningfully different work depending on which phase it’s in, not the same thing five times over.
- **d. Try it: run it against a real feature** — Run Spec Kit’s actual phases against a real feature request from a project you’re working on, so you see a checkpoint genuinely block progress rather than reading the concept described in the abstract.

**The five phases, in order**

Spec Kit runs as slash commands inside Claude Code. The constitution is written once per project. The other four phases repeat for every feature.

- **1. Constitution** (`/speckit-constitution`) — Writes the project’s non-negotiables into `constitution.md`: quality bar, testing expectations, conventions. *Checkpoint:* you have read it and agree with every line, because every later phase is checked against it.
- **2. Specify** (`/speckit-specify`) — Turns a plain-language feature request into `spec.md`: what the feature must do and why, with no technology choices yet. *Checkpoint:* the spec is reviewed, and the open questions in it are answered rather than guessed.
- **3. Plan** (`/speckit-plan`) — Turns the approved spec into `plan.md`: the technical approach and the design artifacts that go with it. *Checkpoint:* you have read the approach and it fits both the spec and the constitution.
- **4. Tasks** (`/speckit-tasks`) — Turns the plan into `tasks.md`, a dependency-ordered list of small, actionable tasks. *Checkpoint:* each task is small enough to check, and the order makes sense.
- **5. Implement** (`/speckit-implement`) — Executes the tasks in order. *Checkpoint:* the work is checked against the spec and the tests, not against how finished it looks.

Spec Kit also has optional quality gates you can add between phases: `/speckit-clarify` asks targeted questions about anything the spec leaves vague, `/speckit-checklist` generates a quality checklist for the requirements, and `/speckit-analyze` reports conflicts and gaps across the spec, plan and tasks without changing anything. Recent releases also add `/speckit-converge` after Implement, which checks the codebase against the spec, plan and tasks. Older releases spell the commands with a dot, such as `/speckit.specify`, so use the spelling your installed version lists. ([source](https://github.github.io/spec-kit/quickstart.html))

### Topic 21: BMAD-METHOD (10 / 15 min)

> **Core idea:** BMAD forces planning and building apart into two distinct modes, so a decision never gets made accidentally, mid-implementation, by whoever happens to be writing code at the time.

- **a. Why planning & building split** — The separation exists because a decision made deep inside implementation is made under the wrong pressure — the pressure to finish the function in front of you, not the pressure to get the architecture right.
- **b. PRD + architecture before dev** — Nothing gets built until both exist and are approved, mirroring the plan-before-act discipline from Topic 11, just applied one layer up, at the level of the whole feature instead of a single prompt.
- **c. Story files as handoff** — The PRD and architecture get handed to development as story files — a deliberately narrow, executable slice, not the whole plan re-explained from scratch to whoever picks it up.
- **d. Comparison to Spec Kit** — Spec Kit’s checkpoints live inside one continuous flow; BMAD draws a harder line between planning mode and building mode. Neither is strictly better — the right one depends on whether a team already has a planning discipline or needs the tool to enforce one.

**Prompt sketch: planning mode, PRD first**

*Step 1 of 3. Nothing gets built until the PRD is approved.*

```
We are in planning mode. Do not write any code.

Idea: [one-line idea, e.g. "notify managers when a coverage gap appears"]

Draft a short PRD: the problem, who it is for, what is in scope for v1, what is explicitly deferred, and the acceptance criteria.
List open questions at the end instead of guessing at the answers.
```

**Prompt sketch: planning mode, architecture options**

*Step 2 of 3. Run it once the PRD is approved. The decision and the reasons the other options lost get written down.*

```
Still planning mode. Using the approved PRD, propose [2 or 3] architecture options for [the main technical decision, e.g. how updates reach the user: polling, WebSockets or server-sent events].

For each option give: how it works, the tradeoffs (cost, latency, complexity, how reversible it is), and why it might lose.
Recommend one, then write a short decision record: what we chose, what we rejected, and why each rejected option lost.
```

**Prompt sketch: story files**

*Step 3 of 3. Run it once the PRD and the architecture decision are both approved.*

```
The PRD and the architecture decision are approved. Split the work into story files, one per self-contained slice (for example: data model and API, delivery mechanism, UI).

Each story file should contain only what is needed to build that slice: the goal, the relevant part of the PRD, the relevant part of the decision record, and its own acceptance criteria.
Do not re-explain the whole plan in each one.
```

**Who does what in BMAD**

BMAD gives each stage of the work to a separate role, and each role hands the next one a document. The exact set of roles and their names differ between BMAD releases, so follow the version you install. The pattern is the same:

- **Planning mode: the Product Manager role** — Interviews you about the idea and writes the PRD: what is being built and why, and what is in scope.
- **Planning mode: the Architect role** — Reads the PRD, makes the technical decisions explicit, and writes the architecture document, including the options that lost.
- **The handoff: the Scrum Master role** — Breaks the approved PRD and architecture into story files. In BMAD’s own terms the big documents are also split into smaller pieces (“sharded”), so a story only needs the part that concerns it.
- **Building mode: the Developer role** — Implements one approved story at a time, and nothing outside it.
- **Reviewing: the QA role** — Checks the finished story against its acceptance criteria. Some releases fold this into the developer step, so check what yours provides.

BMAD’s own guidance is to start a fresh conversation each time you switch role, so one role’s reasoning doesn’t leak into the next. That is the same move as `/clear` in Topic 12: when the job changes, the context should too. ([source](https://git.biohazardvfx.com/Nicholai/BMAD-METHOD/src/tag/v4.29.6/docs/bmad-workflow-guide.md))

**When to reach for BMAD — and when not to**

BMAD earns its keep on anything with real architectural weight — a feature with more than one defensible way to build it, work that spans more than one sitting, or a PRD and architecture that need to survive being handed to someone other than the person who wrote them. The split matters most exactly when it’s most tempting to skip: under deadline pressure, when it would be faster to just start typing and let the architecture fall out of whatever gets built first.

It’s the wrong tool for a task small enough to hold in one head at once — a single-file fix, a same-sitting feature with no real design decision buried in it. For that size of work, Spec Kit’s inline checkpoints (Topic 20) or a plain SPEC (Topic 19) already provide enough structure; standing up a separate planning mode and build mode for a one-file change is the same over-serving mistake Topic 4b named for model selection, just at the process level instead of the model level.

**Try it: worked example — the thinking pattern**

Work through this the same way as Topic 19’s worked example — the value is in watching the two modes stay separate, not in a finished PRD.

Start with the vague ask exactly as it would arrive: “Can we notify users when someone updates a task they’re watching?”

- **Planning mode — PRD first, scope before delivery mechanism.** Decide what “notify” actually covers before touching a data model: in-app only for v1, with email and push explicitly deferred. Write that boundary down the same way Topic 19’s Scope step did — it’s the same move, one layer up.
- **Planning mode — architecture, argued and recorded.** This is where BMAD earns the whole exercise: polling, WebSocket, or server-sent events is a real decision with real tradeoffs — latency against server load against implementation cost — and it’s exactly the kind of decision that gets made silently, by whoever writes the first line of code, if nobody stops to make it on purpose. Make it here instead, deliberately, with the losing options and why they lost written down next to the winner.
- **The handoff — sharded into story files.** Once the PRD and architecture are approved, split the work into self-contained stories: a data-model-and-API story, a real-time-delivery story, a notification-bell-UI story. Each one is handed to a build session with only its own story file as context — not the whole PRD re-explained from the top.
- **Building mode — implement one story, nothing else.** Hand Claude Code the data-model story alone and watch it implement that slice without re-opening the WebSocket-versus-polling question, because that question is already closed and on record. That’s the entire point of the split — a build session shouldn’t be able to accidentally relitigate a decision that planning mode already made.

The pattern worth landing: the split isn’t bureaucracy for its own sake. It exists so a decision gets made exactly once, by whoever’s actually weighing the tradeoff, instead of getting made implicitly by whoever happens to be mid-function when the question first comes up.

### FAQs

**Q: Spec Kit has five phases. How is the Constitution phase different from the other four?**

A: The constitution is written once per project, while Specify, Plan, Tasks and Implement repeat for every feature. It holds the project’s non-negotiables, and every later phase is checked against it.

**Q: Where do CLAUDE.md and the Spec Kit constitution each fit?**

A: They coexist rather than compete. CLAUDE.md governs how the codebase gets touched; the constitution holds the non-negotiables for how a spec gets built.

**Q: Why does the Specify phase leave out technology choices?**

A: Specify says what the feature must do and why. The technical approach is the Plan phase’s job, so the spec can be reviewed on requirements alone before any approach is locked in.

**Q: A BMAD story file contains only a slice of the PRD. Isn’t that a loss of context?**

A: It’s the point. A story file is a deliberately narrow, executable slice with only what that slice needs. With only that as context, a build session can’t accidentally relitigate a decision planning mode has already made.

**Q: Why does BMAD’s guidance say to start a fresh conversation each time you switch role?**

A: So one role’s reasoning doesn’t leak into the next. It is the same move as `/clear` in Topic 12: when the job changes, the context should too.

**Q: A feature has one obvious design and fits in a single sitting. Spec Kit, BMAD or neither?**

A: Neither full process. Spec Kit’s inline checkpoints or a plain SPEC (Topic 19) already give enough structure. BMAD’s planning and building split is for work with real architectural weight: more than one defensible way to build it, or a PRD and architecture that must survive a handoff.

### Practice quiz

**Q1.** Which sequence lists Spec Kit’s five phases in order?

- A. Constitution, Specify, Plan, Tasks, Implement ✅
- B. Specify, Constitution, Plan, Implement, Tasks
- C. Plan, Specify, Tasks, Constitution, Implement
- D. Constitution, Plan, Specify, Implement, Tasks

*Explanation:* Answer A. The constitution comes first, then Specify, Plan, Tasks and Implement.

**Q2.** In Spec Kit, what does a checkpoint actually block?

- A. Any edit to the constitution
- B. Running the test suite
- C. Moving to the next phase until the current one has something concrete to show for it ✅
- D. Starting a second feature in the same repository

*Explanation:* Answer C. Nothing moves on because of a feeling that it’s ready. The phase needs a concrete output first.

**Q3.** You’ve finished the Plan phase for a second feature in a project that already has a constitution. What comes next?

- A. The Constitution phase again, since each feature needs its own
- B. Implement, skipping Tasks
- C. Tasks. The constitution is written once and isn’t repeated per feature ✅
- D. Specify again

*Explanation:* Answer C. Specify, Plan, Tasks and Implement repeat per feature. The constitution is written once per project.

**Q4.** In the BMAD flow described in this chapter, which role breaks the approved PRD and architecture into story files?

- A. The Scrum Master role ✅
- B. The Architect role
- C. The Developer role
- D. The Product Manager role

*Explanation:* Answer A. The Product Manager writes the PRD and the Architect the architecture. The Scrum Master turns both into stories for the Developer.

**Q5.** Which situation is the strongest case for BMAD’s split between planning and building?

- A. A one-file bug fix
- B. A same-sitting feature with no real design decision
- C. A typo fix
- D. A feature with more than one defensible design, whose PRD and architecture will be handed to someone else ✅

*Explanation:* Answer D. BMAD earns its keep where there is real architectural weight, and where the plan has to survive being handed over.

**Q6.** Why does BMAD’s guidance say to start a fresh conversation when you switch role?

- A. To reduce the cost of each conversation
- B. So one role’s reasoning doesn’t leak into the next ✅
- C. Because roles can’t work in the same repository
- D. Because the PRD is deleted after each role finishes

*Explanation:* Answer B. The same logic as `/clear` in Topic 12: when the job changes, the context should change too.

---

## Chapter 3.2: HLD, LLD & the Decomposition Pipeline

*Day 03 · Chapter 3.2 · ~30–35 min*

### Topic 22: HLD & LLD (10 min)

> **Core idea:** A high-level design decides what the pieces are and how they talk to each other; a low-level design decides exactly what’s inside each piece — doing them in the wrong order produces a design that looks finished but isn’t load-bearing.

- **a. HLD: subfeatures & boundaries** — This is where a feature gets split into subfeatures and where a boundary gets drawn between them — the level at which “what talks to what” gets decided, not “how.”
- **b. LLD: signatures & data flow** — This is the level for function signatures and exact data flow — the detail an implementer actually needs, deliberately postponed until boundaries exist to draw it against.
- **c. Myth check: failure — LLD before HLD** — If you already know exactly what a function should do, why not just write its signature first? No — a signature written before the boundary around it exists usually has to be rewritten once that boundary finally gets drawn. The detail work gets done twice instead of once.
- **d. Specifying the layer explicitly** — State explicitly which layer you’re currently working at. “This is HLD” or “this is LLD now” costs one sentence and prevents this topic’s single most common failure: a design conversation that quietly drifts into implementation detail while you still believe you’re discussing architecture.

**Prompt sketch: HLD only**

*Step 1. Say the layer out loud so the conversation does not drift into implementation.*

```
This is HLD. Do not write code or function signatures.

Feature: [feature from the BRD]

Split it into subfeatures. For each one give: what it is responsible for, and what it talks to.
Show the boundaries as a list of the form "A talks to B to get or do X".
Flag any boundary you are unsure about.
```

**Prompt sketch: then LLD**

*Step 2. Only after the HLD boundaries are agreed. One subfeature at a time.*

```
This is LLD now, for the [name of one subfeature] subfeature only, inside the boundaries we agreed in the HLD.

Give me the function signatures, the data each one takes and returns, and how data flows between them.
Do not change the boundaries. If the HLD turns out to be wrong, stop and tell me instead of working around it.
```

### Topic 23: The Decomposition Pipeline (20 / 25 min)

> **Core idea:** One ordered chain — feature, subfeature (HLD), implementation (LLD), data model, API, task management — with frontend work started in parallel once HLD and the API contract are settled, not queued behind the backend.

- **a. Six-step chain & ordering** — The full chain, in order, with the reasoning behind each step’s position: subfeature before implementation, because you can’t detail what you haven’t bounded (Topic 22); implementation before data model, because the shape of the work should decide the shape of the data, not the reverse; data model before API, because an API is a contract over data that has to exist first to have a contract over.
- **b. Data model before API** — This is the step most often skipped under time pressure, and the most expensive one to skip. An API designed before the data model is settled tends to leak implementation detail into its contract, and unwinding that later means changing something every client already depends on.
- **c. Try it: the parallel-frontend rule** — This is the rule the whole course is built around: once HLD and the API contract are locked, frontend work starts immediately, in parallel with backend implementation, not queued behind it. Try it yourself — with the API contract from step five settled, start a frontend scaffold against it while backend LLD is still being written, so two tracks move at once instead of one waiting on the other. Frontend decisions made by whoever wrote the API tend to be shaped by what was easy to build, not what the user actually needs; starting frontend work independently, from the same contract, keeps the UI answerable to the user instead of to the API author’s assumptions.
- **d. Overlap with Spec Kit & BMAD** — Neither framework replaces this pipeline; they operate one level up, deciding when a spec is approved and who approves it. The pipeline is what happens after that approval, at the level of the feature itself.
- **e. Definition of done, per step** — Every step in the chain gets its own definition of done before the next step starts, not one definition at the very end. A data model is done when it’s been checked against the API it needs to support — not when it merely looks complete sitting on its own.

**Prompt sketch: a frontend scaffold from the API contract**

*Run it once the API contract is locked, while backend work is still going on.*

```
The API contract below is locked. Build a frontend scaffold against it only. Do not read or change the backend.

[paste the API contract: endpoints, request and response shapes, error cases]

Create the screens and components for [the user-facing parts of the feature], with the API calls stubbed to return data in exactly these shapes.
Where the contract does not cover something a screen needs, list it as a question instead of inventing a field.
```

### FAQs

**Q: Halfway through an architecture discussion, Claude Code has started proposing function signatures. What went wrong?**

A: The conversation drifted from HLD into LLD while you still believed you were discussing architecture. The fix costs one sentence: say which layer you’re working at, such as “This is HLD” or “This is LLD now”.

**Q: Settling the API first would let the frontend start sooner. Why must the data model come first?**

A: An API is a contract over data, so the data has to exist first. An API designed before the data model is settled tends to leak implementation detail into the contract, and unwinding that later means changing something every client already depends on.

**Q: Why does implementation (LLD) come before the data model, when most people design tables first?**

A: Because the shape of the work should decide the shape of the data, not the reverse. In the same way, subfeatures (HLD) come before implementation, because you can’t detail what you haven’t bounded.

**Q: The frontend developer says they should wait until the API is built. Who is right?**

A: Neither of them should wait. Once HLD and the API contract are locked, frontend work starts immediately and in parallel, from the same contract. Frontend decisions made by whoever wrote the API tend to reflect what was easy to build, not what the user needs.

**Q: My data model looks complete. Is that step done?**

A: Not until it has been checked against the API it needs to support. Every step gets its own definition of done before the next begins, and a data model that merely looks complete on its own isn’t done.

**Q: Doesn’t Spec Kit or BMAD already cover all of this?**

A: No. They operate one level up, deciding when a spec is approved and who approves it. The pipeline is what happens after that approval, at the level of the feature itself.

### Practice quiz

**Q1.** A design discussion produces `validateLeave(request, balance) -> Result` before any boundaries have been agreed. What is the problem?

- A. None; signatures are always welcome early
- B. Signatures belong in the data model step
- C. The function name is too long
- D. LLD detail was written before the HLD boundary existed, so it will probably be rewritten ✅

*Explanation:* Answer D. A signature written before the boundary around it exists usually has to be redone once the boundary is drawn.

**Q2.** Under deadline pressure, a team goes from implementation straight to the API and settles the data model later. What is the likely cost?

- A. None, because the API is a separate concern
- B. The API leaks implementation detail into its contract, and unwinding it changes something every client depends on ✅
- C. The frontend can start earlier
- D. The task list gets shorter

*Explanation:* Answer B. The data model before API is the step most often skipped, and the most expensive one to skip.

**Q3.** HLD and the API contract are locked, and backend LLD is still being written. What should the frontend developer do?

- A. Start a scaffold against the contract now, in parallel ✅
- B. Redesign the API
- C. Wait for the backend to finish
- D. Write the data model

*Explanation:* Answer A. Two tracks move at once from the same contract, rather than one waiting on the other.

**Q4.** Which statement about HLD and LLD is correct?

- A. HLD decides signatures and exact data flow; LLD decides the boundaries
- B. They are the same level done at different times
- C. HLD decides what the pieces are and what talks to what; LLD decides what’s inside each piece ✅
- D. LLD comes first whenever you already know what a function should do

*Explanation:* Answer C. Doing them in the wrong order produces a design that looks finished but isn’t load-bearing.

**Q5.** Why start the frontend from the API contract rather than from the API author’s implementation?

- A. To save compile time
- B. Because backend developers dislike UI work
- C. Because frontend decisions made by the API author tend to reflect what was easy to build, not what the user needs ✅
- D. Because contracts change less often than code

*Explanation:* Answer C. Starting from the same contract independently keeps the UI answerable to the user.

**Q6.** How do Spec Kit and BMAD relate to the decomposition pipeline?

- A. They operate one level up, deciding when a spec is approved and who approves it. The pipeline is what happens after ✅
- B. They replace it
- C. They run after the pipeline has finished
- D. They apply only to frontend work

*Explanation:* Answer A. Neither framework replaces the pipeline. The pipeline works at the level of the feature itself.

---

## Chapter 3.3: Acceptance criteria & task decomposition

*Day 03 · Chapter 3.3 · ~20 min*

### Topic 24: Acceptance criteria (10 / 10 min)

> **Core idea:** Acceptance criteria are what “definition of done” from Topic 23e looks like written down in a form someone else — or Claude Code itself — can check without asking a follow-up question.

- **a. Writing done before code** — Write acceptance criteria before any implementation starts, for the same reason a spec gets written before a build: a criterion invented after the code exists tends to describe what the code already does, not what it was actually supposed to do.
- **b. Self-checkable criteria** — A good criterion can be checked by reading the output, not by asking the author what they meant. “Handles errors gracefully” fails that test; “returns a 400 with a field-level error message when a required field is missing” passes it.
- **c. Common omissions** — The two that get skipped most often: what happens on empty input, and what happens when two people do the conflicting thing at the same time. Both are cheap to specify in advance and expensive to discover in production.

**Prompt sketch: self-checkable acceptance criteria**

*Run it before any implementation starts.*

```
Write acceptance criteria for [feature] before any implementation.

Each criterion must be checkable by reading the output or running a test, with no need to ask me what it meant.
Use the form: Given ..., when ..., then ...
Include at least one criterion for empty input and one for two people doing conflicting things at the same time.
Flag any criterion you cannot make checkable.
```

### Topic 25: Task decomposition (10 min)

> **Core idea:** The pipeline’s output isn’t a finished feature — it’s a set of tasks small enough that any one of them can be checked as done or not done, with nothing ambiguous left in between.

- **a. Pipeline output into tasks** — Each step of Topic 23’s chain produces its own tasks rather than one giant task at the end — the data model step produces data-model tasks, the API step produces API tasks — so progress is visible at every layer, not just at the finish line.
- **b. Task granularity** — Use a concrete test: if a task can’t be described as done in one sentence, it’s still two tasks wearing one label. Split it before starting, not halfway through.
- **c. Tracking progress across a session** — Keep the task list in a file such as `TASKS.md` and have Claude Code tick each item off as it finishes it. Because the list lives in a file and not in the conversation, it survives a `/compact` or `/clear` and an interrupted session, so nothing silently falls off the list and a multi-hour session can be picked up where it stopped. (The reasoning behind your choices belongs in a separate decision record: see Topic 26c.)

**Prompt sketch: split into one-sentence tasks**

*Run it with the acceptance criteria already written.*

```
Break [feature] into tasks, following the pipeline order: subfeature, implementation, data model, API.

Each task must be describable as done in one sentence. If describing it needs the word "and", split it.
For each task give: the one-sentence definition of done, and which acceptance criterion it satisfies.
Put them in TASKS.md as a checklist, and tick each one off as you complete it.
```

### FAQs

**Q: Why not write acceptance criteria after the code, when I can see what it actually does?**

A: Because a criterion invented after the code exists tends to describe what the code already does, not what it was supposed to do. Written before implementation, it can expose the difference.

**Q: “The form validates input properly.” Why isn’t that a good criterion?**

A: Nobody can check it by reading the output without asking the author what “properly” meant. A criterion has to be self-checkable, such as “returns a 400 with a field-level error message when a required field is missing”.

**Q: Two admins approve the same leave request at the same moment. Where does that belong in my criteria?**

A: As an explicit criterion of its own. Two people doing conflicting things at once, along with empty input, is what gets skipped most often. Both are cheap to specify in advance and expensive to discover in production.

**Q: A task reads “Add the endpoint and update the docs”. What should I do with it?**

A: Split it. If a task can’t be described as done in one sentence without the word “and”, it’s two tasks wearing one label. Split before starting, not halfway through.

**Q: Why does each pipeline step get its own tasks rather than one big list at the end?**

A: So progress is visible at every layer. The data model step produces data-model tasks and the API step produces API tasks, instead of one giant task and a single finish line.

### Practice quiz

**Q1.** Which rewrite fixes the criterion “The export handles bad input well”?

- A. “The export is robust”
- B. “The export is fast”
- C. “The export follows best practice for input handling”
- D. “Given a file with a missing required column, when the export runs, then it stops and names the column” ✅

*Explanation:* Answer D. A self-checkable criterion can be verified by reading the output, with no need to ask the author what it meant.

**Q2.** Why write acceptance criteria before implementation rather than after?

- A. Criteria are shorter beforehand
- B. Criteria written afterwards describe what the code already does, not what it was supposed to do ✅
- C. A model can’t read criteria once code exists
- D. It is required before a commit is allowed

*Explanation:* Answer B. Written afterwards, criteria drift towards the existing behaviour instead of the intended behaviour.

**Q3.** Your criteria cover the happy path and validation errors. Which two cases does the chapter say get left out most often?

- A. Dark mode and translations
- B. Slow networks and large screens
- C. Logging and metrics
- D. Empty input, and two people doing conflicting things at the same time ✅

*Explanation:* Answer D. Both are cheap to specify in advance and expensive to discover in production.

**Q4.** Which task is correctly sized?

- A. “Create the data model and the API for notifications”
- B. “Add the notifications table, as defined in the data model” ✅
- C. “Finish the feature”
- D. “Handle everything on the backend”

*Explanation:* Answer B. It can be described as done in one sentence with no “and”. The others are several tasks wearing one label.

**Q5.** The API step of the pipeline has finished. What should it have produced?

- A. API tasks of its own, so progress is visible at every layer ✅
- B. Nothing until the whole chain is done
- C. One large task merged with the data model
- D. A task list written after the feature ships

*Explanation:* Answer A. Each step of the chain produces its own tasks.

---

## Chapter 3.4: Architecture-first & feeding the right context

*Day 03 · Chapter 3.4 · ~10–30 min*

### Topic 26: Architecture-first (— / 20 min)

> **Core idea:** Every real architecture decision has at least two defensible options — the work is recording why one was chosen over the other, not just which one.

- **a. Options before a decision** — Never let a single option arrive alone. Even a strong instinct for the right answer is worth pairing with at least one genuine alternative, if only to find out whether the instinct survives being argued against.
- **b. Tradeoff axes** — Name the actual axes a decision gets weighed on — cost, speed, complexity, how reversible it is later — rather than debating the options in the abstract with no shared criteria.
- **c. Recording the why, not just the what** — Write down why an option lost, not just which one won. Six months from now the code shows what was decided; only the record shows whether the reasoning still holds or the constraints that produced it have quietly changed.

**Prompt sketch: two options and a decision record**

*Use it for any real architecture decision, so the loser and the reason it lost are on record.*

```
Decision to make: [the architecture decision].

Give me two options, not one. Compare them on [cost, speed, complexity and how reversible each is later].
Recommend one. Then write a short decision record: what we chose, what we rejected, and why the rejected option lost, so someone reading this in six months can tell whether the reasoning still holds.
```

### Topic 27: Feeding the right context (10 min)

> **Core idea:** Claude Code can only reason well about what it’s actually been shown, so the skill isn’t remembering to mention files — it’s mentioning the right ones, and no more.

- **a. @-mentions & glob patterns** — Both the precise version — naming an exact file — and the broader version — a glob pattern pulling in a whole directory — have their place; knowing when each is the right call is the actual skill.
- **b. Myth check: point, don’t dump** — If more context always helps, why not just @-mention the whole repo? No — Topic 3d already established that a cluttered window degrades answers rather than improving them. Pointing at the three files that matter beats dumping in thirty that might.
- **c. Read-before-edit habit** — Make it a reflex: Claude Code reading a file before editing it isn’t a formality — it’s the same “check reality before acting” habit from Topic 3c, applied to files instead of tool calls.

### FAQs

**Q: The second option the model offered is obviously weaker. Is writing it down still worth it?**

A: Yes. An option that has survived being argued against is better justified, and the reason the loser lost is what a future reader needs. The record shows whether the reasoning still holds or the constraints behind it have quietly changed.

**Q: Our decision record says only “We chose Postgres.” What is missing?**

A: Why the alternatives lost, weighed on named axes such as cost, speed, complexity and how reversible the choice is. The code already shows what was decided. Only the record shows whether the reasoning still holds.

**Q: Why name tradeoff axes? Can’t we just list pros and cons?**

A: Without shared criteria, the debate happens in the abstract and each option gets judged on a different yardstick. Naming the axes gives both options the same one.

**Q: I @-mention the whole repo “just in case”. Why would answers get worse?**

A: A cluttered window degrades answers instead of improving them, as Topic 3d established. Pointing at the three files that matter beats dumping in thirty that might.

**Q: When do I @-mention an exact file and when a glob pattern?**

A: Name the exact file when you know which one matters. Use a glob when a whole directory is genuinely relevant. Either way, point rather than dump.

### Practice quiz

**Q1.** You have a strong instinct about the right design. What does the chapter ask you to do?

- A. Go ahead; instinct is enough
- B. Ask the model to confirm it
- C. Pair it with at least one genuine alternative, to find out whether the instinct survives being argued against ✅
- D. Collect five options before deciding

*Explanation:* Answer C. Never let a single option arrive alone, however strong the instinct.

**Q2.** Which decision record will be most useful in six months?

- A. “Chose option A.”
- B. “See the commit history.”
- C. “Chose A over B on cost and reversibility. B lost because it would be costly to undo.” ✅
- D. “A and B were both considered.”

*Explanation:* Answer C. The code shows what was decided. The reason the loser lost shows whether the decision still holds.

**Q3.** Why name the tradeoff axes before comparing options?

- A. So both options are judged against shared criteria, not debated in the abstract ✅
- B. So the model uses fewer tokens
- C. So the decision is made faster
- D. So the losing option can be ignored

*Explanation:* Answer A. Cost, speed, complexity and reversibility give the comparison a common yardstick.

**Q4.** A task depends on three specific files. Which approach does the chapter favour?

- A. @-mention the whole repository
- B. Describe the files in prose
- C. Let it explore with no pointers at all
- D. @-mention exactly those three files ✅

*Explanation:* Answer D. Pointing at the three that matter beats dumping in thirty that might.

**Q5.** The read-before-edit habit is an application of which earlier idea?

- A. Plan before acting, from Topic 11
- B. Check reality before acting, from Topic 3c, applied to files ✅
- C. Point, don’t dump, from Topic 27
- D. Name the layer you are working at, from Topic 22

*Explanation:* Answer B. Reading a file before editing it isn’t a formality. It’s the same habit as checking reality before a tool call.

---

## Day 3 recap & takeaways

*Day 03 · Recap · Wrap-up*

The points worth carrying out of the room today, followed by the checkpoint.

### Key takeaways

1. Spec Kit makes the spec a checkpointed workflow; BMAD forces planning and building apart. Pick by how much planning discipline the team already has, and don’t over-serve a small change with either.
2. Decide HLD before LLD, and say out loud which layer the conversation is at.
3. The chain runs feature, subfeature, implementation, data model, API, task management. Data model before API is the step that hurts most to skip.
4. Frontend starts in parallel once HLD and the API contract are locked.
5. Every step has its own definition of done, and acceptance criteria are written before the code in a form that can be checked without asking the author.
6. If a task can’t be described as done in one sentence, split it before starting.
7. Every architecture decision gets at least one honest alternative, and the record keeps why the loser lost.
8. Point Claude Code at exactly the files a task needs. Point, don’t dump.

### Checkpoint

**Chapter 3 checkpoint**

By the end of this chapter, you should be able to:

- [ ] Name Spec Kit’s five phases and explain what a checkpoint actually blocks
- [ ] Explain, in one sentence, why BMAD keeps planning and building in separate modes
- [ ] State which layer — HLD or LLD — a conversation is currently at, and catch the moment it drifts
- [ ] Walk the full six-step decomposition chain in order, from feature to task management, without looking it up
- [ ] Explain why frontend work starts in parallel with backend, not after it
- [ ] Write an acceptance criterion that could be checked without asking the author what they meant
- [ ] Split a task that’s secretly two tasks, before starting either one
- [ ] Use an @-mention or glob pattern to point Claude Code at exactly the files a task needs — no more, no less

*Anyone who can’t check one of these off knows exactly which topic to revisit before Chapter 4.*

### Up next

Day 4 moves into the codebase itself: reading before touching, sharper instructions, and extending Claude Code’s reach through MCP.

*[← Day 2: Workflow features, ADLC & writing specs](Claude_Code_Upskilling_Day2.html)*
