---
name: jookoi-plan-review
description: Review an LLM-written feature implementation plan before coding. Verifies it against the codebase and reports blockers, gaps, and risks.
metadata:
  last_updated: "2026-09-24T00:00:00Z"
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
  version: "1.0"
---

# Review an implementation plan

Find what will break, stall, or cause wasted work when this plan gets implemented, so it's fixed before anyone writes code. Focus on problems that actually matter. If the plan is solid, say so and keep the review short.

## Gather inputs

- **Plan:** use the file or text the user pointed to. If they didn't, use the plan most recently written or discussed in the conversation. If there are several candidates, ask which one.
- **Original request:** what the plan is supposed to achieve. Take it from the conversation, a linked issue or spec, or the plan's own goal section. If you only have the plan's own statement of the goal, say so at the top of the review; you can check consistency but not whether it solves the right problem.
- **Constraints:** stack, non-goals, deadlines, or areas not to touch, if mentioned anywhere.
- **Self-review:** if you wrote this plan earlier in the same session, say so at the top. Self-review tends to confirm its own choices, so be more skeptical than usual.

Don't edit the plan unless the user asks. This skill produces a review.

## How to review

1. **Verify claims before judging them.** Use your tools to check every concrete claim the plan makes: files, functions, APIs, config keys, library versions, existing behavior. LLM plans often reference things that don't exist or work differently than assumed. Track each claim as verified, wrong, or unverifiable.
2. **Compare the plan to the request.** A plan can be internally consistent and still solve the wrong problem, miss part of the ask, or add things nobody asked for.
3. **Walk it as the implementer.** For each step: could I start this right now without guessing? What do I need that this step doesn't give me?

## Areas to consider

These are areas to think through, not sections to fill. Report only what you actually find.

- **Fit:** solves what was asked; nothing missing; no scope creep, unrequested refactors, or abstractions with a single caller.
- **Grounding:** references real code; reuses existing utilities and components instead of reinventing them; follows the repo's conventions for structure, naming, state, errors, and tests.
- **Executability:** every step is concrete (names files, components, and cases instead of "update the relevant components" or "handle errors appropriately"); steps are in a workable order with dependencies explicit; each step is small enough to verify alone; decisions are made now rather than deferred to implementation.
- **Correctness and risk:** edge cases (empty/null, concurrency, failures, permissions, large inputs); data migrations, backfills, compatibility, and rollback; breaking changes to APIs or other consumers; security and privacy; performance traps like N+1 queries, unbounded lists, or bundle growth.
- **Verification:** each step has a concrete check; tests are planned alongside the work, not at the end; "done" is defined in a way someone can confirm.
- **Assumptions:** unstated assumptions the plan depends on, and open questions a human should answer before coding starts.

## Output

Work through the findings first and give the verdict last. Rank findings by impact within each section. An empty section is fine; write "None."

**Blocking issues**: will cause wrong behavior, failed implementation, or significant wasted work.

**Should fix**: real problems that aren't blockers.

**Nits**: optional, one line each.

Write each blocking or should-fix finding in this shape:

> **Step 4: auth refresh call doesn't exist.** The plan calls `useAuthStore().refresh()`, but the store exposes `renewToken()` (`src/stores/auth.ts:42`). The step will fail at runtime. Fix: use `renewToken()` and handle its rejected promise.

That's a short title naming the step, what's wrong with evidence (file and line when you have it), why it matters, and the smallest fix that works. Propose fixes; don't rewrite the plan.

**Unverified claims**: claims you couldn't check, and whether each one matters.

**Questions for the human**: only questions whose answers would change the plan.

**Verdict**: `Ready`, `Ready with fixes`, or `Needs rework`, plus one sentence explaining why.
