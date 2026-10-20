# Day 2: Workflow features, ADLC & writing specs

*Claude Code Upskilling — Day 2 of 5*

## Overview

*Day 02 · Workflow, ADLC & Specs · ~110–130 min*

Nine concepts, roughly two hours at pace. This is where the individual habits from Chapter 1 turn into an actual workflow — plan before you act, manage context on purpose, and turn a vague request into a spec precise enough to build from.

### Today’s chapters

- **2.1. Plan Mode** (~20–25 min) — Topic 11: Plan Mode: ask-before-acting
- **2.2. Context management** (~10 min) — Topic 12: Context management
- **2.3. Subagents, Skills & reasoning effort** (~30–35 min) — Topics 13–15: Subagents (explanation only), Skills: packaging a repeatable workflow, Extended thinking / reasoning effort
- **2.4. ADLC & turning a problem into a spec** (~40–45 min) — Topics 16–18: ADLC: the AI-native dev lifecycle, Problem statement to spec, Interrogating a vague idea
- **2.5. The SPEC framework** (~10–15 min) — Topic 19: SPEC framework
- **Recap & takeaways** (Wrap-up) — Key takeaways and the day’s checkpoint.

*Each chapter ends with FAQs and a short practice quiz. Topic numbers run 1–43 across the five days, so a cross-reference such as “Topic 12” may point to another day’s playbook. Where the text says “Chapter 1” to “Chapter 5”, it means Day 1 to Day 5.*

### The topics

- **11. Plan Mode: ask-before-acting** (20 / 25 min) — Pausing the act step so a plan gets reviewed before any code exists.
- **12. Context management** (10 min) — What actually happens when `/compact` runs, and what you lose when it does.
- **13. Subagents (explanation only)** (10 min) — A delegated subtask with its own context window, reporting back when it’s done.
- **14. Skills: packaging a repeatable workflow** (10 / 15 min) — The exact moment a one-off prompt is worth saving as a skill.
- **15. Extended thinking / reasoning effort** (10 min) — Turning up reasoning effort when a task is visibly too complex to rush.
- **16. ADLC: the AI-native dev lifecycle** (10 min) — The developer’s job shifts from writing code to architecting and checking it.
- **17. Problem statement to spec** (20 min) — The difference between a well-defined spec and a vague request in disguise.
- **18. Interrogating a vague idea** (10 / 15 min) — Questions come before a plan — mapping the idea’s boundaries first.
- **19. SPEC framework** (10 / 15 min) — Scope, Problem, Examples, Constraints — in a fixed order, every time.

---

## Chapter 2.1: Plan Mode

*Day 02 · Chapter 2.1 · ~20–25 min*

### Topic 11: Plan Mode: ask-before-acting (20 / 25 min)

> **Core idea:** Any generated output is like a vector with a magnitude and a direction. Plan Mode helps fix the direction.

- **a. What it yields: a written plan** — With Plan Mode on, Claude Code reads and reasons exactly as before, but holds back the act step and hands you a written plan first. The plan lays out the steps in order, the files it expects to create or change, the approach it has chosen and, where more than one is plausible, the alternatives it weighed, plus anything it is unsure about. Run the sketch below with Plan Mode off, then on: the work is the same, but with it on you see the plan before any file changes.
- **b. Validating a plan in your head** — Reading a plan isn’t a sign-off ritual. It is the review most people skip on their own commits, moved to before the code exists. Hold the plan up against what you already know and ask four things. *Scope:* does every step trace back to what you asked, or does it touch files it doesn’t need to? *Approach:* does it commit to a design, table or library nobody chose, the kind of decision Topic 1’s cold-open habit would have walked straight past? *Fit:* does it follow the conventions in CLAUDE.md and reuse what the codebase already has? *Gaps:* is anything missing, such as a test, an edge case, or a step that has to happen before another?
- **c. Editing the plan** — When a plan fails one of those checks, change it in place instead of starting over. Say in plain words what to trim, swap or add: “drop the `package.json` change”, “use the existing table instead of a new one”, “add a test for the empty-shift case”. The steps that passed stay as they are. Reject the whole plan only when the approach itself is wrong at the root, and then say why in your next prompt rather than rewriting it from nothing. Re-read the revised plan before you approve it, because one edit can change the steps around it.

**Prompt sketch: one request, Plan Mode off then on**

*Run this identical prompt twice, once with Plan Mode off and once with it on, and note where the act step pauses.*

```
Implement [a moderately sized feature from the BRD, e.g. "approving a leave request should be blocked when it would leave a shift below its minimum headcount"].

Follow the conventions in CLAUDE.md and keep the change as small as possible.
```

### FAQs

**Q: If Plan Mode doesn’t change how the model reasons, what does it actually buy me?**

A: Timing. Reading and reasoning are exactly as before. The act step pauses, so the review most people skip on their own commits happens before any code exists, while a wrong direction is still cheap to change.

**Q: The plan has five steps and looks sensible. Is a quick skim enough?**

A: Not if you only skim for “looks sensible”. Four questions are worth asking of every plan: does it touch files it doesn’t need to, does it commit to an approach you would otherwise have walked straight past, does it follow your conventions, and is anything missing?

**Q: Rejecting the plan and re-prompting is only one sentence of effort. Why is editing a step better?**

A: A plan isn’t binary. Trimming or redirecting a step in place keeps everything in the plan that was already right. Rejecting it and restarting from nothing throws all of that away, including the parts you had no problem with.

**Q: A teammate turns Plan Mode on for every change, including renaming a variable. What does it cost them?**

A: Time, for nothing. A trivial or mechanical change has no ambiguity left to resolve, so a plan review has nothing to catch. Topic 19 makes the same point about SPEC: match the process to how much ambiguity is actually there.

### Practice quiz

**Q1.** You run the identical feature prompt with Plan Mode off, then on. What difference should you expect?

- A. The model reasons differently and reads fewer files
- B. The second run can no longer run any command, even after approval
- C. The second run uses a more capable model automatically
- D. The act step pauses for review; reading and reasoning are unchanged ✅

*Explanation:* Answer D. Plan Mode changes when the model acts, not how it thinks. The pause before acting is the whole feature.

**Q2.** A plan for a one-file UI change also edits `package.json` and a CI config file. What is the most useful reading of that?

- A. It shows the plan is thorough
- B. It touches files it doesn’t need to, which is the scope question to ask of every plan ✅
- C. It’s normal; plans always include configuration
- D. It is a reason to switch Plan Mode off

*Explanation:* Answer B. Unneeded file changes are exactly what a plan review exists to catch, before any of the edits happen.

**Q3.** A plan commits to a new database table nobody discussed, and every other step is fine. What is the cheapest correct response?

- A. Redirect that one step in place to use the existing table, and keep the rest ✅
- B. Reject the plan and rewrite the prompt from scratch
- C. Switch Plan Mode off so it stops planning
- D. Approve it and refactor later

*Explanation:* Answer A. A step can be edited in place. That keeps the parts that were right instead of restarting from nothing.

**Q4.** Where does Plan Mode earn the most for its cost?

- A. A mechanical rename across several files
- B. Fixing a typo in a comment
- C. A moderately sized feature where more than one approach is plausible ✅
- D. Re-running an existing test suite

*Explanation:* Answer C. It pays off where there is real ambiguity to resolve. A trivial or mechanical change leaves a plan review nothing to catch.

**Q5.** The chapter says reading a plan “isn’t a sign-off ritual”. What is it?

- A. A formality that confirms the plan matches the prompt
- B. A replacement for any later review of the result
- C. The review most people skip on their own commits, moved to before the code exists ✅
- D. Only needed once a plan passes ten steps

*Explanation:* Answer C. The review is the same one most people skip, moved earlier to where a wrong direction is cheap to fix.

---

## Chapter 2.2: Context management

*Day 02 · Chapter 2.2 · ~10 min*

### Topic 12: Context management (10 / 10 min)

> **Core idea:** The context window works like RAM — when it fills up, response quality drops.

**What happens**

- Claude Code summarizes the conversation history to fit the context window, and `/compact` replaces the conversation with a structured summary — only the summary and a small metadata trailer come back. ([source](https://code.claude.com/docs/en/context-window))
- Rule of thumb: auto-compaction kicks in when the window is nearly full.

**What survives**

- Most startup content reloads automatically: CLAUDE.md files, a fresh git status snapshot, and matching SessionStart hooks. ([source](https://code.claude.com/docs/en/context-window))
- Path-scoped rules and nested CLAUDE.md files reload as Claude touches matching files.
- Claude Code re-reads up to five files it had read or edited, most recently modified first. ([source](https://code.claude.com/docs/en/context-window))
- Context that hooks injected earlier gets summarized along with everything else.

**What you lose**

- It’s lossy: exact code, precise numbers, and earlier instructions may be simplified or dropped. Exact error messages get paraphrased, and early decisions lose their reasoning. ([source](https://unmarkdown.com/blog/claude-compacting-explained))
- The cache also resets, so the first turn after a compact costs more.

**What `/clear` keeps that a fresh session loses**

- Same process, same environment. Your working directory, permission grants you’ve approved this session, MCP server connections, and any model/config choices you set stay put. A new session means re-approving tools and re-initializing MCP servers (which can be slow if you have several).
- No restart friction. You don’t have to quit, `cd` back, and relaunch. Mid-flow, that’s a few seconds vs. a context switch.
- Same shell state. Env vars and the like in the running session persist.

**Coming back later: `--continue` and `--resume`**

- Claude Code saves every conversation locally. `claude --continue` reopens the most recent one in the current folder, `claude --resume` lets you choose from a list, and `/resume` does the same from inside a running session. ([source](https://code.claude.com/docs/en/common-workflows#resume-previous-conversations)) This is how a task carries over to the next day without re-explaining it.
- Resuming restores the earlier conversation, so everything above about a filling window applies to a resumed session too. Coming back to a long thread, run `/compact focus on <what you are doing next>` before you carry on.
- `/clear` is the opposite move: start with nothing from the old conversation. Pick it when the next task is unrelated. Pick `--continue` or `--resume` when it is the same task.
- If you ran `/clear` by mistake and haven’t quit Claude Code yet, open `/rewind`. The top entry, `/resume <session-id> (previous session)`, brings back the conversation that was active before the clear. ([source](https://code.claude.com/docs/en/checkpointing#rewind-past-a-cleared-conversation))
- Checkpoints are saved with the conversation, so `/rewind` still works after you resume. ([source](https://code.claude.com/docs/en/checkpointing))

**Practical moves**

- Put durable rules in CLAUDE.md, not in chat. One source claims a “Compact Instructions” section there controls what compaction preserves — worth testing rather than assuming, since it isn’t confirmed in Anthropic’s official documentation.
- Steer it directly: `/compact focus on the auth bug fix` before starting a long task.
- To compact only part of a session, use `/rewind`, pick a message, and choose “Summarize from here” or “Summarize up to here.”
- Compact manually at natural breakpoints — after a task lands — rather than letting auto-compact hit mid-task.

### FAQs

**Q: I ran `/clear` to start a new task and regretted it immediately. Is the old conversation gone?**

A: Not if Claude Code is still running. Open `/rewind`: the top entry, `/resume <session-id> (previous session)`, brings back the conversation that was active before the clear. It is available until you quit Claude Code or resume a different session.

**Q: It’s Tuesday and I want to carry on with yesterday’s refactor. `/clear`, `/compact` or `--continue`?**

A: `--continue`, or `--resume` to pick from a list. They reopen the saved conversation for the same task. `/clear` starts with nothing and is for unrelated work, and `/compact` works inside a conversation that is already open. If the resumed thread is long, run `/compact focus on <what you are doing next>` once you are back.

**Q: After a compaction, which do I trust more: a rule in CLAUDE.md, or one I typed in chat 40 minutes ago?**

A: The CLAUDE.md rule. CLAUDE.md files reload automatically after compaction. A rule that only lived in chat is summarized with everything else and may be simplified or dropped.

**Q: Why does `/clear` keep my permission grants and MCP connections when a brand-new session wouldn’t?**

A: `/clear` stays in the same process, so the working directory, permission grants you approved this session, MCP server connections and any model or config choices stay put. A new session means re-approving tools and re-initializing the MCP servers, which can be slow if you have several.

**Q: The first two hours of my session were unrelated debugging, and I only need the last task. Must I compact everything?**

A: No. Open `/rewind`, pick the message where the last task begins and choose “Summarize up to here”. That compresses everything before that point and keeps the later messages intact.

### Practice quiz

**Q1.** You resume yesterday’s very long conversation with `claude --continue`. What is the best move before carrying on?

- A. Run `/compact` with a focus on what you are doing next ✅
- B. Nothing, because resuming resets the window
- C. Run `/clear`, since it is still the same task
- D. Quit and start a brand-new session

*Explanation:* Answer A. Resuming restores the earlier conversation, so a filling window still applies. `/clear` would throw away the thread you just resumed.

**Q2.** You ran `/clear` by mistake and Claude Code is still open. How do you get the conversation back?

- A. You can’t; `/clear` is permanent
- B. Restart Claude Code with a `--clear` flag
- C. Run `/compact`
- D. Open `/rewind` and pick the `/resume <session-id> (previous session)` entry at the top ✅

*Explanation:* Answer D. While Claude Code stays open, the rewind menu offers the pre-clear conversation as its top entry.

**Q3.** What is true of CLAUDE.md and chat instructions after a `/compact`?

- A. CLAUDE.md is summarized and may be simplified
- B. CLAUDE.md reloads automatically; a rule that only lived in chat is summarized and may be dropped ✅
- C. Neither survives, so CLAUDE.md must be pasted again
- D. Both are kept word for word

*Explanation:* Answer B. That is why durable rules belong in CLAUDE.md and not in the conversation.

**Q4.** You need only the last task’s part of a long conversation compressed, and the earlier messages should stay as they are. Which action fits?

- A. Turn auto-compact off
- B. `/compact` on the whole session
- C. `/clear`, then re-paste the task
- D. `/rewind`, pick the message where the task starts, then a “Summarize” option ✅

*Explanation:* Answer D. `/rewind` can summarize part of a session. The “Summarize from here” and “Summarize up to here” options compress one side of the message you pick.

**Q5.** When is `/clear` a better choice than starting a brand-new session, mid-flow?

- A. You want the conversation summary to come with you
- B. You want to keep the working directory, approved permissions and MCP connections without restarting ✅
- C. You want permissions reset for safety
- D. You want the first turn afterwards to cost less

*Explanation:* Answer B. `/clear` stays in the same process, so those things persist. A new session means re-approving and re-initializing.

**Q6.** Which of these is most likely to come through a compaction unchanged?

- A. A rule written in CLAUDE.md ✅
- B. The reasoning behind an early design decision
- C. A precise number mentioned once in chat
- D. An exact error message you pasted in chat

*Explanation:* Answer A. Compaction is lossy for what lived only in the conversation. CLAUDE.md reloads automatically.

---

## Chapter 2.3: Subagents, Skills & reasoning effort

*Day 02 · Chapter 2.3 · ~30–35 min*

### Topic 13: Subagents (explanation only) (10 / 10 min)

> **Core idea:** A subagent is a delegated subtask with a separate context window, doing one job and reporting back.

- **a. What & why: task isolation** — A subagent spins up with its own context, does its work, and returns a result — none of the files it read to get there clutter the main conversation.
- **b. Common use cases** — **Research & review:** one subagent researches an unfamiliar part of the codebase, while a second, separate subagent reviews a change the first one just made — so the review isn’t happening in the same context that wrote the change.

**Prompt sketch: research with one subagent**

*Step 1. The subagent does the reading in its own context and reports back only what you asked for.*

```
Use a subagent to research [the unfamiliar part of the codebase, e.g. how leave balances are calculated].
It should read whatever it needs and report back only:
- where the logic lives (file and function names)
- how data flows through it
- anything that looks fragile

Do not make any changes.
```

**Prompt sketch: review with a second subagent**

*Step 2. The reviewer sees the diff and the goal, not the reasoning that produced the change.*

```
Now make this change: [the change you want in that area].

When it is done, use a separate subagent to review it. Give that subagent only the diff and the goal below, not the reasoning behind the change. It should report:
- anything the change breaks
- anything it touches that it did not need to
- anything the goal asks for that is missing

Goal: [one sentence describing what the change is meant to achieve]
```

### Topic 14: Skills: packaging a repeatable workflow (10 / 15 min)

> **Core idea:** A skill is a reusable prompt.

- **a. When a workflow graduates** — A workflow graduates into a skill the moment it starts feeling repetitive to the one person using it, or when someone other than its author would benefit from it.
- **b. Creating a skill** — A skill is a folder containing one required file, `SKILL.md`. The file has two parts: a short header between `---` lines with a `description` (what the skill does and when to use it) and an optional `name`, then the instructions Claude Code follows when the skill runs. The folder name becomes the command you type, so `pr-summary/` gives you `/pr-summary`. The folder can also hold supporting files, such as examples or scripts. ([source](https://code.claude.com/docs/en/skills))
- **c. Where it lives, and who gets it** — Where the folder sits decides who can use it. `~/.claude/skills/<name>/SKILL.md` is personal: available in all your projects on your machine. `.claude/skills/<name>/SKILL.md` inside a repository is a project skill: commit it, and everyone who pulls the repo has it. A skill can also ship inside a plugin, which is how it travels between repositories. A skill that only lives in one person’s personal folder isn’t shared, however good it is. ([source](https://code.claude.com/docs/en/skills))
- **d. How it gets used** — Type `/skill-name` yourself, or let Claude Code load it automatically when your request matches the skill’s `description`, which makes the description the most important line in the file. Set `disable-model-invocation: true` in the header if the skill should only ever run when you call it. A file in `.claude/commands/` (Topic 10) still works the same way. A skill adds a folder for supporting files and automatic loading. ([source](https://code.claude.com/docs/en/skills))

**Prompt sketch: a starter SKILL.md**

*Save this as.claude/skills/pr-summary/SKILL.md in the repo and commit it. Then type /pr-summary, or ask for a pull request summary and Claude Code can load it on its own.*

```
---
name: pr-summary
description: Summarizes the changes on the current branch as a pull request description. Use when the user asks for a PR summary or description.
---
Summarize the changes on this branch, compared with main, as a pull request description.

1. What changed, in two or three bullets.
2. Why it changed, in one sentence.
3. What a reviewer should look at first.

Only describe what you can see in the diff. If something looks unrelated to the stated goal, list it separately at the end.
```

### Topic 15: Extended thinking / reasoning effort (10 / 10 min)

> **Core idea:** LLMs cut corners wherever possible — thinking reduces the chances of that happening.

- **a. Effect of higher reasoning effort** — Run the same prompt at two effort levels side by side to see the difference in the actual output, not a claim about it. A genuine architectural question visibly gets a more considered answer at higher effort — that’s observable, not theoretical.
- **b. When it’s worth the cost** — There’s no fixed threshold, so expect some trial and error. The clearest signal is noticing the model breeze through a genuinely complex task without showing any of the reasoning behind its choices — that’s usually the moment to turn the effort up.

**Prompt sketch: one question, two effort levels**

*Run the same prompt at a low and then a high reasoning effort, and compare the two answers side by side.*

```
We need to decide [a real architectural question from the BRD, e.g. how to enforce minimum shift coverage when leave is approved].

Compare two realistic approaches, [approach A] and [approach B], on complexity, failure modes and how hard each is to change later.
Recommend one, and say what would make you change your mind.
```

### FAQs

**Q: A subagent read 40 files to answer my question. Where did those files go?**

A: They stayed in the subagent’s own context window. Only the result comes back, so none of the files it read to get there clutter the main conversation.

**Q: Our reviewer subagent keeps agreeing with the author. What might be wrong?**

A: Check what it was given. A second subagent only helps if the review doesn’t happen in the same context that wrote the change. If it receives the author’s reasoning along with the diff, it inherits the author’s assumptions. Hand it only the diff and the goal.

**Q: I’ve pasted the same release-notes prompt every week for a month. Should it be a skill?**

A: Yes. A workflow graduates into a skill the moment it starts feeling repetitive to the one person using it, or when someone other than its author would benefit. Either condition is enough. There is no minimum number of uses.

**Q: The model answered a hard architecture question in two confident lines with no reasoning shown. Is that a good answer?**

A: Treat it as a signal, not a verdict. Breezing through a genuinely complex task without showing any reasoning behind its choices is the clearest sign that it’s time to raise the reasoning effort.

**Q: How do I know whether higher reasoning effort is worth it for my task?**

A: Run the same prompt at two effort levels and compare the answers side by side. A genuine architectural question visibly gets a more considered answer at higher effort. There’s no fixed threshold, so expect some trial and error, and remember that higher effort has a cost.

**Q: I wrote a skill and it works well for me. Why doesn’t my teammate have it?**

A: Probably because it lives in your personal skills folder, which is available only in your projects on your machine. Put it in `.claude/skills/<name>/SKILL.md` inside the repository and commit it, and everyone who pulls the repo gets it.

### Practice quiz

**Q1.** A subagent explores the billing module and returns a short summary. What has that done for your main conversation?

- A. Made the exploration free of cost
- B. Given the main conversation permission to edit billing
- C. Kept the many files it read out of the main context ✅
- D. Saved the summary for the next session

*Explanation:* Answer C. A subagent has its own context window. It does the work and returns a result, so the reading stays out of your main thread.

**Q2.** You want a change reviewed by a subagent. What should the reviewer receive?

- A. The whole conversation that produced the change
- B. The author’s reasoning, so it understands the choices
- C. Only the diff and the goal ✅
- D. Only the goal, with no diff

*Explanation:* Answer C. The reviewer should see the change and what it is meant to achieve, not the reasoning that produced it, or it inherits the author’s assumptions.

**Q3.** A teammate says, “I make a skill after I’ve used a prompt ten times.” What does the chapter say?

- A. There is no count: it graduates when it feels repetitive to its user or when someone else would benefit ✅
- B. Skills are for team leads only
- C. Ten uses is the threshold
- D. A skill is warranted only for prompts longer than five lines

*Explanation:* Answer A. Either condition is enough: repetition for the one person, or usefulness to a second person.

**Q4.** Which job is best handled by a subagent, rather than a skill or a slash command?

- A. Writing release notes every Friday
- B. Applying the team’s commit-message format
- C. Running the pre-PR checklist before each pull request
- D. Exploring an unfamiliar module without filling the main conversation with every file it opens ✅

*Explanation:* Answer D. A subagent is defined by isolation and its own context window. The other three are about reuse or speed.

**Q5.** You ask whether to use polling or WebSockets and get a two-line, confident answer with no reasoning. What is the best response?

- A. Accept it; a short answer signals confidence
- B. Treat the unexplained answer as the signal to raise reasoning effort, and ask again ✅
- C. Switch to a smaller model
- D. Compact the session and re-ask

*Explanation:* Answer B. An unexplained, too-easy answer to a hard question is the tell that the effort should go up.

**Q6.** A teammate wants the `pr-summary` skill you wrote. It is in `~/.claude/skills/pr-summary/` on your machine. What is the simplest way to give it to the whole team?

- A. Send the file in chat each time it changes
- B. Move it to `.claude/skills/pr-summary/SKILL.md` in the repository and commit it ✅
- C. Rename the folder so it works for everyone
- D. Add its text to CLAUDE.md

*Explanation:* Answer B. A project skill sits in `.claude/skills/` inside the repo, so everyone who pulls the repository has it. A personal skill is available only on your own machine.

---

## Chapter 2.4: ADLC & turning a problem into a spec

*Day 02 · Chapter 2.4 · ~40–45 min*

### Topic 16: ADLC: the AI-native dev lifecycle (10 / 10 min)

> **Core idea:** The developer is transitioning into an architect and a QC.

- **a. Govern, don’t execute** — The developer’s work moves from typing the code to deciding what gets built before Claude Code starts, and checking what comes back. That is the architect and QC split. Every phase below has a point where a human decides, and those points are the checkpoints.
- **b. A lifecycle, not a single prompt** — The same posture applies at every scale. Day 4 shrinks it to one prompt: ask, read the output critically, fix the specific thing that is wrong. This topic is the whole-project version.
- **c. Where the phases come from** — ADLC isn’t one formal standard, and the same acronym is also used for building AI agents as products. For using AI to build software, the published frameworks agree on the pattern even where they differ on names and count. AWS’s AI-DLC has three phases (Inception, Construction, Operations), and other write-ups split the same ground into six. Three ideas run through all of them: the AI proposes and a human approves, every phase ends in a human gate, and the cycle loops back to the start. The six phases below are this course’s version of that shared pattern. ([source](https://dreamix.eu/insights/from-sdlc-to-adlc-ai-led-software-development/)) ([source](https://cycode.com/blog/agentic-development-lifecycle-adlc/)) ([source](https://aws.amazon.com/blogs/devops/building-with-ai-dlc-using-amazon-q-developer))

**The six phases**

- **1. Intent & spec** — Turn a business request into something precise: scope, problem, examples, constraints, and the guardrails Claude Code must work within. Claude Code asks clarifying questions and drafts. You decide what is in and out. *Checkpoint:* the spec and guardrails are approved before any design starts (Topics 17–19, with CLAUDE.md and permissions in Topics 8–9).
- **2. Design** — Decide the shape of the solution: high-level and low-level design, data model, API. Claude Code proposes options and you choose, with the reason each rejected option lost written down. *Checkpoint:* the design and the decision record are signed off before any code is written (Topics 20–23 and 26).
- **3. Build** — Claude Code implements in small, bounded tasks against written acceptance criteria. You review each plan in Plan Mode, control what is in context, and keep every task small. *Checkpoint:* each task is reviewed before the next one starts (Topics 11, 12, 24, 25 and 27).
- **4. Verify** — The QC phase. Claude Code can write and run tests, but you check what automation misses: whether a test asserts the right thing, the edge cases, and each acceptance criterion against the real output. Read the diff the way you would review a junior engineer’s pull request. *Checkpoint:* nothing moves on because the model reported it was done (Topics 5 and 24, and Day 5).
- **5. Release** — Merge and ship. Claude Code can prepare the pull request, release notes and documentation, and a person approves the merge. *Checkpoint:* a human approves the merge and the decision is on record (the pre-PR checklist in Topic 10, and Day 5).
- **6. Operate & improve** — Watch what happens after release and feed it back: update CLAUDE.md, turn repeated work into skills, write procedures down. *Checkpoint:* something durable is written down, and it shapes the next round of phase 1 (Topics 8 and 14, and Day 5).

This course works hands-on through phases 1 to 4, and reaches phases 5 and 6 mainly on Day 5. When you name a checkpoint from your own project, it belongs to one phase. Ask which decision a human made at that point.

### Topic 17: Problem statement to spec (20 / 20 min)

> **Core idea:** A spec is a problem statement that’s well defined — not vague or open to interpretation.

- **a. What to do** — State the floor plainly: what’s in scope, what’s explicitly out, at least one worked example, and whichever constraints aren’t negotiable.
- **b. What not to do** — Give concrete tells rather than “you’ll know it when you see it”: no stated constraint, no example of correct output, a scope boundary that’s implied but never actually written down.

### Topic 18: Interrogating a vague idea (10 / 15 min)

> **Core idea:** A vague idea doesn’t need a plan first — it needs questions first, to map its boundaries to something finite, before breaking down the problem statement.

- **a. Surfacing unstated assumptions** — Writing a vague line to an LLM and hoping it fills in the rest is the same shortcut Topic 1 already named as costly. Before sending anything, name the assumptions being made silently — about the data, the users, the edge cases — instead of leaving them for the model to guess.
- **b. Clarifying questions before code** — Model two or three questions worth having Claude Code ask back before it proceeds, instead of letting it move forward on a guess it was never given permission to make.

**Prompt sketch: clarifying questions before code**

*Use it when the idea is still one vague line.*

```
I want to [rough idea in one line, e.g. "let people swap shifts"].

Before you write any code or propose a design, ask me the clarifying questions you need answered.
Ask no more than [5], most important first. For each one, say what you would otherwise have to assume.
Then wait for my answers.
```

### FAQs

**Q: If I’m becoming an architect and a QC, should I stop reading the code the model writes?**

A: No, the shift is the opposite. The job moves from writing code to architecting it and checking it. Designing what gets built and checking what comes back are the work, so review carries more weight, not less.

**Q: My “spec” has a clear scope and a list of constraints but no example of correct output. Is it a spec yet?**

A: Not yet. No example of correct output is one of the three concrete tells of a vague request in disguise, alongside no stated constraint and a scope boundary that is implied but never written down. Add an example of input and expected output.

**Q: The request is one line: “let people swap shifts”. Should I ask for a plan, or for questions?**

A: Questions first. A vague idea needs questions to map its boundaries to something finite before the problem statement is broken down. Ask Claude Code for the clarifying questions it needs, most important first, and have it say what it would otherwise assume.

**Q: Why name my assumptions before sending a prompt? Won’t the model work them out?**

A: It will guess, and you won’t know which guesses it made. Naming the assumptions you are making silently, about the data, the users and the edge cases, takes them out of the model’s hands. It is the same shortcut Topic 1 named as costly.

**Q: How do I tell which ADLC phase one of my own checkpoints belongs to?**

A: Ask which decision a human made at that point. Approving a spec is Intent & spec. Approving a design and its decision record is Design. Approving a plan or a task is Build. Reviewing the diff and the tests is Verify. Approving the merge is Release. Writing something down for next time is Operate & improve.

### Practice quiz

**Q1.** A spec has in-scope and out-of-scope lists and a set of non-negotiable constraints, but no example of correct output. What is the right call?

- A. It is complete; examples are optional
- B. Add more constraints
- C. Replace the scope with a longer description
- D. It is still a vague request in disguise until it has an example of correct output ✅

*Explanation:* Answer D. No example of correct output is one of the three tells, however well the rest is written.

**Q2.** What is the strongest reason to have Claude Code ask clarifying questions before it proceeds?

- A. It slows the model down
- B. So it doesn’t move forward on a guess it was never given permission to make ✅
- C. Questions reduce token use
- D. It cannot write code without them

*Explanation:* Answer B. Two or three questions asked back are better than a guess that quietly becomes the design.

**Q3.** You must brief Claude Code on “let people swap shifts”. Which opening follows the chapter?

- A. The assumptions you’ve named about data, users and edge cases, and a request for clarifying questions ✅
- B. A tech stack choice
- C. A quick prototype
- D. A detailed multi-step plan

*Explanation:* Answer A. A vague idea needs questions first, and unstated assumptions should be named instead of left for the model to guess.

**Q4.** Which of these is NOT one of the concrete tells that a “spec” is still a vague request?

- A. No stated constraint
- B. No example of correct output
- C. It runs longer than a page ✅
- D. A scope boundary that is implied but never written down

*Explanation:* Answer C. Length isn’t a tell. The three tells are no constraint, no example, and an unwritten scope boundary.

**Q5.** A colleague says, “The model writes the code, so my job is just to approve it.” How does the chapter frame the developer’s role?

- A. Correct, approval is the whole job
- B. The developer should write more of the code by hand
- C. The developer is becoming an architect and a QC: designing what gets built and checking what comes back ✅
- D. The developer becomes a project manager

*Explanation:* Answer C. The job shifts from writing code to architecting and checking it.

**Q6.** Before any code is written, you sign off a high-level design and a decision record explaining why the rejected option lost. Which ADLC phase is that checkpoint in?

- A. Intent & spec
- B. Design ✅
- C. Verify
- D. Release

*Explanation:* Answer B. Design ends with the design and the decision record approved before any code is written. Intent & spec ends with an approved spec, Verify is the review of what was built, and Release is the merge decision.

---

## Chapter 2.5: The SPEC framework

*Day 02 · Chapter 2.5 · ~10–15 min*

### Topic 19: SPEC framework (10 / 15 min)

> **Core idea:** SPEC gives the four questions a spec has to answer a fixed order — Scope, Problem, Examples, Constraints — so nobody has to reconstruct the list from memory every time.

- **a. Scope: what’s out** — Start with what’s excluded, not what’s included. An explicit boundary is worth more than an implicit one, because it’s the thing that actually stops a build from wandering.
- **b. Problem: the actual pain** — State the real problem being solved, not the feature being requested — the two aren’t always the same thing, and confusing them is how a spec ends up solving the wrong problem correctly.
- **c. Examples: input/output pair** — One concrete example of the input and the expected output does more disambiguating work than another paragraph of description ever will.
- **d. Constraints: stack, time, non-negotiables** — Name what isn’t up for debate: which stack, how much time, what absolutely cannot change. Everything else is a decision Claude Code can help make — these aren’t.

**Prompt sketch: a SPEC skeleton**

*Fill in all four parts before handing it to Claude Code. A part you leave blank is a decision it will make for you.*

```
Scope
  In: [what is included]
  Out, explicitly: [what is excluded]

Problem
  The real pain we are solving: [...]
  Who has it: [...]

Examples
  Input: [one concrete input]
  Expected output: [the exact output for that input]

Constraints
  Stack: [...]
  Time: [...]
  Must not change: [...]

Using this spec, [list any gaps and ask me about them / propose a plan before writing any code].
```

**When to reach for SPEC — and when not to**

SPEC earns its keep on anything with more than one reasonable interpretation, anything someone else will pick up later, or anything expensive to rebuild if the first guess is wrong — a multi-stakeholder feature, an unfamiliar part of the codebase, a request that arrived as a one-line Slack message. The cost of writing four short sections is trivial next to the cost of building the wrong version of something.

It’s the wrong tool for a request that’s already unambiguous, or for a genuine spike where the entire point is to find out what’s possible before anything gets committed to. Writing a Constraints section for an exploratory prototype locks in a decision that hasn’t actually been made yet — the same mistake it would be to review a one-character fix as if it were a feature. A trivial or purely mechanical change doesn’t need SPEC either, for the same reason it doesn’t need Plan Mode: there’s no ambiguity left to resolve.

**Try it: worked example — the thinking pattern**

Working through this step by step, rather than jumping straight to a finished spec, is the point — the value is in the order of thinking, not the final document.

Start with the vague ask exactly as it would actually arrive: “Can we let admins export their data as CSV?”

- **Scope, argued out first.** Before anything else, decide what’s out. “Export” could mean every table in the system or just the one screen the admin is currently looking at. Saying “this covers only the transactions on the current filtered view — not a full account export” closes off the expensive version before anyone starts building it, and it’s worth settling this point with whoever asked, directly, rather than guessing.
- **Problem, not the feature as stated.** Ask why an admin wants this before accepting the ticket’s wording at face value. If the real pain is “finance needs last month’s transactions in a spreadsheet every Monday,” the actual fix might be a scheduled export, not a UI button at all. Restating the problem in the requester’s words rather than the ticket’s words is what surfaces this.
- **One example, not a description.** Instead of writing “the CSV should include the standard fields,” show one: three rows, a real header, two filled-in examples. That single artifact settles field order, date format, and whether IDs are included — arguments a paragraph of prose would leave wide open.
- **Constraints, named last because they’re the boundary, not the idea.** State what isn’t negotiable: must reuse the existing filter state, must stay under the admin API’s current rate limit, must ship without a new backend service if this is meant to land same-day. Naming these once, explicitly, beats discovering them by hitting the limit mid-build.

The pattern worth landing: SPEC isn’t filled in top-to-bottom like a form. Scope and Problem often need to be argued out — sometimes face to face with whoever asked — before an Example or a Constraint is even ready to be written down.

### FAQs

**Q: Is SPEC a form I fill in strictly from top to bottom?**

A: No. The four parts come in a fixed order so nobody has to reconstruct the list from memory, but Scope and Problem often need to be argued out, sometimes face to face with whoever asked, before an Example or a Constraint is ready to be written down.

**Q: The ticket says “add a button that exports CSV”. Should my Problem section say that?**

A: No. The button is the feature that was requested; the problem is the pain behind it. Ask why the admin wants it before accepting the ticket’s wording. If the real pain is “finance needs last month’s transactions every Monday”, a scheduled export may beat a button. Confusing the two is how a spec ends up solving the wrong problem correctly.

**Q: I wrote “the CSV should include the standard fields” under Examples. What is wrong with it?**

A: It’s a description, not an example. One concrete artifact, such as three rows with a real header and two filled-in rows, settles field order, date format and whether IDs are included, which a paragraph of prose leaves wide open.

**Q: I’m prototyping to find out whether an approach is even possible. Should I fill in Constraints first?**

A: No. A genuine spike exists to find out what is possible. Writing Constraints for an exploratory prototype locks in a decision that hasn’t actually been made yet.

**Q: One section of my SPEC skeleton is still blank. Does it matter?**

A: Yes. A part you leave blank is a decision Claude Code will make for you, so fill in all four before you hand it over.

### Practice quiz

**Q1.** Your SPEC lists what is in scope in detail, but the “out” line is blank. What is the weakness?

- A. An implied boundary does much less than an explicit one, so nothing actually stops the build from wandering ✅
- B. None; scope only needs what is included
- C. It is too long
- D. The Problem section will make up for it

*Explanation:* Answer A. Scope starts with what is out. An explicit boundary is worth more than an implicit one.

**Q2.** A ticket asks to “let admins export data as CSV”. Which Problem statement follows the chapter?

- A. Add an export button to the admin screen
- B. Admins want to download CSV files
- C. Build a CSV export service
- D. Finance needs last month’s transactions in a spreadsheet every Monday ✅

*Explanation:* Answer D. The Problem is the pain, not the feature as requested. Stated that way, a scheduled export might be the better fix.

**Q3.** You wrote “use the standard CSV format” in Examples. What should replace it?

- A. A longer paragraph describing each column
- B. Three rows: a real header and two filled-in rows ✅
- C. “The usual fields, in the usual order”
- D. A link to the CSV specification

*Explanation:* Answer B. A single concrete artifact settles field order, date format and whether IDs are included.

**Q4.** Which request is the worst candidate for a full SPEC?

- A. A feature with several stakeholders
- B. A one-line Slack message about an unfamiliar part of the codebase
- C. Work that someone else will pick up later
- D. A spike to find out whether a library can do the job ✅

*Explanation:* Answer D. A spike exists to discover the constraints. Writing them down first locks in a decision not yet made.

**Q5.** Which Constraints entry follows the chapter?

- A. “Make it good”
- B. “Must reuse the existing filter state, stay under the admin API’s rate limit, and ship without a new backend service” ✅
- C. “Use whatever stack you prefer”
- D. “Finish soon”

*Explanation:* Answer B. Constraints name what isn’t up for debate: stack, time and what cannot change.

---

## Day 2 recap & takeaways

*Day 02 · Recap · Wrap-up*

The points worth carrying out of the room today, followed by the checkpoint.

### Key takeaways

1. Plan Mode pauses the act step. Read the plan as a review, and edit a step in place rather than accepting or rejecting the whole thing.
2. The context window behaves like RAM. Compaction is lossy, so durable rules live in CLAUDE.md and compaction happens at natural breakpoints, on purpose.
3. A subagent isolates a subtask in its own context; a skill packages a prompt for reuse. They solve different problems.
4. Higher reasoning effort is for tasks visibly too complex to rush. There is no fixed threshold, so watch for a hard question answered too easily.
5. The developer is becoming an architect and a QC.
6. A spec states what is in, what is out, one worked example and the non-negotiable constraints. A vague idea needs questions before it needs a plan.
7. SPEC is Scope, Problem, Examples, Constraints. Scope and Problem get argued out first, and SPEC is the wrong tool for a spike or a trivial change.

### Checkpoint

**Chapter 2 checkpoint**

By the end of this chapter, you should be able to:

- [ ] Turn on Plan Mode and edit a proposed plan before approving it, not just accept or reject it wholesale
- [ ] Explain the difference between `/compact` and `/clear`, and what’s actually lost with each
- [ ] Describe what a subagent is for, in one sentence, without conflating it with a skill or a slash command
- [ ] State the concrete threshold at which a one-off prompt should become a skill
- [ ] Decide whether a task needs higher reasoning effort and explain why in one sentence
- [ ] Point to a specific checkpoint in a project you’re working on and name which ADLC phase it belongs to
- [ ] Turn a vague one-line request into a spec that has scope, a problem statement, an example, and constraints

*Anyone who can’t check one of these off knows exactly which topic to revisit before Chapter 3.*

### Up next

Day 3 turns the spec from a one-off habit into a repeatable process: tool-enforced checkpoints, planning kept apart from building, and one ordered chain from feature to task.

*[← Day 1: Mindset, setup & project configuration](Claude_Code_Upskilling_Day1.html)*
