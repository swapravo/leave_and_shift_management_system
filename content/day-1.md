# Day 1: Mindset, setup & project configuration

*Claude Code Upskilling — Day 1 of 5*

## Overview

*Day 01 · Mindset & Setup · ~90 min*

Ten concepts, about ninety minutes at pace. This is the mental model for working with Claude Code as a pair — before any project-specific setup begins.

### Today’s chapters

- **1.1. The plan/do gap & RTF prompts** (~20 min) — Topics 1–2: Why “AI will understand it” fails, RTF for code prompts
- **1.2. How Claude Code works & choosing a model** (~15 min) — Topics 3–4: How Claude Code actually works, Model selection for coding tasks
- **1.3. Your new role & data hygiene** (~12 min) — Topics 5–6: The developer’s new role, Data hygiene: what’s safe to share
- **1.4. Choosing an interface** (~10 min) — Topic 7: Web UI vs. terminal vs. desktop app
- **1.5. Project configuration: CLAUDE.md, permissions & slash commands** (~40 min) — Topics 8–10: CLAUDE.md: the project’s persistent brief, Permissions model, Slash commands
- **Recap & takeaways** (Wrap-up) — Key takeaways and the day’s checkpoint.

*Each chapter ends with FAQs and a short practice quiz. Topic numbers run 1–43 across the five days, so a cross-reference such as “Topic 12” may point to another day’s playbook. Where the text says “Chapter 1” to “Chapter 5”, it means Day 1 to Day 5.*

### The topics

- **1. Why “AI will understand it” fails** (15 min) — The plan/do gap, and why fluent output isn’t the same as correct output.
- **2. RTF for code prompts** (5 min) — Role, Task, Format — closing off the three things a prompt otherwise leaves the model to guess.
- **3. How Claude Code actually works** (10 min) — The read-plan-act-observe loop, and what’s really sitting in the context window.
- **4. Model selection for coding tasks** (5 min) — Bigger vs. faster is a trade-off, not a hierarchy.
- **5. The developer’s new role** (5 min) — Almost all of the job moves into review — and review is a skill.
- **6. Data hygiene: what’s safe to share** (7 min) — Every prompt is a place data can leave the building.
- **7. Web UI vs. terminal vs. desktop app** (10 min) — Same engine, three different doors in.
- **8. CLAUDE.md: the project’s persistent brief** (15 min) — “Always load these instructions.”
- **9. Permissions model** (10 min) — Allowed, ask first, or denied — decided in advance, not in the moment.
- **10. Slash commands** (10 min) — A multi-step instruction, triggered with a few keystrokes.

---

## Chapter 1.1: The plan/do gap & RTF prompts

*Day 01 · Chapter 1.1 · ~20 min*

### Topic 1: Why “AI will understand it” fails — the plan/do gap (15 min)

> **Core idea:** A model that hasn’t been told what “done” looks like will still confidently hand you something that looks done.

- **a. Try it: cold-open demo** — Give Claude Code one vague, unplanned line asking it to design a database schema for a new feature — something like “add order tracking to the app.” No plan mode, no clarification exchange, nothing. Let it run to completion exactly the way a rushed developer would actually do it on an ordinary Tuesday afternoon, then look at what comes back.
- **b. Failure modes: assumptions & scope** — Once it’s done, open the diff and count how many decisions got made without you — what the data model looks like, where the button lives, what the API contract is — decisions nobody actually signed off on. That gap has a name: the distance between “asked” and “specified.”
- **c. Myth check** — It compiled, it ran, no red text anywhere — does that mean it’s correct? No. A model can be completely fluent and completely wrong at the same time, and fluency is the one thing it’s never short of.
- **d. Habit shift: accept vs. confirm-then-execute** — This is the line everything else in this chapter sits on top of. From here on, nothing gets waved through just because it looks finished — it gets confirmed against what was actually meant, first. Every topic that follows is really just a different way of practicing that one habit.

**Prompt sketch: the cold-open prompt**

*Pick one feature from the BRD and paste this exactly as written, with no plan and no follow-up. When it finishes, list every decision the output made that you didn’t.*

```
Add [a feature from the BRD, e.g. shift swap requests] to the app.
```

### Topic 2: RTF (Role+Task+Format) for code prompts (5 min)

> **Core idea:** A prompt without a stated role, a precise task, and a defined format leaves the model guessing at three things instead of one.

- **a. Role: who Claude acts as** — Compare a bare request against “You are a senior backend engineer reviewing this for production readiness.” The second version doesn’t just sound more formal — it changes what the model actually checks for, because it now has a stance to check from.

  > **What “attention” is, and why a role helps it focus**
  >
  > A model doesn’t weigh every word of your prompt equally. To produce each next word, it scores how relevant every earlier word in the context is, and leans most on the highest-scoring ones. That scoring is called **attention**. It is a weighting spread across everything in the context, so the more a prompt contains, the more any one part of it has to compete.
  >
  > A role is a cue for that weighting. “You are a senior backend engineer reviewing this for production readiness” points the model toward what such a reviewer looks at (error handling, input validation, security, failure cases) and toward how reviewers write. It doesn’t add knowledge the model lacks. It steers which of what it already knows gets used.
  >
  > A vague role gives the model little to focus on, a mismatched role focuses it on the wrong things (see the security-engineer-on-a-CSS-tweak question in the FAQs below), and a specific role paired with a specific task gives it the most to work with. This is a simplified picture of what happens inside the model, but it predicts the behaviour well.
- **b. Task: precise, not vague** — “Improve this” hands the model total freedom to decide what “better” means, which usually isn’t what you meant. “Reduce this function’s cyclomatic complexity by extracting the validation block” leaves no room to improvise the wrong fix.
- **c. Format: shown, not described** — Don’t describe the shape you want the output in — show it. A one-line description of “a table” is read very differently than an actual two-column table with the headers already in place, waiting to be filled in.

**Prompt sketch: Role, Task, Format**

*Fill every blank. Any blank you can’t fill is a part the model would otherwise guess.*

```
Role: You are [a senior ___ engineer] [doing what, e.g. reviewing this for production readiness].

Task: [One specific action on one specific thing, e.g. "Reduce the cyclomatic complexity of validateSwapRequest() by extracting the validation block into its own function."]

Format: Return [the shape of the output]. Use exactly this structure:
[paste a real example of the output here, with the headers or keys already in place]
```

### FAQs

**Q: The generated schema passed every test we have. Doesn’t that mean the plan/do gap didn’t bite?**

A: Not necessarily. Tests only cover behaviours someone already thought to specify. The gap is the set of decisions nobody signed off on: the data model, the API contract, where things live. A green run says nothing about whether those match what you meant. Open the diff and count the decisions that were made without you.

**Q: Does a Role still help if it doesn’t match the task, say “senior security engineer” on a CSS tweak?**

A: A Role changes what the model checks for, so a mismatched one points its attention at the wrong things. It will go looking for auth problems in a stylesheet. Pick the stance that matches what you actually want examined.

**Q: RTF says to show the format, not describe it. How does that work when the output is code, not a table?**

A: The same principle applies. Paste the skeleton you want filled in: the function signature, the test-file layout, the exact shape of the object. A one-line description of the shape leaves the model free to pick a different one.

**Q: If my Task is precise enough to say “extract the validation block”, haven’t I done the work myself?**

A: You’ve made the decision, and the model still does the extraction. That’s the point. Precision removes the room to improvise a different, wrong fix, while the labour stays with the tool.

### Practice quiz

**Q1.** A one-line prompt returns a schema for “order tracking”. It runs, and the tests are green. A colleague says “looks done, merge it.” What does the chapter’s habit tell you to do?

- A. Merge it, since it runs and the tests are green
- B. Reject it and regenerate with a larger model
- C. List the decisions it made (data model, API contract, where things live) and confirm each against what was meant ✅
- D. Ask Claude to explain its design, and merge if the explanation is coherent

*Explanation:* Answer C. Green tests and a coherent explanation are both fluency. Confirm-then-execute means checking the decisions against intent.

**Q2.** Which of these does NOT count as confirming a change against what was meant?

- A. The code compiles and runs with no errors ✅
- B. You compared the schema with the data model you had in mind
- C. You checked the API contract with the team that will call it
- D. You found where the new UI element ended up and approved the placement

*Explanation:* Answer A. Running cleanly shows the output is fluent. It doesn’t show the output matches your intent.

**Q3.** Prompt: “Review this function for production readiness. Return a table with two columns, Issue and Fix.” Which RTF element is missing?

- A. Task
- B. Format
- C. None; all three are present
- D. Role ✅

*Explanation:* Answer D. The Task and the Format are both stated. No stance to check from is given, so the model picks one for itself.

**Q4.** Which Task statement leaves the least room to improvise a wrong fix?

- A. Reduce this function’s complexity
- B. Reduce this function’s cyclomatic complexity by extracting the validation block ✅
- C. Simplify this function so it reads better
- D. Reduce complexity, and tidy up naming and error handling while you’re there

*Explanation:* Answer B. The last option sounds specific but widens the scope. The second names both the measure and the move. **Cyclomatic complexity** counts the independent paths through a function: start at 1 and add 1 for every branch point, such as an `if`, a loop, a `case`, or an `&&` / `||` condition. A function with no branches scores 1. A higher score means more paths to test and more places for a bug to hide, and extracting the validation block into its own function moves those branches out. “Complexity” on its own gives the model nothing measurable to aim at.

**Q5.** You need the result as a JSON object with eight fixed keys. What does RTF suggest?

- A. Write “Return valid JSON”
- B. Describe each key in a paragraph
- C. Include an example object with every key and placeholder values, and ask the model to fill it in ✅
- D. Ask for prose and convert it yourself

*Explanation:* Answer C. Format is shown, not described.

---

## Chapter 1.2: How Claude Code works & choosing a model

*Day 01 · Chapter 1.2 · ~15 min*

### Topic 3: How Claude Code actually works (10 min)

> **Core idea:** Claude Code isn’t answering from memory in one pass — it’s reading, planning, acting, and checking its own work in a loop, the way a careful engineer would.

- **a. The read-plan-act-observe loop** — Here’s what actually happens between pressing enter and getting a result: it reads the files that seem relevant, forms a plan, takes an action (an edit, a command), looks at what happened, and decides what to do next. It’s iterative, not a single leap straight to the answer.
- **b. Context window contents** — Be concrete about what’s actually sitting in front of the model at any given moment: the system prompt, CLAUDE.md, whatever files it’s recently read, and the output of whatever tools it’s run. This is a finite space, not an infinite memory.
- **c. Tool use vs. direct answer** — Some questions it answers straight from what it already knows; others it won’t guess at, so it reaches for a tool — reading a file, running a grep — to check reality first instead of assuming. That difference, answering immediately versus stopping to check, is worth noticing any time you watch it work.
- **d. Context length vs. answer quality** — More context isn’t automatically better context. A window stuffed with irrelevant files degrades what comes back, the same way a person handed a hundred loosely related documents gives a worse answer than someone handed the three that actually matter. This idea gets fully paid off in Topic 12.

### Topic 4: Model selection for coding tasks (5 min)

> **Core idea:** Picking a model is a trade-off, not a hierarchy — there’s rarely a single one that’s simply “the best” for everything you’ll do today.

- **a. Bigger vs. faster** — A larger, more capable model earns its keep on architecture decisions and genuinely hard bugs; a faster, lighter one is the better choice for mechanical edits, boilerplate, and anything where you already know exactly what needs to happen.
- **b. Over-served vs. under-served signals** — Learn to notice both directions of the mistake: paying the latency & token cost of a heavyweight model on a trivial rename is over-serving it; watching a lightweight model fail the same task three times in a row without getting any closer is under-serving it.
- **c. Mid-task model switching** — Escalating to a stronger model partway through a task, once the current one is visibly stuck, is a normal adjustment — not a start-over decision.

### FAQs

**Q: Claude Code checks things with tools before answering. Can I trust what it says once it has?**

A: More than a pure guess, but not blindly. The loop only sees what it chose to read and what the tool returned, inside a finite window. A tool call shows it checked reality for that fact, not that it checked the right fact. Review what it read, not just what it concluded.

**Q: I pointed it at the whole `src/` folder “for context” and the answers got worse. Isn’t more context supposed to help?**

A: Not automatically. A window full of loosely related files degrades the answer, for the same reason a person handed a hundred documents does worse than one handed the three that matter. Give it the files that bear on the task. Topic 12 returns to this.

**Q: How do I tell “this model is too small” from “my prompt is under-specified”?**

A: Look at the pattern. Under-serving shows up as the same task failing repeatedly without getting any closer. Before escalating, check whether the prompt left decisions open (Topics 1–2). A larger model will fill those gaps more fluently, but it will still be filling them.

**Q: If the answer is right, why does it matter that I used the largest model for a rename?**

A: Over-serving is a cost mistake, not a correctness mistake. You pay the latency and token cost of a heavyweight model on work a lighter one does just as well. One rename is trivial. Doing it by habit all day is not.

### Practice quiz

**Q1.** Asked “why does the login test fail?”, Claude Code names a likely cause at once without opening any file. What is the best reading?

- A. Normal, because it always has the repository loaded
- B. It answered from what it already knew instead of stopping to check reality, which is a cue to ask it to verify against the files ✅
- C. It must have read the files earlier, so the answer is grounded
- D. It is a sign you are using too small a model

*Explanation:* Answer B. Some questions it answers directly and others it checks with a tool. Noticing which one happened tells you how grounded the answer is.

**Q2.** A long session is full of large tool outputs, and answers have started to drift. What is the most accurate explanation?

- A. The model tires over long sessions
- B. Tool output isn’t part of the window, so earlier results are lost
- C. CLAUDE.md is dropped after enough turns
- D. The window is finite and holds the system prompt, CLAUDE.md, files and tool output, so irrelevant material crowds out what matters ✅

*Explanation:* Answer D. More context is not automatically better context.

**Q3.** Which task and model pairing is a mismatch?

- A. A genuinely hard bug, using the faster, lighter model so you can iterate quickly ✅
- B. Boilerplate, using the faster model
- C. An architecture decision, using the larger model
- D. A mechanical edit where you know exactly what should happen, using the faster model

*Explanation:* Answer A. Hard bugs and architecture decisions are where the larger model earns its keep.

**Q4.** A lightweight model fails a task once. Does the chapter’s “under-serving” signal apply?

- A. Yes. Escalate immediately, since any failure means the model is too small
- B. No. A single failure always means the prompt is wrong
- C. Not yet. The signal is repeated failure with no attempt getting closer ✅
- D. No. The signal only appears once the context window is full

*Explanation:* Answer C. The chapter’s example is the same task failing three times in a row without getting any closer.

**Q5.** Which statement about CLAUDE.md and the context window is accurate?

- A. CLAUDE.md is stored outside the window, so it costs nothing
- B. CLAUDE.md sits in the window alongside the system prompt, recently read files and tool output, competing for the same finite space ✅
- C. CLAUDE.md only enters the window when you ask Claude to read it
- D. CLAUDE.md replaces the system prompt for the session

*Explanation:* Answer B. This sets up Topic 8: the file is loaded constantly, so every line has a cost.

---

## Chapter 1.3: Your new role & data hygiene

*Day 01 · Chapter 1.3 · ~12 min*

### Topic 5: The developer’s new role (5 min)

> **Core idea:** Using an AI pair doesn’t shrink the developer’s job — it moves almost all of it into review, and review is a skill, not a formality.

- **a. What review actually demands** — Review AI-generated code at least as strictly as a junior engineer’s pull request. Check three things: that it does what you asked, that it handles the edge cases, and that it changed nothing you didn’t ask for. Its confident tone tells you nothing about whether it is right, so the review has to do that job.
- **b. Non-negotiable human judgment** — Some decisions stay with you, whatever Claude Code proposes: architectural decisions, anything security-sensitive, and anything with a real-world consequence if it’s wrong. Decide this list before you start, so you aren’t re-arguing it every time Claude offers a confident answer.
- **c. Cost of rubber-stamping** — This is the direct payoff of Topic 1’s “plausible output still misleads” idea. A wrong line caught in review takes seconds to fix. The same line, approved after a glance, gets built on: other functions call it, data is stored in its shape, tests are written around its behaviour. By the time the fault shows up it is deep-rooted, and ripping it out means unpicking everything that grew on top of it, which costs far more than the closer read would have.

### Topic 6: Data hygiene: what’s safe to share (7 min)

> **Core idea:** Every prompt is a place data can leave the building, so the real question before pasting anything isn’t “will this help” — it’s “am I allowed to send this.”

- **a. Secrets & credentials** — Never paste values from a `.env` file, an API key, or a token into a prompt. Reference the variable name instead of the value — the model needs to know a secret exists, never what it actually is.
- **b. PII: redact before paste** — The same discipline applies to customer data, even when you’re only trying to debug something internally and it feels harmless. Redact first, ask questions after.
- **c. Licensing restrictions** — Not everything sitting in a repo is automatically yours to feed into a tool — some code and datasets carry license terms that don’t cover this kind of use. Flag it rather than assuming it’s fine.
- **d. Org policy: data leaving the network** — This is the one rule on this list that isn’t universal: what’s actually safe to send depends entirely on your organization’s own policy on data leaving its network, so it’s worth checking that policy directly rather than assuming it matches this list.
- **e. Least privilege** — Give Claude Code only what the task needs, and no more. Start it in the project folder, not your home directory. Keep the permission prompts from Topic 9 switched on. Give any token or tool the narrowest scope that does the job: read-only where reading is enough. Anything Claude can reach, a wrong guess can reach too, and so can an instruction hidden inside a file or a web page it reads.
- **f. Before you connect outside tools** — On Day 4 you connect Claude Code to external services through MCP. Everything on this list applies to those connections too: what leaves the network, what a server can read, and what it is allowed to do. Day 4 opens that part with a two-minute safety note. Security for agentic AI is covered in much more detail in the Agentic AI session; this chapter only gives you the minimum you need to start safely.

### FAQs

**Q: I review every diff, so how can rubber-stamping still happen?**

A: Rubber-stamping isn’t skipping the review. It’s approving something that looks finished after a glance. AI output never signals doubt.

**Q: I swapped the real key for a placeholder but kept the variable name and the surrounding config. Is that safe?**

A: Yes, that’s the pattern. The model needs to know a secret exists, not what it is. What isn’t safe is a partial value, because half a key is still a leak.

**Q: We have no written AI data policy. Can I assume anything not on this list is fine?**

A: No. What may leave the network depends on your organization’s policy, so the absence of one is a question for whoever owns it, not a yes. Until you have an answer, the universal rules in this chapter still apply: no secrets, redact PII, and flag licensing questions.

**Q: If the model is better at security review than I am, why keep security decisions with a human?**

A: Who is more capable isn’t the test. What matters is what happens if the decision is wrong. Architecture, anything security-sensitive and anything with a real-world consequence stay human. Naming them once means you don’t relitigate them every time.

**Q: I review every diff anyway. Why does it matter how much access Claude Code has?**

A: Review happens after the fact, and only covers what you can see. Access limits what can go wrong before you look: a command that runs, a file that gets read, a token that gets used. A narrow scope shrinks the worst case, and review shrinks the odds that a mistake reaches the codebase. You want both.

### Practice quiz

**Q1.** Why does AI-generated code deserve at least the scrutiny of a junior engineer’s pull request?

- A. It is consistently lower quality
- B. It sounds equally confident whether it is right or wrong, so its tone tells you nothing about its quality ✅
- C. It cannot read the surrounding codebase
- D. Junior engineers are always more careful

*Explanation:* Answer B. Tone is not a quality signal, so the review has to carry the weight.

**Q2.** You’re debugging a 401 from an API call. What is the best way to give Claude Code context about the key?

- A. Paste the.env file but delete the line holding the key
- B. Paste the first eight characters so it can recognise the key
- C. Say the call fails with a 401 using the key held in `API_KEY` in the environment, and share the call itself ✅
- D. Paste the whole file, since the repo is private

*Explanation:* Answer C. Reference the name, never the value. A partial key is still a leak.

**Q3.** While debugging internally, you find a log line containing a customer’s full name and phone number. What do you do?

- A. Redact the identifying values, keep the structure, then ask your question ✅
- B. Paste it as-is, since this is internal
- C. Paste it, then tell Claude to ignore personal data
- D. Paste only the phone number

*Explanation:* Answer A. Redact first, ask questions after. “It feels harmless” is the situation the rule exists for.

**Q4.** A dataset in the repo carries a licence that restricts it to non-commercial research. You’d like Claude Code to work with it. What does the chapter say?

- A. Fine, because it’s in the repo
- B. Fine once PII is stripped
- C. Fine if you only paste a sample
- D. Flag it rather than assuming it’s fine ✅

*Explanation:* Answer D. Not everything in a repo is automatically yours to feed into a tool.

**Q5.** A Claude Code change to the auth middleware passes CI and a quick glance. What does the chapter’s guidance say?

- A. Merge it, because CI passed
- B. Review it as closely as a junior engineer’s PR. It is security-sensitive, and “looks finished” is exactly how rubber-stamping starts ✅
- C. Ask Claude to review its own change, and merge if it agrees
- D. Merge it if the diff is small

*Explanation:* Answer B. Security-sensitive work stays with human judgment, and a glance is not a review.

**Q6.** You want Claude Code to read open issues from the project’s tracker, and nothing else. Which setup follows least privilege?

- A. An organization-wide admin token, so you never have to change it
- B. Your personal full-access token, since it already works everywhere
- C. A read-only token scoped to that one repository ✅
- D. Any token at all, because you review every diff afterwards

*Explanation:* Answer C. Give the narrowest scope that does the job. Reviewing a diff afterwards doesn’t limit what a token can reach before you look.

---

## Chapter 1.4: Choosing an interface

*Day 01 · Chapter 1.4 · ~10 min*

### Topic 7: Web UI vs. terminal vs. desktop app (10 min)

- **a. Terminal** — Use it on the system that has data attached with the code. Good for remote environments.
- **b. Desktop app** — Same underlying engine, wrapped in a GUI that’s friendlier for anyone who isn’t naturally comfortable living in a terminal.
- **c. Web UI** — Faster for building features, because the terminal and the desktop app stutter with permissions.

### FAQs

**Q: The three interfaces share an engine. Does the choice matter at all?**

A: Yes, because what differs is where you work and how much friction you meet. That means where the code and data live, how comfortable you are in a terminal, and how permission prompts affect your pace.

**Q: My code and its data sit on a remote machine. Which interface?**

A: The terminal on that system. The chapter’s guidance is to use it where the data is attached to the code, and it suits remote environments. Pulling the code to a laptop to use a GUI means working away from the data.

**Q: The chapter says the web UI is faster for building features because of permission stutter. Should I just switch permissions off in the terminal?**

A: No. The stutter is approval friction, and the fix at the source is deciding in advance what is allowed, asked or denied (Topic 9). Choosing the web UI sidesteps that friction, but it doesn’t remove the need to decide what Claude may touch.

### Practice quiz

**Q1.** You’re on a laptop with no copy of the data. The code and data sit together on a staging server you reach over SSH. Which interface fits the chapter’s guidance?

- A. The desktop app, because it’s friendlier
- B. The web UI, because it’s fastest for features
- C. The terminal on the server, where the data is attached to the code ✅
- D. Any of them, since they differ only in looks

*Explanation:* Answer C. The terminal runs where the code and data already live, which makes it the natural fit for remote environments.

**Q2.** Which statement about the three interfaces is accurate?

- A. The desktop app is a reduced version of the terminal one
- B. All three are the same underlying engine with different ways in, so you choose by where and how you work ✅
- C. The web UI uses a different, faster model
- D. Only the terminal supports permissions

*Explanation:* Answer B. Same engine, three different doors in.

**Q3.** Which pairing is NOT in line with the chapter?

- A. Desktop app, because it has more capabilities than the terminal ✅
- B. Terminal, for a remote environment
- C. Desktop app, for someone not comfortable living in a terminal
- D. Web UI, for building features quickly

*Explanation:* Answer A. The desktop app is the same engine in a GUI. It isn’t a more capable one.

**Q4.** Permission prompts keep interrupting your feature work in the terminal. Which response best combines this chapter with Topic 9?

- A. Turn off all permission checks
- B. Move to the desktop app, which avoids prompts
- C. Stop using Claude Code for feature work
- D. Use the web UI, which the chapter names for fast feature building, and fix the friction at its source by deciding allowed, ask and denied in advance ✅

*Explanation:* Answer D. Switching interface sidesteps the friction. Deciding permissions in advance removes its cause.

---

## Chapter 1.5: Project configuration: CLAUDE.md, permissions & slash commands

*Day 01 · Chapter 1.5 · ~40 min*

### Topic 8: CLAUDE.md: the project’s persistent brief (15 / 20 min)

> **Core idea:** “Always Load these Instructions.”

- **a. What belongs** — Conventions, architecture summary, key decisions: the kind of thing you’d want a new team member to read on their first day.
- **b. What doesn’t belong** — Mirrors the data hygiene rule from Topic 6: nothing that changes day to day, and nothing sensitive, because this file gets read constantly and often shared widely.
- **c. Team-shared vs. personal** — Distinguish the version that lives in the repo and belongs to the whole team from a personal one layered on top for individual preferences.
- **d. Keeping it current** — A CLAUDE.md nobody updates rots exactly like documentation nobody updates. Treat it as something reviewed in pull requests, not written once and forgotten.

**Prompt sketch: draft a CLAUDE.md for this repo**

*Run it from the repository root. Check the draft against “What belongs” and “What doesn’t belong” before you save it.*

```
Read this repository and draft a CLAUDE.md for it.

Include only:
- the stack, and how to run, test and lint the project
- the conventions a new team member would need on their first day
- a short summary of the architecture and any key decisions already made
- anything that must never be touched or done in this repo

Leave out anything that changes day to day, and anything sensitive: no credentials, tokens or personal data.
Keep it under [60] lines. Where you are unsure about something, ask me instead of guessing.
```

### Topic 9: Permissions model (10 min)

> **Core idea:** Every tool Claude Code can use sits behind one of three doors — allowed, ask first, or denied — and deciding that in advance is safer than after the action has happened.

- **a. Allow, ask, deny** — An allow rule lets Claude Code use a tool without asking. An ask rule prompts you every time. A deny rule blocks it. Out of the box, reading files inside the project folder goes ahead without a prompt, while edits, shell commands and web access ask first. ([source](https://code.claude.com/docs/en/permissions))
- **b. Writing a rule** — A rule is a tool name plus an optional pattern: `Bash(npm run *)` covers every `npm run` command, `Read(./.env)` covers reading that one file, and `WebFetch(domain:example.com)` covers one website. Rules are checked in the order deny, then ask, then allow, and the first match wins. A narrower allow rule can’t carve an exception out of a broader deny, so write the broad allow and carve out exceptions with deny. ([source](https://code.claude.com/docs/en/permissions))
- **c. Where rules live** — `.claude/settings.json` in the repository holds the rules the whole team shares, so commit it. `.claude/settings.local.json` holds rules just for you on this repository, including the ones saved when you answer “Yes, and don’t ask again”. `~/.claude/settings.json` applies across all your projects. Type `/permissions` to see every rule and which file it came from. ([source](https://code.claude.com/docs/en/permissions))
- **d. Modes** — A mode changes how much Claude Code asks. In the default mode (Manual) it prompts on first use of each tool. `acceptEdits` approves file edits inside the project folder, and Plan Mode (Topic 11) lets it read and explore without editing. `bypassPermissions` skips the prompts entirely, and the documentation says to use it only in isolated environments such as containers or virtual machines. ([source](https://code.claude.com/docs/en/permissions))
- **e. Rules, not instructions** — Permission rules are enforced by Claude Code itself. A line in CLAUDE.md or a prompt shapes what Claude tries to do, but it doesn’t change what Claude Code allows. To keep `.env` out of reach (Topic 6a), a `Read(./.env)` deny rule blocks Claude’s file-reading tools from opening it. A note in CLAUDE.md asking Claude not to read it does not. ([source](https://code.claude.com/docs/en/permissions))

**Prompt sketch: a starter permissions file**

*Save this as.claude/settings.json in the repo and commit it, then adjust it to your project’s own commands. Run /permissions afterwards to check what Claude Code picked up.*

```
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git status)",
      "Bash(git diff *)"
    ],
    "ask": [
      "Bash(git push *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./secrets/**)"
    ]
  }
}
```

### Topic 10: Slash commands (10 / 15 min)

> **Core idea:** A slash command turns a multi-step instruction you’d otherwise retype every time into something triggered with a few keystrokes.

- **a. Writing a custom command** — Writing one from scratch — something like a `/pr-checklist` command — walks through the whole process end to end: from a blank file to a working command triggered with a few keystrokes.

**Prompt sketch: a starter /pr-checklist command**

*Save this as.claude/commands/pr-checklist.md in the repo, then type /pr-checklist before you open a pull request. Anything you type after the command replaces $ARGUMENTS. A skill at.claude/skills/pr-checklist/SKILL.md works the same way.*

```
---
description: Run the pre-PR checklist on the current branch
---
Review the changes on this branch against main and work through this checklist.
For each item answer pass, fail or not applicable, with one line of evidence.

What this change is meant to do: $ARGUMENTS

1. Does the diff contain only changes related to that goal? List any unrelated edits.
2. Are there tests for the new behaviour? Run them and report the result.
3. Were any existing tests changed or loosened? If so, say why.
4. Does anything in the diff look like a secret, credential or personal data?
5. Is there anything in the diff that nobody asked for?
6. Does the PR description say what changed and why?

End with a one-paragraph summary and a list of anything that needs a human decision before this goes up for review.
```

### Before you build: Git as your safety net

Claude Code’s `/rewind` can undo the file edits it makes, but it doesn’t track files changed by shell commands such as `rm` or `mv`, and its own documentation calls it session-level recovery, not a replacement for version control. ([source](https://code.claude.com/docs/en/checkpointing)) Git is the net underneath. Set it up before the first real build, not after the first mistake.

**The routine**

- **Start clean.** Run `git status`. Commit or stash your own work first, so anything that changes afterwards is Claude’s.
- **One branch per task.** `git switch -c feature/short-name`. If the task goes wrong, you throw away a branch, not the project.
- **Commit at every green point.** When the tests pass and the diff makes sense, commit. Small commits are save points you can return to. One huge commit at the end isn’t.
- **Read the diff before you commit.** `git diff` is the review from Topic 5 made concrete. Look for edits nobody asked for.
- **Keep pushes manual.** Let Claude draft commits if you like, but have `git push` stop for your approval (the ask-first door from Topic 9), and don’t work directly on `main`.

**When something goes wrong: the undo ladder**

- **One file is wrong, not yet committed.** `git restore <file>` puts it back to the last commit.
- **Everything uncommitted is wrong.** `git restore.` resets every tracked file. Brand-new files need `git clean -n` first, which lists what would be deleted without deleting it, and then `git clean -fd`. Both throw work away for good.
- **A commit is wrong and already shared.** `git revert <commit>` adds a new commit that undoes the old one and leaves history intact.
- **A commit is wrong and only on your machine.** `git reset --hard <commit>` moves the branch back and discards everything after it. Use it only on work you haven’t pushed.
- **Not sure what happened.** Run `git log --oneline` and `git diff` before you do anything destructive.

### FAQs

**Q: Our CLAUDE.md has grown to 800 lines because everyone keeps adding to it. Is that a problem?**

A: Yes. The file is loaded every time and takes up room in a finite context window. More context is not automatically better. Cut it back to what a new teammate needs on day one.

**Q: “We use React 18” changes whenever we upgrade. Does that belong in CLAUDE.md?**

A: Yes. The exclusion is for things that change day to day, such as today’s task list, and a framework version doesn’t. The cost is upkeep. When the version changes, the file has to change in the same pull request.

**Q: Why review CLAUDE.md in pull requests? It’s only a text file.**

A: Because it is always loaded, a stale line misleads every session that starts after it. A CLAUDE.md nobody updates rots exactly like documentation nobody updates. The team-shared version belongs to the whole team, so changes to it deserve a team review.

**Q: I wrote a broad allow rule for shell commands and a deny rule for one dangerous command. Both match. Is this safe?**

A: Yes. Rules are checked in the order deny, then ask, then allow, and the first match decides. That is what makes it safe to write a broad allow and carve out exceptions with deny.

**Q: When is a custom slash command better than putting the instruction in CLAUDE.md?**

A: CLAUDE.md is standing context that loads every time. A slash command runs on demand. A multi-step routine you only need before a pull request would take up window space in every other session if you put it in CLAUDE.md. As a command, it costs nothing until you type it.

**Q: I wrote “never read.env” in CLAUDE.md. Is that file protected now?**

A: Not by that line alone. CLAUDE.md shapes what Claude tries to do, but permission rules are what Claude Code enforces. To block reads of the file, add a deny rule such as `Read(./.env)`.

### Practice quiz

**Q1.** Which of these belongs in CLAUDE.md?

- A. This sprint’s priorities
- B. A summary of the architecture and a key decision: services communicate through events, and billing is only reached through its API ✅
- C. Read-only database credentials, for convenience
- D. A paste of the full changelog

*Explanation:* Answer B. Conventions, architecture and key decisions belong. Daily-changing and sensitive material doesn’t.

**Q2.** Six months on, CLAUDE.md still describes an authentication flow that was replaced. What is the consequence?

- A. None, because the model ignores outdated lines
- B. Only the personal file is affected
- C. Claude Code rewrites it automatically
- D. It has rotted like documentation nobody updates, and because it’s loaded constantly it actively misleads, which is why it should be reviewed in pull requests ✅

*Explanation:* Answer D. Treat it as something reviewed in pull requests, not written once and forgotten.

**Q3.** An allow rule covers all `git` commands, and a deny rule covers `git push`. Claude Code is about to run `git push origin main`. What happens?

- A. It runs, because allow is the broader rule
- B. Claude Code asks you to choose
- C. It is denied ✅
- D. Whichever rule was written first applies

*Explanation:* Answer C. Deny is checked first and wins, however broad the allow rule is.

**Q4.** You want a broad allow for convenience, with a few things that must never run. Which structure is safe?

- A. A broad allow plus specific deny rules, because deny is checked first ✅
- B. Many narrow allow rules, because deny can’t override an allow
- C. A broad allow plus ask rules for the dangerous items, because ask beats deny
- D. Deny rules only, because allow rules can’t be combined with them

*Explanation:* Answer A. Rules are checked deny, then ask, then allow, and the first match decides.

**Q5.** Which is the best candidate for a custom slash command rather than a CLAUDE.md entry?

- A. “We use trunk-based development”
- B. A routine you run before every PR: lint, summarise the diff, fill in the PR template, list unchecked items ✅
- C. “Never commit secrets”
- D. The architecture summary

*Explanation:* Answer B. CLAUDE.md is standing context that loads every time. A command is triggered on demand for a multi-step instruction you’d otherwise retype.

**Q6.** You want Claude Code to be unable to read `.env`. Which of these actually does that?

- A. A `Read(./.env)` deny rule in the project settings ✅
- B. A line in CLAUDE.md asking it not to read the file
- C. An allow rule that covers only the `src` folder
- D. A reminder in the prompt to be careful with secrets

*Explanation:* Answer A. Permission rules are enforced by Claude Code. CLAUDE.md and prompts shape what it tries to do, and reads inside the project folder don’t need approval, so an allow rule elsewhere blocks nothing.

---

## Day 1 recap & takeaways

*Day 01 · Recap · Wrap-up*

The points worth carrying out of the room today, followed by the checkpoint.

### Key takeaways

1. Fluent is not the same as correct. Nothing gets waved through because it looks finished; it gets confirmed against what was actually meant.
2. A prompt without a Role, a precise Task and a shown Format leaves the model guessing at three things instead of one.
3. Claude Code works in a read-plan-act-observe loop inside a finite context window, and more context is not automatically better context.
4. Model choice is a trade-off. Notice over-serving and under-serving, and escalate mid-task when the current model is stuck.
5. The developer’s job moves into review. Architecture, security and anything with a real-world consequence stay with a human.
6. Send names, not values. Redact PII before pasting, flag licensing questions, and check your organization’s actual data policy.
7. CLAUDE.md, permissions and slash commands are all the same idea: decide once, in advance, and write it down where it will be loaded.

### Checkpoint

**Chapter 1 checkpoint**

By the end of this chapter, you should be able to:

- [ ] Explain, in one sentence, why an unplanned prompt produces plausible-but-wrong output more often than it produces correct output
- [ ] Write a prompt using Role, Task, and Format without needing to look up the structure
- [ ] Describe what’s actually sitting inside the context window at a given moment, and why more of it isn’t automatically better
- [ ] Choose a model for a given task and explain the trade-off out loud, not just by habit
- [ ] State the org’s actual data policy, not a guess at what it probably is
- [ ] Read a real CLAUDE.md file and explain what belongs in it and why — ideally the one just written for today’s app

*Anyone who can’t check one of these off yet knows exactly which topic to revisit before Chapter 2 starts.*

### Up next

Day 2 turns these individual habits into a workflow: plan before you act, manage context on purpose, and turn a vague request into a spec.
