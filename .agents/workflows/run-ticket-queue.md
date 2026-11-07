# Runbook — Work the iPad ticket queue to completion

**Use when** the user says "run the ticket queue", "follow the runbook", or
similar. You (the main session) are the **orchestrator**: you pick tickets,
start one **worker** subagent per ticket in its own git worktree, merge their
work in order, and keep going until no ticket is left. You don't write
feature code yourself; workers do.

The work is GitHub issues **#4–#11** (sub-issues of the phase specs #1, #2,
#3) in `issaczerubbabela/Artiso-Revamped`. GitHub's native **blocked by**
links on each issue give the order. The planning trail:

- the specs: #1–#3;
- the glossary: `GLOSSARY.md`;
- the phase docs: `docs/phases/phase-11…13`.

## Ground rules (never break these)

- **Never** push to, merge into or rewrite `master`. Merging to `master` happens
  only after the user's real-iPad pass. All work lands on the integration
  branch `ipad/integration`.
- Never force-push, never `--no-verify`, never skip hooks or signing.
- Never close the parent spec issues #1–#3. Only comment on them.
- Every e2e change must pass in **both** `chromium` and `webkit`.
- Follow `CLAUDE.md` in full: commit discipline, the non-negotiable
  invariants, and the Knowledge Items in `.agents/knowledge/`.
- Use the `GLOSSARY.md` terms in code names, UI copy, commits and comments.
- If a decision isn't settled by the ticket, the parent spec, the docs or
  `CLAUDE.md`, don't guess on the data model, sync or pipeline order.
  Mark the ticket **blocked** (see below) and carry on with other work. UI and
  design details may be judgment calls using Dark Matte Studio and
  `docs/design.md`.

## 0. One-time setup (skip any step already done)

1. Make sure `ipad/integration` exists on `origin`. If not, create it from
   `master` and push it. Cloudflare Pages then builds a preview at
   `https://ipad-integration.artiso.pages.dev`.
2. Create these labels if they're missing:
   - `in-progress`: a worker is on it;
   - `blocked`: it needs the user's decision or failed repeatedly;
   - `awaiting-user`: the code is merged but the user must do something,
     e.g. re-run Supabase SQL.
3. Check that `apps/web/.env.local` exists in the main checkout. Workers copy
   it into their worktree, because it's git-ignored.

## 1. How many workers at once

Free memory decides it. Check before **every** new worker starts:

```powershell
$o = Get-CimInstance Win32_OperatingSystem; [math]::Round($o.FreePhysicalMemory/1MB,1)
```

| Free RAM | Workers running at once |
|---|---|
| < 6 GB | 1 |
| 6–10 GB | 2 |
| ≥ 10 GB | 3 (hard cap) |

One worker running a dev server plus Chromium and WebKit uses about 3 GB. The
machine has 15.3 GB in total. The ticket graph never has more than 3 tickets
ready at once anyway.

## 2. Find the frontier

A ticket is **ready** when all of these are true:

- it's open;
- it has the label `ready-for-agent`;
- it doesn't have `in-progress`, `blocked` or `awaiting-user`;
- every issue in its blocked-by list is closed.

```bash
R=issaczerubbabela/Artiso-Revamped
gh issue list -R $R --state open --label ready-for-agent --json number,title,labels
gh api repos/$R/issues/<N>/dependencies/blocked_by --jq '.[] | "\(.number) \(.state)"'
```

An `awaiting-user` ticket counts as **done** for unblocking, because its code
is merged.

Take ready tickets in ascending number order, up to the worker limit.

## 3. Start a worker for each ticket you take

1. Add the `in-progress` label to the issue.
2. Spawn an `Agent` with `subagent_type: "general-purpose"` and
   `isolation: "worktree"`. Give it the prompt below with `<N>`, `<SLUG>` and
   `<PORT>` filled in. Use `PORT = 3100 + N`, so each ticket gets its own
   dev-server port.
3. Don't poll. You'll be notified when the worker finishes. While waiting,
   start more workers if memory and the frontier allow.

### Worker prompt (fill in the placeholders)

```text
You are implementing GitHub issue #<N> in issaczerubbabela/Artiso-Revamped.
You are in your own git worktree. Work fully autonomously and don't ask
questions. Report back when finished.

SETUP
- git fetch origin && git checkout -b ticket/<N>-<SLUG> origin/ipad/integration
- Copy apps/web/.env.local from the main checkout
  (D:\Repositories\Artiso-Revamped\apps\web\.env.local) into the same place
  in this worktree.
- pnpm install --frozen-lockfile

READ FIRST
- The ticket: gh issue view <N> -R issaczerubbabela/Artiso-Revamped
- Its parent spec: the "Parent" issue named in the ticket. Read it in full,
  including the Implementation and Testing decisions.
- CLAUDE.md, GLOSSARY.md, docs/architecture/00-system-overview.md, and the
  module docs, workflows (.agents/workflows/) and Knowledge Items
  (.agents/knowledge/) for the code you touch. Read docs/adr/ if it exists.
- The matching docs/phases/phase-1x-*.md.

BUILD
- Build what the ticket's "What to build" describes and meet every acceptance
  criterion. If an existing workflow covers what you're doing, follow it.
- Test pure logic first (core-engine, renderer maths): write a failing test,
  then make it pass. Test UI behaviour with Playwright through the app.
- Use the GLOSSARY.md terms for names and UI text.
- Commit at meaningful checkpoints, one concern per commit, with messages
  like "feat(renderer): ...". Before any schema or shared-interface change,
  commit the last known-good state first. End every commit message with:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- If the ticket calls for an ADR or a docs/design.md change, write it in the
  same branch. ADRs go in docs/adr/NNNN-title.md.
- Tick the matching items in the phase doc checklist.

VERIFY (all must pass before you report success)
- pnpm typecheck && pnpm lint && pnpm test
- In apps/web:
  E2E_PORT=<PORT> pnpm exec playwright test --project=chromium --project=webkit
  Run the WHOLE suite, not just new specs. Always set E2E_PORT, because other
  workers are running too.
- Check the work against each Knowledge Item in .agents/knowledge/.
- Before reporting, rebase onto the latest origin/ipad/integration and re-run
  the checks if anything changed.
- Push your branch: git push -u origin ticket/<N>-<SLUG>

IF STUCK
- If a check still fails after 3 genuine fix attempts, or you hit a decision
  the docs and spec don't settle (data model, sync, pipeline order), stop.
  Push what you have and report BLOCKED with the exact question or failure
  output.
- Never weaken, skip or delete an existing test to get green. A real
  behaviour change to an existing test must be justified in the commit body.

REPORT (your final message)
- STATUS: DONE or BLOCKED
- Branch name and a list of commits
- What was built, in 3-6 bullets
- Test results: unit and e2e counts for chromium and webkit
- Any user action needed (e.g. Supabase SQL to re-run), with exact steps
- A REAL-IPAD CHECKLIST: 3-8 short steps for the user to try on the iPad
  Air 11" + Pencil Pro at https://ipad-integration.artiso.pages.dev
```

## 4. When a worker reports

**DONE:**

1. In the main checkout, run `git fetch origin`, check out
   `ipad/integration`, then `git merge --no-ff origin/ticket/<N>-<SLUG>`.
   Merge **one ticket at a time**.
2. If there's a conflict, resolve it only if it's trivial. Otherwise use
   `SendMessage` to send the worker back to rebase, and wait for it.
3. On the merged result, run `pnpm typecheck && pnpm lint && pnpm test` and the
   full e2e suite in both browsers, with `E2E_PORT=3099`.
   - If they pass, push `ipad/integration`.
   - If they fail, `git merge --abort` (or reset to the pre-merge tip if
     already committed locally and not pushed) and send the worker back with
     the failure.
4. Comment on the issue with the worker's summary, test results and
   real-iPad checklist.
5. Close the issue and remove `in-progress`. If the user has to do something
   (e.g. ticket #9's Supabase SQL), also add `awaiting-user`, leave the issue
   open, and spell out the step in the comment.
6. Delete the remote ticket branch only after the merge is pushed.

**BLOCKED:**

- Remove `in-progress`, add `blocked`, and comment with the exact question
  or failure.
- Don't retry it yourself. Carry on with other ready tickets.

Then go back to **step 2**.

## 5. Phase wrap-up

When every sub-issue of a phase spec (#1, #2 or #3) is closed or
`awaiting-user`:

- Comment on the spec issue with one combined real-iPad checklist for that
  phase and the preview URL.
- Leave the spec issue open. The user closes it after their iPad pass.

## 6. Finish

Stop when nothing is ready and no worker is running. Then report to the user:

- what merged (issue → merge commit);
- what's `blocked`, with the questions;
- what's `awaiting-user`, with the steps;
- the preview URL and the per-phase iPad checklists;
- a reminder that merging `ipad/integration` → `master` is theirs to do
  after the iPad pass.

## Ticket graph (for reference; GitHub's links are authoritative)

```text
#4 prefactor ─┬─> #5 View Rotation ─> #6 iPad chrome ─┬─> #7 Cell Focus ─> #8 Pencil/touch/Measure ─┐
              │                                       └─> #10 Multitasking                          ├─> #11 Shortcuts
              └─> #9 Drawing Check (needs Supabase SQL re-run by the user)    #7 ──────────────────┘
```

At most three tickets are ever ready at once: #5 and #9 after #4, then #7,
#10 and possibly #9 after #6.
