# Day 5: Docs, SOPs, debugging, testing & team guardrails

*Claude Code Upskilling — Day 5 of 5*

## Overview

*Day 05 · Docs, SOPs & Guardrails · ~95–130 min*

Eight concepts — the course’s final stretch. This is where individual habits turn into things a whole team can reuse: generated docs, packaged SOPs, a disciplined debugging loop, reviewed tests, and guardrails that hold up on a busy day, not just a careful one.

### Today’s chapters

- **5.1. Docs & SOPs** (~25–35 min) — Topics 36–37: Auto-generating docs from code, Coding SOP generation
- **5.2. Skills & starter kits** (~20–25 min) — Topics 38–39: Packaging an SOP as a Skill, Template repos & starter kits
- **5.3. Debugging & test generation** (~35–45 min) — Topics 40–41: Agent-assisted debugging, Test generation
- **5.4. Guardrails & team conventions** (~15–25 min) — Topics 42–43: Guardrails, Shared team conventions
- **Recap & takeaways** (Wrap-up) — Key takeaways and the day’s checkpoint.

*Each chapter ends with FAQs and a short practice quiz. Topic numbers run 1–43 across the five days, so a cross-reference such as “Topic 12” may point to another day’s playbook. Where the text says “Chapter 1” to “Chapter 5”, it means Day 1 to Day 5.*

### The topics

- **36. Auto-generating docs from code** (10 / 15 min) — Generating reference docs straight from the code — grounded, but not the whole story.
- **37. Coding SOP generation** (15 / 20 min) — Turning a solved debugging session into a procedure the next person can follow.
- **38. Packaging an SOP as a Skill** (10 / 15 min) — Turning a written SOP into skill instructions Claude Code can actually run.
- **39. Template repos & starter kits** (10 min) — Bundling a CLAUDE.md, permissions, and conventions into a project’s day zero.
- **40. Agent-assisted debugging** (20 / 25 min) — Running reproduce-isolate-diagnose-fix-verify on a real bug, in order.
- **41. Test generation** (15 / 20 min) — Reviewing a generated test for a meaningful assertion, not just a pass.
- **42. Guardrails** (5 / 10 min) — A check that runs whether or not anyone remembers to ask for it.
- **43. Shared team conventions** (10 / 15 min) — Writing team conventions down somewhere everyone actually reads.

---

## Chapter 5.1: Docs & SOPs

*Day 05 · Chapter 5.1 · ~25–35 min*

### Topic 36: Auto-generating docs from code (10 / 15 min)

> **Core idea:** Documentation generated straight from the code can’t silently drift out of sync the way hand-maintained prose habitually does — but generated isn’t the same as correct, and someone still has to read what came out.

- **a. Generating from code, not by hand** — Point Claude Code at a project’s API layer and have it produce reference docs straight from the actual function signatures, types, and route definitions, rather than writing prose from memory about what the code is believed to do. The output is grounded in what’s actually there today, not in whatever was true the last time someone sat down to update a wiki page.
- **b. Design Logs vs. Documentation** — There’s a limit to what generation can get right on its own: why a design decision was made instead of the alternative, what a parameter is actually for beyond the type it happens to carry, and which edge cases a signature alone has no way of communicating. A generated doc answers “what” reliably; “why” still needs a separate log to capture it.
- **c. Preventing doc drift** — This is Topic 8d’s keeping-it-current discipline, given an actual mechanism instead of a good intention: wire regeneration into whatever already runs on every change — a pre-commit hook, a CI step — so the docs update because the pipeline ran, not because somebody remembered to.

**Prompt sketch: reference docs from the API layer**

*Run it against a real folder. Read what comes back, because grounded isn’t the same as correct.*

```
Generate reference documentation for the API layer in [path, e.g. src/api/], straight from the code.

For each endpoint list: the route and method, the parameters and their types, the response shape, and the errors it can return, taken from the actual signatures, types and route definitions.
Do not describe anything you cannot see in the code. Put anything that needs a human to explain why (design decisions, what a parameter is for) in a separate list called "Needs a design-log entry".
```

### Topic 37: Coding SOP generation (15 / 20 min)

> **Core idea:** A standard operating procedure is a debugging session or a recurring workflow written down once it’s been solved, so the second person who hits the same wall never has to solve it again from nothing.

- **a. Debugging session into procedure** — Take an actual finished debugging session and turn it into a written procedure someone else can follow without rediscovering each step under pressure.
- **b. Where the SOP lives** — An SOP that only lives in one person’s head, or in one closed chat transcript, isn’t actually shared. It belongs wherever the next person already looks — the same place a skill or a custom command already lives (Topic 14c).

**Prompt sketch: a debugging session into an SOP**

*Run it in the same session where the bug was solved, once the fix is verified.*

```
This debugging session is solved. Turn it into an SOP for the next person who hits the same problem.

Include: the symptom as it first appears, how to confirm it is this problem, the steps to isolate and fix it, how to verify the fix, and what looked like the cause but was not.
Write each step so someone could follow it without having seen this session.
```

### FAQs

**Q: The docs were generated straight from the code. How can they still be wrong?**

A: Generated isn’t the same as correct. Being grounded in today’s code stops drift, but the generator can only describe what is there. Someone still has to read what came out.

**Q: What belongs in a design log rather than in generated docs?**

A: Why a design decision was made instead of the alternative, what a parameter is actually for beyond the type it carries, and which edge cases a signature alone can’t communicate. A generated doc answers “what” reliably. “Why” needs a separate record.

**Q: We regenerate the docs before each release. Isn’t that enough to stop drift?**

A: Not by the chapter’s standard. The mechanism is wiring regeneration into something that already runs on every change, such as a pre-commit hook or a CI step, so the docs update because the pipeline ran and not because somebody remembered. It is Topic 8d’s keeping-it-current discipline, given a mechanism.

**Q: Our fix for a nasty bug is explained in a chat thread. Is that an SOP?**

A: No. An SOP is a solved problem written down as a procedure the next person can follow without rediscovering each step. A chat thread isn’t shared in that sense. It belongs wherever the next person already looks.

### Practice quiz

**Q1.** A team generates API reference from route definitions and signatures. A new developer asks why the retry limit is 3 and what happens at the limit. What can the generated docs reliably tell them?

- A. Which parameter exists and its type, but not why it is 3 or the reasoning behind the edge-case behaviour ✅
- B. Both answers, since they come from the code
- C. Only why it is 3
- D. Nothing about the parameter at all

*Explanation:* Answer A. A generated doc answers “what” reliably. “Why” and unusual edge cases need a design log.

**Q2.** Which setup best prevents documentation drift?

- A. A reminder in the sprint calendar
- B. A quarterly docs review
- C. Regeneration that runs in CI on every change ✅
- D. Asking developers to update docs when they remember

*Explanation:* Answer C. The docs should update because the pipeline ran, not because someone remembered.

**Q3.** A bug was solved on Tuesday. The only record is a chat transcript that one engineer can open. Next month someone else hits it. How should you describe the situation?

- A. No SOP exists yet: the knowledge isn’t shared until it is written as a procedure and stored where the next person looks ✅
- B. It is documentation
- C. An SOP exists
- D. It is a skill

*Explanation:* Answer A. An SOP in one person’s head or one closed transcript isn’t actually shared.

**Q4.** A generated reference doc matches the code exactly today. Is it safe to publish without reading it?

- A. Yes, because it is grounded in the code
- B. Yes, if CI passes
- C. No, because generated docs are always wrong
- D. No. Grounded isn’t the same as correct, and someone still has to read it ✅

*Explanation:* Answer D. Generation prevents silent drift. It doesn’t check that the output says the right thing.

**Q5.** What is the raw material for a coding SOP?

- A. A prediction of problems the team might hit
- B. A finished debugging session or a recurring workflow that has already been solved ✅
- C. The team’s list of coding conventions
- D. The generated API reference

*Explanation:* Answer B. An SOP is written down once the problem is solved, so the second person never starts from nothing.

---

## Chapter 5.2: Skills & starter kits

*Day 05 · Chapter 5.2 · ~20–25 min*

### Topic 38: Packaging an SOP as a Skill (10 / 15 min)

> **Core idea:** Topic 14 named this moment early — a skill is a prompt someone decided they’d need again, and an SOP is exactly that, the moment it’s been used more than once.

- **a. SOP steps into Skill instructions** — Take the written procedure from Topic 37a and turn its steps into skill instructions Claude Code can actually execute, not just prose a person reads and manually follows. The difference is real: a skill runs; documentation gets read, if someone remembers to open it.
- **b. Testing against a variant problem** — Verify the skill actually generalizes before trusting it: run it against a genuinely similar but not identical problem.

**Prompt sketch: SOP to skill instructions**

*Then test the skill on a similar but not identical problem before you trust it.*

```
Here is the SOP: [paste the SOP, or give its file path].

Turn it into a skill: a SKILL.md with a short description of when to use it, and the steps written as instructions you can execute, not prose for a person to read.
Where a step needs a decision from me, say so and stop there.
```

### Topic 39: Template repos & starter kits (10 min)

> **Core idea:** A starter kit is a CLAUDE.md, a permission set, and a project’s conventions bundled together at day zero, so a new project inherits a team’s hard-won decisions instead of rediscovering every one of them from scratch.

- **a. What a good starter kit bakes in** — Concretely: a CLAUDE.md already written for the stack, permissions already configured to the safe defaults from Topic 9, and the common slash commands a team actually reaches for already sitting there on day one, not invented fresh on every new repo.
- **b. Template vs. scratch** — The actual decision rule: a template earns its keep once its assumptions genuinely fit the new project; forcing one onto a project it wasn’t built for costs more time unpicking the mismatch than starting clean and copying over only the parts that actually transfer.
- **c. Keeping templates from going stale** — The same rot Topic 36c named for generated docs applies here at one remove: a template is a record of what good practice looked like on the day it was cut, and if nobody updates it, every new project quietly inherits yesterday’s decisions as if they were still today’s.

### FAQs

**Q: If the SOP is well written, why package it as a skill?**

A: Because a skill runs and documentation only gets read, if someone remembers to open it. Packaging turns the SOP’s steps into instructions Claude Code can execute, not prose a person follows by hand.

**Q: My new skill fixed the exact bug it was written from. Is it done?**

A: Not yet. Passing on the original problem proves very little. Run it against a genuinely similar but not identical problem to find out whether it generalizes.

**Q: When should a team template not be used?**

A: When its assumptions don’t fit the new project. Forcing it on costs more time unpicking the mismatch than starting clean and copying over only the parts that transfer.

**Q: Our template worked well last year. Why worry about it now?**

A: A template records what good practice looked like on the day it was cut. If nobody updates it, every new project quietly inherits yesterday’s decisions as if they were still today’s. It is the same rot Topic 36c named for generated docs, one step removed.

### Practice quiz

**Q1.** A written SOP has been used by three different people this month. What does the chapter suggest?

- A. Leave it as a document, since it is working
- B. Move it into CLAUDE.md
- C. Delete it once it has been used
- D. Package it as a skill, because a skill is a prompt someone decided they would need again ✅

*Explanation:* Answer D. An SOP is exactly that moment: it has been used more than once.

**Q2.** A new skill passes on the bug it was written from. Which result gives the most evidence that it generalizes?

- A. It passes the original bug ten times in a row
- B. A teammate reads it and agrees it looks clear
- C. It passes a different bug in the same area, with a different stack trace ✅
- D. It is added to the starter kit without errors

*Explanation:* Answer C. Repeating the original success shows repeatability. A similar but not identical problem shows generality.

**Q3.** The team template is built for a Django backend. Your new project is a mobile app. What is the better choice?

- A. Use the template and fix mismatches as they appear
- B. Start clean and copy over only the parts that transfer, such as permission defaults and commit conventions ✅
- C. Rewrite the app to fit the template
- D. Skip CLAUDE.md and permissions for this project

*Explanation:* Answer B. A template earns its keep only when its assumptions fit.

**Q4.** A template was cut eighteen months ago, when the team used a different test framework. A new project starts from it today. What best describes the situation?

- A. The project inherits a decision that is no longer true, and nobody chose it ✅
- B. Nothing wrong, since templates are stable
- C. The template stops working
- D. The project becomes more reliable because it is proven

*Explanation:* Answer A. A template nobody updates passes yesterday’s decisions on as today’s.

**Q5.** Which item belongs in a starter kit rather than being decided from scratch on every project?

- A. Last sprint’s open tickets
- B. A personal API key
- C. Permissions already set to safe defaults, with a CLAUDE.md for the stack and the common slash commands ✅
- D. A copy of the previous project’s source code

*Explanation:* Answer C. A new project inherits the team’s hard-won decisions on day zero.

---

## Chapter 5.3: Debugging & test generation

*Day 05 · Chapter 5.3 · ~35–45 min*

### Topic 40: Agent-assisted debugging (20 / 25 min)

> **Core idea:** Debugging with an agent follows the same five-step discipline a careful engineer already uses — reproduce, isolate, diagnose, fix, verify — what changes is who’s doing which step and how fast the loop runs.

- **a. What to hand over** — What’s actually worth handing to Claude Code: a full stack trace, exact reproduction steps, and what was expected to happen instead of what did. “It’s broken” is the unworkable version of that same handoff.
- **b. Try it: reproduce-isolate-diagnose-fix-verify** — Walk the five steps against a real bug in a project you’re working on, in order, rather than skimming the sequence in the abstract: reproduce it reliably first, isolate which layer it actually lives in, diagnose the real cause, fix only that, then verify the fix against the original reproduction steps — not just against the absence of an error.
- **c. Myth check: symptom fix vs. root cause** — If the error message is gone, is the bug fixed? No. A caught exception that gets silently swallowed removes the symptom without touching the cause, and the same failure resurfaces somewhere else later, harder to trace back to where it actually started. Verify against what the code was supposed to do — Topic 24’s acceptance-criteria standard — not against whether the red text went away.

**Prompt sketch: a bug handoff**

*Fill in every part. “It’s broken” is the unworkable version of this prompt.*

```
Bug: [one line describing the symptom]

Stack trace:
[paste the full stack trace]

Steps to reproduce:
1. [...]
2. [...]

Expected: [what should happen]
Actual: [what happens instead]

Reproduce it first, then find which layer it lives in. Do not change anything until you have told me the cause.
```

### Topic 41: Test generation (15 / 20 min)

> **Core idea:** Generated tests are only as good as the review they get — an agent can write a test for almost anything, including the wrong behavior, if that’s what the code currently happens to do.

- **a. Happy path vs. edge cases** — Ask for both explicitly. Left alone, a model generates the obvious happy-path case first and stops.
- **b. Myth check: reviewing test relevance** — If the generated tests pass, is the code covered? Not necessarily — a test is only as trustworthy as its assertion, and a test that passes while asserting nothing meaningful provides no real coverage at all.
- **c. Regenerating tests after a fix** — Once behavior changes, the old tests that asserted the old behavior need to be reviewed, not just re-run. A stale test can keep passing for the wrong reason after a fix lands, which quietly defeats the verify step Topic 40b just established.

**Prompt sketch: tests for the happy path and the edge cases**

*Step 1. Name the edge cases yourself. Left alone, the model stops at the happy path.*

```
Write tests for [function or module].

Cover the happy path, and these edge cases explicitly:
- [empty input]
- [boundary values]
- [invalid input]
- [repeated or conflicting calls]
```

**Prompt sketch: review the assertions for meaning**

*Step 2. Run it on the tests you just generated.*

```
Review the tests you just wrote. For each one, say what its assertion actually checks.
Flag any test that would still pass if the function were broken, and rewrite it so the assertion is meaningful.
```

### FAQs

**Q: I already know where the bug is. Why reproduce it first?**

A: Because the last step has to compare against the original reproduction. Without a reliable reproduction you can’t tell a fixed bug from one that just didn’t happen this time.

**Q: A try/catch made the error go away. Why isn’t that a fix?**

A: It removes the symptom without touching the cause. A caught exception that is silently swallowed lets the same failure resurface somewhere else later, harder to trace back to where it started. Verify against what the code was supposed to do, not against whether the red text went away.

**Q: The agent wrote twelve tests and they all pass. What should I check before I trust them?**

A: What each assertion actually checks. A test is only as trustworthy as its assertion, and one that passes while asserting nothing meaningful gives no real coverage. Also check that edge cases were asked for explicitly, because left alone the model writes the obvious happy-path case and stops.

**Q: I fixed the bug. Can I just re-run the old tests?**

A: Review them, don’t just re-run them. A stale test can keep passing for the wrong reason after behaviour changes, which quietly defeats the verify step from Topic 40b.

### Practice quiz

**Q1.** Which bug report gives Claude Code the best chance of a useful first attempt?

- A. A stack trace, exact reproduction steps, and what you expected to happen instead of what did ✅
- B. A stack trace and nothing else
- C. Reproduction steps only
- D. “It’s broken. Please fix it.”

*Explanation:* Answer A. “It’s broken” is the unworkable version of the same handoff.

**Q2.** You’ve reproduced a bug and found that it lives in the API layer, not the UI. Which step comes next?

- A. Fix it
- B. Isolate again, this time in the database
- C. Verify the fix
- D. Diagnose the real cause ✅

*Explanation:* Answer D. The order is reproduce, isolate, diagnose, fix, verify. Isolating found the layer. Diagnosis finds the cause.

**Q3.** A change wraps the failing call in a try/catch that logs and carries on, and the error disappears. What is the most accurate description?

- A. A root-cause fix
- B. The symptom is gone but the cause remains, and the failure may resurface somewhere harder to trace ✅
- C. A guardrail
- D. An acceptance criterion met

*Explanation:* Answer B. Verify against what the code was supposed to do, not against whether an error vanished.

**Q4.** You ask for tests for a discount function and get three passing tests that use ordinary inputs. What is the right next move?

- A. Accept them, since they pass
- B. Ask for more tests of the same kind
- C. Delete them and write them by hand
- D. Ask explicitly for edge cases such as zero, negative and boundary values, because left alone it stops at the happy path ✅

*Explanation:* Answer D. Ask for the happy path and the edge cases explicitly.

**Q5.** A fix has landed and an older test still passes. Which response is best?

- A. Nothing; passing is good
- B. Delete all the older tests
- C. Review whether it still asserts the right behaviour, because a stale test can pass for the wrong reason ✅
- D. Re-run the suite three times

*Explanation:* Answer C. After behaviour changes, old tests need to be reviewed, not just re-run.

---

## Chapter 5.4: Guardrails & team conventions

*Day 05 · Chapter 5.4 · ~15–25 min*

### Topic 42: Guardrails (5 / 10 min)

> **Core idea:** A guardrail is a check that runs whether anyone remembers to ask for it or not, which is what actually separates it from a habit that only holds up on the days someone happens to be careful.

- **a. Pre-commit checklist** — Turn Topic 35’s diff-reading and commit-message discipline into an actual checklist that runs before anything lands, not a standard everyone’s supposed to remember unassisted on a busy afternoon.
- **b. What always needs human eyes** — The short, specific list: anything security-sensitive, anything touching payments or data deletion, anything with a real-world consequence if it’s wrong. These don’t get automated away no matter how good the tooling gets, for the same reason Topic 5b gave them the same protection on day one.

**Prompt sketch: a pre-commit checklist**

*Automate what can be automated. The items that need a human stay as a prompt that must be confirmed.*

```
Create a pre-commit checklist for this repo, as [a git pre-commit hook / a script].

Automate these checks, and fail the commit with a clear message when one fails:
- no secrets, credentials or personal data in the diff
- tests pass
- the commit message says what changed and why
- changes to [security-sensitive, payments or data-deletion paths] are flagged for human review

Also print these two items and require a yes before the commit goes through:
- I have read the diff line by line
- the diff contains only changes that were asked for
```

### Topic 43: Shared team conventions (10 / 15 min)

> **Core idea:** Everything this course taught individually — a CLAUDE.md, a permission set, a skill, an SOP — only compounds across a whole team once it’s written down somewhere everyone actually reads, not remembered only by whoever built it first.

- **a. Per-repo vs. org-wide baseline** — Some conventions belong to one repo, some belong to the whole org, and knowing in advance which one wins beats discovering it mid-argument.
- **b. Where shared assets live** — Concretely: one shared skills-and-SOPs location the whole team actually points Claude Code at, not four different people’s separate collections that happen to overlap by accident.

### FAQs

**Q: What turns a good habit into a guardrail?**

A: A guardrail is a check that runs whether or not anyone remembers to ask for it. A habit only holds on the days someone happens to be careful. Turning the diff-reading and commit-message discipline from Topic 35 into a checklist that runs before anything lands is the move from one to the other.

**Q: Won’t better tooling eventually let us drop human review?**

A: Not for the short, specific list: anything security-sensitive, anything touching payments or data deletion, and anything with a real-world consequence if it is wrong. These don’t get automated away however good the tooling gets, for the same reason Topic 5b protected them on day one.

**Q: A repo convention and an org-wide one conflict. Which wins?**

A: Decide in advance and write it down. That beats discovering it mid-argument. For Claude Code settings specifically, organization-managed settings take precedence over project and personal ones.

**Q: Each of us keeps our own skills folder and it works fine for each of us. What is the cost?**

A: Individual assets only compound across a team once they live somewhere everyone reads. Separate collections that overlap by accident drift apart. Point everyone at one shared skills-and-SOPs location.

### Practice quiz

**Q1.** Which of these is a guardrail rather than a habit?

- A. The team agrees to read diffs carefully
- B. A pre-commit step that runs the checklist on every commit ✅
- C. A standing reminder at stand-up
- D. A senior developer who reviews when they have time

*Explanation:* Answer B. A guardrail runs whether or not anyone remembers to ask for it.

**Q2.** Which pull request must get human review even if every automated check passes?

- A. A migration that deletes customer records ✅
- B. A dependency patch bump with green CI
- C. A README typo fix
- D. Unit tests for a pure function

*Explanation:* Answer A. Data deletion, payments, security and real-world consequences always get human eyes.

**Q3.** The repo’s CLAUDE.md says tabs and the org baseline says spaces, and nobody knows which wins. What is the underlying failure?

- A. A technical limitation of Claude Code
- B. The repo file is too long
- C. Nobody decided in advance which level wins, or wrote it down ✅
- D. The org baseline was written first

*Explanation:* Answer C. Knowing in advance which one wins beats discovering it mid-argument.

**Q4.** One developer improved a skill that four people use. Which setup gets that improvement to everyone?

- A. One shared skills-and-SOPs location the whole team points Claude Code at ✅
- B. Each person keeps a copy and shares changes in chat
- C. A wiki page listing everyone’s skills
- D. A yearly merge of everyone’s folders

*Explanation:* Answer A. Separate collections drift apart. One shared location lets assets compound.

---

## Day 5 recap & takeaways

*Day 05 · Recap · Wrap-up*

The points worth carrying out of the room today, followed by the checkpoint.

### Key takeaways

1. Generate reference docs from the code and wire regeneration into the pipeline. Generated docs answer “what”; “why” needs a design log, and someone still reads what came out.
2. Turn a solved debugging session into an SOP, and keep it where the next person already looks.
3. An SOP used more than once becomes a skill. A skill runs; a document only gets read. Test it on a variant problem before trusting it.
4. A starter kit carries a CLAUDE.md, permissions and commands into day zero. Use it when its assumptions fit, and keep it current.
5. Debug in order: reproduce, isolate, diagnose, fix, verify. Verify against expected behavior, not the absence of an error.
6. Generated tests are only as good as their assertions. Ask for edge cases explicitly and review tests after a fix.
7. Guardrails run whether or not anyone remembers. Security, payments, data deletion and real-world consequences always get human eyes.
8. Team conventions compound only once they are written down somewhere everyone reads, with a known rule for which level wins.

### Checkpoint

**Course complete**

By the end of this course, you should be able to:

- [ ] Generate reference docs directly from code, and name at least one thing a human still has to check by hand
- [ ] Apply the “used more than once” test to decide whether a debugging session is worth turning into an SOP
- [ ] Package a written SOP as a skill, and test it against a problem that isn’t the exact original bug
- [ ] Decide whether a new project should start from a template or from scratch, and explain why
- [ ] Run the reproduce-isolate-diagnose-fix-verify loop on a real bug, and verify against expected behavior, not just the absence of an error
- [ ] Review a generated test for whether its assertion is actually meaningful, not just whether it passes
- [ ] Name what always needs human eyes on an AI-generated diff, and who owns that review
- [ ] Point to where the team’s shared skills, SOPs, and conventions actually live, and name who owns keeping them current

*Anyone who can’t check one of these off yet knows exactly which topic to revisit.*

*[← Day 4: Codebase recon, prompt precision & MCP tooling](Claude_Code_Upskilling_Day4.html)*
