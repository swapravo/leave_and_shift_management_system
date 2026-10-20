# Day 4: Codebase recon, prompt precision & MCP tooling

*Claude Code Upskilling — Day 4 of 5*

## Overview

*Day 04 · Recon, Precision & MCP · ~65–90 min*

Eight concepts. This is where reading comes before touching, instructions get sharpened with precise verbs and explicit boundaries, and Claude Code's reach extends past the repo through MCP — to issue trackers, live pages, databases, and design systems.

### Today’s chapters

- **4.1. Codebase recon & large repos** (~20–25 min) — Topics 28–29: Safe recon in an unfamiliar codebase, Working in large repos (100k+ lines)
- **4.2. Prompt precision & the first-draft habit** (~10 min) — Topics 30–31: Precision verbs & negative constraints, First output as draft, not answer
- **4.3. What MCP is and why it matters** (~10 min) — Topic 32: What MCP is and why it matters
- **4.4. MCP tool tours: dev & design** (~15–35 min) — Topics 33–34: Dev-tool tour, Design-tool tour
- **4.5. Commit hygiene** (~10 min) — Topic 35: Commit hygiene
- **Recap & takeaways** (Wrap-up) — Key takeaways and the day’s checkpoint.

*Each chapter ends with FAQs and a short practice quiz. Topic numbers run 1–43 across the five days, so a cross-reference such as “Topic 12” may point to another day’s playbook. Where the text says “Chapter 1” to “Chapter 5”, it means Day 1 to Day 5.*

### The topics

- **28. Safe recon in an unfamiliar codebase** (10 / 10 min) — Reading a codebase before touching it — the read half of the loop, done deliberately.
- **29. Working in large repos (100k+ lines)** (10 / 15 min) — Deciding which slice of a huge repo actually belongs in context.
- **30. Precision verbs & negative constraints** (5 / 5 min) — Pairing a precise verb with an explicit boundary on what not to touch.
- **31. First output as draft, not answer** (5 / 5 min) — Treating the first output as a draft to critique, not an answer to accept.
- **32. What MCP is and why it matters** (10 / 10 min) — What an MCP server actually reaches that a built-in tool can’t.
- **33. Dev-tool tour** (15 / 15 min) — Picking the one MCP server a task actually needs — not whichever is handy.
- **34. Design-tool tour** (— / 20 min) — Building a new screen against what’s already shipped, not from a blank page.
- **35. Commit hygiene** (10 / 10 min) — Reading a diff line by line before anything gets committed in your name.

---

## Chapter 4.1: Codebase recon & large repos

*Day 04 · Chapter 4.1 · ~20–25 min*

### Topic 28: Safe recon in an unfamiliar codebase (10 / 10 min)

> **Core idea:** Reading a codebase before changing it is the read half of Topic 3’s read-plan-act-observe loop, deliberately front-loaded instead of skipped because the deadline feels close.

- **a. Try it: read-only pass first** — Point Claude Code at an unfamiliar part of a codebase you’re working in, with no prior history, and ask it to explore only: read the entry points, trace how a request actually moves through the system, and report back in plain language before a single line changes. Try this against a part of the app you haven’t opened yet, and notice the difference between an account built from files that were actually opened and one stitched together from folder names and good guesses. The instinct to skip straight to the change is strongest exactly when the codebase looks the most familiar, which is precisely the moment this pass earns its ten minutes.
- **b. Architecture summary before touching** — Once the read-only pass is done, ask for a short written account of how the pieces actually fit together: which module owns which responsibility, where a request enters and where it exits, and which boundary a given kind of change would have to cross.
- **c. Myth check: where recon gets skipped** — If this stack looks like ten others you’ve worked in — same framework, same folder layout — is it safe to skip the read-only pass and go straight to the fix? No. A stack that looks conventional on the surface routinely hides one genuinely local decision a few files in — a custom auth wrapper, a non-standard error-handling convention, a data model that diverges from what the framework’s own docs would lead you to expect — and the read-only pass is the only thing standing between that decision and a change built against the wrong assumption.

**Prompt sketch: a read-only recon pass**

*Step 1. Point it at an area you haven’t opened yet. Nothing changes until it has reported back.*

```
Explore only. Do not edit, create or delete anything.

I'm new to [the part of the codebase, e.g. the leave approval flow]. Read the entry points and trace how a request moves through it, from where it enters to where the response leaves.

Report back in plain language:
- the files you actually opened, in the order you read them
- what each one is responsible for
- anything unusual or specific to this codebase (a custom wrapper, a non-standard convention)

Mark anything you inferred rather than read.
```

**Prompt sketch: an architecture summary**

*Step 2. Run it once the read-only pass is done, and before you touch anything.*

```
Based on what you just read, write a short architecture summary of [the area]:
- which module owns which responsibility
- where a request enters and where it exits
- which boundary a change to [the change you are planning] would have to cross

For each claim, name the file (and the line, where you can). If you could not check something, say so instead of guessing.
```

### Topic 29: Working in large repos (100k+ lines) (10 / 15 min)

> **Core idea:** The context-window managing skill at this scale is deciding which fraction of the codebase gets fed into it — all of it won’t fit.

- **a. Why full-repo context doesn’t scale** — At this scale, context becomes dead weight that causes the model to return worse responses, not better ones — the same degradation Topic 3d named, just at a scale where it’s no longer optional to manage.
- **b. Indexing & retrieval strategies** — Notice how a genuinely large repo gets searched in practice: an index or an embedding-based retrieval step finds the handful of files actually relevant to the question first, and only those get handed to Claude Code to read — never a linear scan through every file in the tree hoping the right one eventually turns up.
- **c. Try it: subagents for parallel exploration** — Create two or three subagents for different, unrelated corners of the repo at the same time — one tracing how authentication works, another mapping the billing module — and have each return a short summary rather than the raw files it reads. The main thread stays clean and the total wall-clock time drops, because three explorations happen at once instead of one after another.
- **d. Signs of guessing vs. grounding** — An answer that names a specific file and line number was checked; an answer that says a function “probably” does something, or describes behavior in general terms without pointing at where it lives, was guessed.

**Prompt sketch: parallel exploration with subagents**

*Use it for unrelated corners of a large repo. Each subagent returns a summary, not the files it read.*

```
Use [2 or 3] subagents in parallel, one for each of these unrelated areas:
1. [e.g. how authentication works]
2. [e.g. how the billing module calculates charges]

Each subagent should return a summary of no more than [10] lines: where the logic lives (file and function), how it fits together, and anything that looks fragile. It must not return the files it read. Do not make any changes.
```

### FAQs

**Q: The change I need is one line in a file I can already see. Is a recon pass still worth it?**

A: Yes. The pass isn’t sized to the edit, it’s about what the edit has to cross. A one-line change can still depend on a local decision a few files away, such as a custom auth wrapper or a non-standard error-handling convention, that the file in front of you doesn’t show.

**Q: The recon summary reads confidently. How do I know it came from the code and not from folder names?**

A: Look for specifics. A checked answer names a file and a line number. A guessed one says a function “probably” does something, or describes behaviour in general terms without pointing at where it lives. Ask it to say where each claim comes from, and to mark anything it inferred.

**Q: Why not give Claude Code the whole repo and let it work out what’s relevant?**

A: At 100k+ lines the context becomes dead weight, and it returns worse answers, the same degradation Topic 3d named. The skill is choosing which fraction goes in. Retrieval finds the handful of relevant files first, and only those get read.

**Q: I used three subagents and my main conversation still filled up with clutter. What went wrong?**

A: Most likely they returned the raw files they read instead of a summary. The point of sending a subagent to explore is that only a short summary comes back. Tell each one exactly what to return, and to leave the files out.

### Practice quiz

**Q1.** You’ve worked in this exact framework and folder layout many times, and the bug looks like a one-file fix. What does the chapter advise?

- A. Skip recon, because you know the stack
- B. Run recon only if the repo is over 100k lines
- C. Run the read-only pass anyway, because a conventional-looking stack can hide a local decision a few files in ✅
- D. Ask Claude Code to guess based on the framework’s own documentation

*Explanation:* Answer C. The instinct to skip is strongest when the codebase looks most familiar, which is exactly when the pass earns its time.

**Q2.** Which recon output is the best evidence that Claude Code actually read the code?

- A. “Tokens are validated in auth/session.ts at line 42, and billing calls it from billing/guard.ts.” ✅
- B. “The auth module owns session handling, and requests flow through the API layer.”
- C. “Auth is probably handled in middleware, as is typical.”
- D. A long paragraph on best practice for authentication

*Explanation:* Answer A. Naming a file and line is grounding. The other answers could have been written without opening anything.

**Q3.** Why doesn’t loading as much of a 150k-line repo as will fit solve the problem?

- A. It is slower but always more accurate
- B. Claude Code refuses inputs of that size
- C. It only matters for monorepos
- D. Context that isn’t relevant is dead weight and makes answers worse, so the skill is choosing which fraction goes in ✅

*Explanation:* Answer D. This is Topic 3d’s degradation, at a scale where managing it is no longer optional.

**Q4.** You need to understand authentication and billing in an unfamiliar repo, and the two are unrelated. What is the best use of subagents?

- A. One subagent for both, returning every file it read
- B. Two subagents in parallel, one per area, each returning a short summary ✅
- C. Run them one after another so the main thread can read everything
- D. Don’t use subagents; they are only for reviewing changes

*Explanation:* Answer B. Parallel exploration drops the wall-clock time, and summaries keep the main thread clean.

**Q5.** Claude Code’s recon summary says the order-validation function “probably” checks stock before charging the customer. What is the best next step?

- A. Accept it, since “probably” is good enough for planning
- B. Re-run the same prompt on a larger model
- C. Add the claim to CLAUDE.md so it stops asking
- D. Ask it to show where in the code that happens, and treat the claim as a guess until it can ✅

*Explanation:* Answer D. “Probably” is the sign of a guess. A grounded answer points at where the behaviour lives.

---

## Chapter 4.2: Prompt precision & the first-draft habit

*Day 04 · Chapter 4.2 · ~10 min*

### Topic 30: Precision verbs & negative constraints (5 / 5 min)

> **Core idea:** Topic 2b asked for a task that’s precise instead of vague; a specific verb paired with an explicit boundary on what not to touch is what that instruction actually looks like once it’s written down.

- **a. Precise verbs** — Extract, summarize, refactor: each one names a specific operation, not a vague wish for things to be better.
- **b. Try it: negative constraints, in practice** — Run the identical request twice: once with no boundary at all, once with “don’t touch the database layer” added to the end of it. The unconstrained version drifts, almost every time, into at least one file nobody meant for it to open; the constrained version doesn’t, for the simple reason that it was never given the option.
- **c. Why negative beats positive** — A positive instruction states the happy path and leaves everything else technically permitted. “Don’t modify existing tests” rules out an entire category of unwanted behavior — quietly loosening an assertion so a failing test starts passing — that no amount of positively-phrased instruction would have thought in advance to exclude.

**Prompt sketch: the same request, with and without a boundary**

*Run both from the same starting point and compare which files each one touched.*

```
Run 1, no boundary:
[A request with a precise verb, e.g. "Extract the validation logic in checkout.js into its own function."]

Run 2, same request plus one boundary:
[The same request.] Don't touch the database layer, and don't modify any existing tests.
```

### Topic 31: First output as draft, not answer (5 / 5 min)

> **Core idea:** The first thing Claude Code hands back is a draft whether it announces itself as one or not, so treating it that way is the actual discipline — not an optional extra step tacked onto the end.

- **a. Prompt-review-iterate loop** — This is the same habit shift Topic 1d named: prompt, read the output critically, iterate on the specific thing that’s wrong with it. It’s Topic 16’s govern-rather-than-execute posture, scaled down from an entire lifecycle to a single response — the same discipline, exercised dozens of times a day instead of once per project.
- **b. Ship-ready vs. looks-done** — A model will often report a task as finished successfully even when it quietly skipped part of it or one of its subtasks. Trying a large, multi-part change against a small, lightweight model makes this easy to see firsthand. The point of noticing it is developing a sense for which tasks can be left on autopilot and which ones need to be explicitly checked.
- **c. Naming the specific fix** — “That’s not quite right, try again” hands the model the identical freedom-to-guess problem a second time, and usually gets a second wrong guess back for it. “The error message on line 40 references the array index instead of the field name — fix that” gives it exactly one thing to change.

**Prompt sketch: name the specific fix**

*Use it instead of “try again”. Fill in all three parts so the model has exactly one thing to change.*

```
In [file], on line [N]: [what the code does now].
It should [what it should do instead].
Change only that. Don't touch [anything else that must stay as it is].
```

### FAQs

**Q: Won’t a long list of “don’ts” just clutter the prompt?**

A: A negative constraint isn’t a list, it’s a boundary on the category you most want to protect, such as “don’t touch the database layer” or “don’t modify existing tests”. It rules out whole categories of unwanted behaviour that you would never have thought to exclude one case at a time. Keep to the boundaries that matter.

**Q: Why say “don’t modify existing tests” instead of just “make the tests pass”?**

A: “Make the tests pass” is a positive instruction, and it leaves one route technically permitted: quietly loosening an assertion so a failing test starts passing. The negative constraint closes that route before the model can take it.

**Q: The model says every part of a big change is done. When do I take that at face value, and when do I check?**

A: Not on its word for a large, multi-part change, where it will often report success even though it quietly skipped a part. Small mechanical changes can be left on autopilot. Multi-part ones need explicit checks. Learning which is which is the skill.

**Q: My feedback was “this is wrong, redo it” and the second attempt was wrong too. What should I have said?**

A: Name the specific thing: “The error message on line 40 references the array index instead of the field name; fix that.” Vague feedback hands the model the same freedom to guess a second time. A specific fix gives it exactly one thing to change.

### Practice quiz

**Q1.** Which rewrite of “clean up the checkout code” is the strongest?

- A. Clean up the checkout code and anything else that needs it
- B. Refactor checkout for readability
- C. Extract the discount calculation in checkout.js into its own function; don’t change the database layer or any existing tests ✅
- D. Improve checkout, but be careful

*Explanation:* Answer C. It has a precise verb, one named target and explicit boundaries on what not to touch.

**Q2.** You run the same request twice. Without a boundary it drifts into a file nobody meant it to open. With “don’t touch the database layer” it doesn’t. What explains the second run?

- A. The model understood the risk better
- B. It was never given the option ✅
- C. Negative instructions use more reasoning effort
- D. The second run had more context

*Explanation:* Answer B. A boundary removes the option. It doesn’t rely on the model deciding to hold back.

**Q3.** Why is “make the failing test pass” a risky instruction on its own?

- A. It leaves open loosening an assertion so the test passes without the bug being fixed ✅
- B. It is too specific
- C. Agents are not allowed to touch tests
- D. It is a negative constraint

*Explanation:* Answer A. A positively phrased instruction wouldn’t have thought to exclude that behaviour. “Don’t modify existing tests” does.

**Q4.** Claude Code reports that a six-part change is complete. What is the best response?

- A. Commit it, since it reported success
- B. Ask “are you sure?” and accept the reply
- C. Check each part against what was asked, because skipped subtasks hide in multi-part changes ✅
- D. Run the same prompt again and compare

*Explanation:* Answer C. Looks-done and ship-ready are different things.

**Q5.** Which feedback gives the model exactly one thing to change?

- A. “The error on line 40 uses the array index; use the field name instead.” ✅
- B. “Fix the errors in validation.js.”
- C. “The tests are failing; fix them.”
- D. “The validation is wrong in a few places.”

*Explanation:* Answer A. The others leave the model free to decide what “wrong” means and to guess again.

---

## Chapter 4.3: What MCP is and why it matters

*Day 04 · Chapter 4.3 · ~10 min*

### Topic 32: What MCP is and why it matters (10 / 10 min)

> **Core idea:** MCPs are the Type-C cables connecting Claude Code to external services like Google Drive or Canva.

- **a. MCP server vs. plugin** — A plugin is a bundle: skills, commands, and configuration packaged as one installable unit that sits on disk until it’s invoked. An MCP server is a live connection to something running outside Claude Code entirely, open for as long as it’s actually being used.
- **b. Myth check: MCP vs. built-in tools** — Claude Code can already read files and run shell commands — doesn’t that make MCP redundant? No. Built-in tools reach the machine Claude Code happens to be running on; MCP reaches everything that machine isn’t — a real GitHub repository’s issue tracker, a live staging database sitting on someone else’s server, a website that’s actually running right now. The two categories don’t overlap; they cover different ground entirely.

**Before you connect any server: a two-minute safety note**

From the next chapter on, you connect Claude Code to external tools on a real repository. A server is a live connection, so these three habits apply before you add one.

- **Connect only to servers you trust.** A server decides what tools Claude Code is offered and what comes back from them. Use servers from a source you can name, and check what access each one asks for before you approve it.
- **Treat what a tool brings back as untrusted.** An issue, a web page or a database row can contain text that reads like an instruction. Content returned by a tool is data to be read, never a command to be followed, and you decide what Claude Code does with it.
- **Keep permission prompts on.** Don’t pre-approve a server’s tools to avoid clicking. The prompt is the moment you get to see what is about to run (Topic 9). Start with read-only access, as in Topic 6e.

This is only the short version. Security for agentic AI is covered in much more detail in the Agentic AI session.

### FAQs

**Q: A plugin and an MCP server both extend Claude Code. How do I tell which one I’m looking at?**

A: Ask what it is. A plugin is a bundle of skills, commands and configuration, packaged as one installable unit that sits on disk until it’s invoked. An MCP server is a live connection to something running outside Claude Code, open for as long as it is being used.

**Q: If a task only touches files in the repo, does MCP add anything?**

A: No. Built-in tools already reach the machine Claude Code is running on. MCP earns its place when the task needs something that machine isn’t: an issue tracker, a live staging database on someone else’s server, a website that is running right now.

**Q: Is the Type-C cable comparison just a metaphor, or does it say something about how MCP works?**

A: It says something real. MCP is an open standard for connecting AI tools to external systems, so there is one standard way to plug in services such as Google Drive or Canva, instead of a different custom connection for each.

**Q: Does an MCP server carry a risk that a plugin on disk doesn’t?**

A: It carries a different one. A server is a live connection, and each one comes with its own permissions surface. That is why Topic 33d says to connect a server because the task needs its specific reach, and never because it happens to be available.

### Practice quiz

**Q1.** A task needs the current status of open issues in the team’s tracker. What is the right tool?

- A. Built-in file tools, reading the repository
- B. Neither; Claude Code can’t reach a tracker
- C. A plugin, because plugins hold live connections
- D. An MCP server, because the tracker lives outside the machine Claude Code runs on ✅

*Explanation:* Answer D. Built-in tools reach the machine. MCP reaches what the machine isn’t.

**Q2.** Which description correctly separates a plugin from an MCP server?

- A. A plugin is a live connection; an MCP server is a file on disk
- B. A plugin is a bundle of skills, commands and configuration on disk until invoked; an MCP server is a live connection to something outside Claude Code ✅
- C. They are two names for the same thing
- D. A plugin holds only skills; an MCP server holds only commands

*Explanation:* Answer B. One is packaged and waits to be invoked. The other stays open for as long as it is in use.

**Q3.** A colleague says MCP is redundant, since Claude Code can already read files and run shell commands. What is the strongest reply?

- A. MCP replaces the permissions system
- B. MCP is simply faster than built-in tools
- C. Built-in tools can’t read files
- D. Those tools only reach the machine it runs on, and MCP reaches what that machine isn’t: a tracker, a remote database, a running site ✅

*Explanation:* Answer D. The two categories don’t overlap. They cover different ground.

**Q4.** Which of these does NOT need MCP?

- A. Querying a live staging database on someone else’s server
- B. Reading and clicking through a running web page
- C. Searching the project for a function name ✅
- D. Pulling an issue from a hosted tracker

*Explanation:* Answer C. Searching the project is something the built-in tools do on the local machine.

---

## Chapter 4.4: MCP tool tours: dev & design

*Day 04 · Chapter 4.4 · ~15–35 min*

### Topic 33: Dev-tool tour (15 / 15 min)

> **Core idea:** Each MCP server hands Claude Code a different kind of reach outside the repo, so the right one for a given task is whichever server actually touches what that task needs touched — not whichever one happens to already be connected.

- **a. Try it: GitHub MCP — issues & PRs** — Connect it, pull an actual open issue from a repository you’re working in straight into the conversation, then watch Claude Code draft and open a real pull request against it, referencing that issue by number. This is the single most reached-for server in ordinary day-to-day use.
- **b. Browser MCP: live pages** — What this solves that nothing else in the stack does: reading and interacting with a real, currently-running web page — filling in a form, checking what actually rendered, clicking through a flow — none of which a filesystem-bound tool has any way to do.
- **c. Filesystem/DB MCP** — What this reaches instead: a database that lives entirely outside the repo, queryable directly, rather than only through whatever application code happens to be sitting in front of it that day.
- **d. Choosing what the stack needs** — The actual decision rule, stated plainly: connect a server because the task at hand needs the specific reach it provides, never because it happens to be available. A server that’s connected but unused isn’t neutral — it’s dead weight carrying its own permissions surface, and that surface is one more thing that can go wrong for no benefit gained.

**Prompt sketch: from an issue to a pull request**

*Needs the GitHub MCP server connected. It stops for your confirmation before it changes anything.*

```
Using the GitHub MCP server, fetch issue #[number] from [owner/repo].

Read it and tell me what it asks for, in your own words, before changing anything.
Once I confirm, make the change on a new branch and open a pull request that references the issue by number and says what changed and why.
```

### Topic 34: Design-tool tour (— / 20 min)

> **Core idea:** Design tools extend the same MCP reach into UI decisions, so a new screen gets built against what’s already shipped and proven, instead of being invented from a blank page every single time.

- **a. getdesign.md: consistent UI** — What this file actually holds: the project’s existing design language — spacing, color, component conventions — written down once so a new screen gets built to match it by default, instead of drifting quietly into a style of its own the way an unguided build tends to.
- **b. Mobbin MCP: shipped-app references** — What this reaches: a searchable library of real, shipped app screens, pulled in as a working reference so a design decision has an actual precedent behind it — something that’s already been built, tested, and used — rather than being invented from nothing under time pressure.
- **c. Try it: Figma MCP — design-to-code** — Try it against a project you’re working on: pull a real Figma frame straight into a working component, and watch the gap between “a design that exists on a canvas” and “a design that’s actually implemented” close in minutes rather than the days that same handoff usually costs.

**Prompt sketch: from a Figma frame to a component**

*Needs the Figma MCP server connected. Treat the result as a first draft and review it.*

```
Using the Figma MCP server, pull the frame at [Figma frame link].

Build it as a [React / your framework] component that follows the conventions in getdesign.md. Reuse existing components where they exist instead of creating new ones.

Show me the component, plus a short list of anything in the frame you could not match to an existing component or token. This is a first draft.
```

### FAQs

**Q: GitHub MCP is already connected. Can I use it to check what a sign-up form rendered on the staging site?**

A: No. Each server reaches something different. GitHub MCP reaches issues and pull requests. Reading and interacting with a real, running page is the Browser MCP’s job. Pick the server whose reach matches what the task needs touched, not the one that is already connected.

**Q: Is a server that is connected but unused harmless?**

A: No. It is dead weight carrying its own permissions surface, one more thing that can go wrong for no benefit gained.

**Q: The Figma MCP turned a frame into a working component in minutes. Do I still need to review it?**

A: Yes. It is a first output, and Topic 31 applies: treat it as a draft to critique. Closing the gap between a design on a canvas and an implemented one quickly is a speed gain, not a correctness guarantee.

**Q: What is the difference between getdesign.md and the Mobbin MCP?**

A: getdesign.md holds your project’s own design language, such as spacing, colour and component conventions, written down once so new screens match it by default. Mobbin gives you a searchable library of real, shipped app screens from elsewhere, as precedent for a design decision. One keeps you consistent with your project. The other gives you a reference from outside it.

### Practice quiz

**Q1.** GitHub MCP and Filesystem/DB MCP are connected. You need to confirm what rendered after clicking submit on the running staging site. What is the right move?

- A. Use GitHub MCP, since it is already connected
- B. Connect the Browser MCP because the task needs reach into a live page, and don’t use the others just because they’re connected ✅
- C. Use Filesystem/DB MCP, since it is closest to the data
- D. Use Mobbin MCP for a reference screen

*Explanation:* Answer B. The rule is to connect a server because the task needs its reach, not because it happens to be available.

**Q2.** Today’s task is reformatting a set of docs. A teammate suggests also connecting a database MCP server “in case we need it”. What is the best objection?

- A. The task doesn’t need its reach, and a connected server carries its own permissions surface ✅
- B. Databases are unsafe
- C. Only one server can be connected at a time
- D. It would make the docs harder to read

*Explanation:* Answer A. A server that is connected but unused isn’t neutral.

**Q3.** You’re building a new settings screen. Which combination best matches the chapter?

- A. Build it from a blank page so it is original
- B. Use the Browser MCP to scrape another product’s settings page
- C. Use getdesign.md so it matches the project’s design language, and Mobbin for shipped precedent ✅
- D. Use the Figma MCP alone and skip the project’s conventions

*Explanation:* Answer C. A new screen should be built against what’s already shipped and proven, not invented each time.

**Q4.** The Figma MCP produced a component from a frame in minutes. What is the best next step?

- A. Review and critique it as a first output before accepting it ✅
- B. Merge it, since it matches the design
- C. Regenerate it until it looks perfect
- D. Delete getdesign.md, since the frame replaces it

*Explanation:* Answer A. It’s a draft. Topic 31’s habit applies however fast it arrived.

**Q5.** Which pairing of server and reach is correct?

- A. GitHub MCP: live pages. Browser MCP: issues and PRs. Filesystem/DB MCP: design tokens
- B. GitHub MCP: design tokens. Browser MCP: databases. Filesystem/DB MCP: issues
- C. All three reach the same things, with different interfaces
- D. GitHub MCP: issues and PRs. Browser MCP: live pages. Filesystem/DB MCP: a database outside the repo ✅

*Explanation:* Answer D. Each server hands Claude Code a different kind of reach outside the repo.

---

## Chapter 4.5: Commit hygiene

*Day 04 · Chapter 4.5 · ~10 min*

### Topic 35: Commit hygiene (10 / 10 min)

> **Core idea:** A commit is the smallest unit someone else will ever have to review or revert, which is exactly why Topic 1b’s diff-review habit matters more here than anywhere else in the day.

- **a. Reading the diff before approving** — This is Topic 1b’s opened-diff habit and Topic 11b’s critical-reading discipline, arriving at the exact moment both of them were building toward: nothing gets committed that a human hasn’t actually read, line by line, and that human is the one whose name goes on it afterward.
- **b. What makes a good AI commit message** — Hold it to the same bar a good commit message from a person would have to clear: what changed and why it changed, in language a teammate scanning the log six months from now can actually use — not a mechanical restatement of a diff any reviewer can already see for themselves.
- **c. Myth check: catching bundled, unrelated changes** — If every line in this diff does something individually reasonable, is it safe to commit the whole thing as one unit? No. Reasonable and requested aren’t the same test, and Claude Code will occasionally fold in a drive-by fix or a reformatting pass that nobody actually asked for alongside the change that was. Splitting that out before it merges is the difference between a commit history someone can actually read later and one they’ll eventually have to reverse-engineer.

**Prompt sketch: a commit message that says what and why**

*Run it with the diff already staged, after you have read the diff yourself.*

```
Look at the staged diff and write a commit message for it.

First line: what changed, in under 70 characters.
Then a short body explaining why it changed, in language a teammate scanning the log in six months can use.
Do not list files or restate the diff.
```

**Prompt sketch: split out the changes nobody asked for**

*Run it before you commit.*

```
Review the current diff against this goal: [one sentence describing what I asked for].

List every change that is not needed for that goal (renames, reformatting, drive-by fixes). Do not commit anything.
Then propose how to split the diff: one commit for the requested change, and a separate commit for each unrequested change that is worth keeping.
```

### FAQs

**Q: The commit message is accurate and lists every file that changed. What’s wrong with it?**

A: It restates a diff that any reviewer can already see. A good message says what changed and why, in language a teammate scanning the log six months from now can use.

**Q: Claude Code reformatted a file while fixing my bug, and every change looks fine. Why split it out?**

A: Because reasonable and requested aren’t the same test. A bundled drive-by change makes the history harder to read and means reverting the fix also reverts the reformatting. A commit is the smallest unit someone else will ever have to review or revert.

**Q: The tests pass and CI is green. Can I skim the diff?**

A: No. Passing checks tell you the code runs, not whether something nobody asked for was folded in. The diff still has to be read line by line, by the human whose name goes on the commit.

**Q: If the AI wrote the whole commit, who is accountable for it?**

A: The human whose name is on it. That’s why reading the diff is non-negotiable, and why it is the same habit as Topic 1b, arriving at the moment it matters most.

### Practice quiz

**Q1.** The diff contains the requested fix plus a renamed helper and reformatting in two unrelated files. All tests pass. What should you do?

- A. Commit it as one change, since the tests pass
- B. Split the unrequested changes into their own commits, or drop them ✅
- C. Revert everything and start over
- D. Squash it all and mention the extras in the message

*Explanation:* Answer B. A drive-by fix or reformatting pass nobody asked for belongs in its own commit, or not at all.

**Q2.** Which commit message meets the bar?

- A. Update files
- B. Change validate() in checkout.js, add 3 lines to the tests, rename x to y
- C. Fix bug (generated by Claude)
- D. Block checkout when stock is zero: orders could be placed for unavailable items and then failed at fulfilment ✅

*Explanation:* Answer D. It says what changed and why, and it isn’t a restatement of the diff.

**Q3.** “A commit is the smallest unit someone else will ever have to review or revert.” What does that imply?

- A. Commits should be as large as possible
- B. Commit messages are optional for small changes
- C. Each commit should hold one thing that can be reviewed and reverted on its own ✅
- D. Only humans should make commits

*Explanation:* Answer C. If unrelated changes are bundled, reverting one drags the others with it.

**Q4.** Why must a human still read the diff line by line when CI is green?

- A. CI is unreliable
- B. CI checks that it passes, not whether anything unrequested was folded in, and the reader’s name goes on the commit ✅
- C. Git requires it
- D. Claude Code can’t write diffs

*Explanation:* Answer B. Green checks and a read diff answer different questions.

---

## Day 4 recap & takeaways

*Day 04 · Recap · Wrap-up*

The points worth carrying out of the room today, followed by the checkpoint.

### Key takeaways

1. Read before touching. A read-only pass and a short architecture summary come before the first edit, especially when the stack looks familiar.
2. In a large repo the skill is choosing which fraction goes into context. Use retrieval and parallel subagents, and tell grounded answers from guessed ones by whether they name a file and line.
3. Pair a precise verb with a negative constraint. The boundary rules out what a positive instruction leaves technically permitted.
4. The first output is a draft. Name the specific fix rather than saying “try again”, and don’t take “done” at face value on a multi-part change.
5. Built-in tools reach the machine Claude Code runs on; MCP reaches what is outside it. A plugin is a bundle on disk; an MCP server is a live connection.
6. Connect only the server the task needs. Unused connections carry a permissions surface for no benefit.
7. Read every diff line by line, split out changes nobody asked for, and write commit messages that say what changed and why.

### Checkpoint

**Chapter 4 checkpoint**

By the end of this chapter, you should be able to:

- [ ] Run a read-only recon pass on an unfamiliar part of a codebase before making any edit
- [ ] Explain why full-repo context doesn’t scale, and name one strategy for scoping down to what a task actually needs
- [ ] Send two subagents to explore different parts of a large repo in parallel, and keep the main thread clean while they work
- [ ] Rewrite a vague instruction using a precise verb and at least one negative constraint
- [ ] Treat a first output as a draft and name the specific fix it needs, instead of asking Claude Code to “try again”
- [ ] Explain what MCP is, in one sentence, without conflating it with a built-in tool
- [ ] Name which MCP server a given task actually needs, and connect only that one
- [ ] Read a diff line by line before approving it, and catch a bundled, unrelated change inside it

*Anyone who can’t check one of these off knows exactly which topic to revisit before Chapter 5.*

### Up next

Day 5 turns individual habits into things a whole team can reuse: generated docs, SOPs packaged as skills, a disciplined debugging loop, reviewed tests and guardrails.

*[← Day 3: Spec frameworks, decomposition & architecture](Claude_Code_Upskilling_Day3.html)*
