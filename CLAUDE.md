# SPEC.md — Blackjack Adaptive Strategy Trainer

A portfolio + personal-skill app: drill blackjack basic strategy, with an **adaptive engine that finds your weakest decisions and focuses your practice there** until you can run 150 hands with zero errors. Fully client-side, zero API cost, deploys as a static site.

> **Definition of done (read this first):** Deployed to a public URL. Presents strategy decisions (hit/stand/double/split/surrender), grades each one against a correct, verified basic-strategy chart, tracks per-situation accuracy, weights upcoming hands toward your weak spots, tracks a 150-hand perfect streak, persists progress across sessions, and ships with a public GitHub repo + README. That's the whole bar. Nothing below the "Out of scope" line counts toward done.

This is a legal personal skill trainer — basic strategy and (in v2) card counting are skilled play, not cheating.

---

## 1. Scope discipline

**In scope for v1:**
- Drill loop: show a hand (player cards + dealer upcard) → user picks an action → grade vs the correct play → feedback → next hand.
- A correct, verified basic-strategy chart for **one fixed rule set**.
- Adaptive engine: track accuracy per situation, weight the next hand toward weak situations.
- Mastery tracking: a 150-hand perfect-streak goal + per-category accuracy.
- Progress UI: streak, accuracy, and a weakness heatmap.
- Persistence via localStorage (progress survives refresh).
- Deploy to a live URL; public repo with README.

**Out of scope for v1 (do NOT build these now — this is how the project quietly never ships):**
- **Card counting trainer** — that's the fully-specced v2 below. Ship v1 first.
- Multiple/selectable rule sets (v1 fixes one; selectable is a later stretch).
- Full round simulation with betting, bankroll, or payouts. v1 grades the *decision*, not a played-out hand.
- Counting deviations / index plays (Illustrious 18, etc.).
- LLM-generated explanations (static reasons are enough for v1).
- Accounts / cloud sync (localStorage is plenty).

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite + React + TypeScript** | Fast SPA, no backend needed, trivial static deploy. |
| Styling | **Tailwind CSS** | Quick, clean, no bikeshedding. |
| State | React state + a small store (Context or Zustand) | Drill state + progress. Keep it simple. |
| Persistence | **localStorage** | Standalone deployed app — localStorage is the right, normal choice here. |
| Deploy | **Vercel / Netlify / GitHub Pages** | Static SPA, free, gives a live URL. |
| API keys | **None** | Fully offline. Zero running cost. |

---

## 3. Core domain model

- **Card:** `{ rank: '2'..'10' | 'J' | 'Q' | 'K' | 'A', suit? }`. Value: 2–9 face value, 10/J/Q/K = 10, A = 1 or 11.
- **Hand value:** compute the total and track whether it's **soft** (an ace counted as 11 without busting). This soft/hard distinction is essential — the correct play differs.
- **Action:** `'Hit' | 'Stand' | 'Double' | 'Split' | 'Surrender'`.
- **Situation:** the decision point = `(playerHand, dealerUpcard)`, reduced to a stable key:
  - hard totals: `hard-16-vs-10`
  - soft totals: `soft-18-vs-9`
  - pairs: `pair-8-vs-10`
  This key is used both for the strategy lookup and for tracking per-situation stats.
- **Categories:** `hard` | `soft` | `pairs` — used for the progress panel and heatmap.

### Rule set for v1 (fixed)
6 decks · dealer **stands** on soft 17 · double after split **allowed** · **no** surrender · blackjack pays 3:2. This is a standard, common rule set. Making the rule set selectable (which shifts a handful of chart cells) is a later stretch.

---

## 4. The strategy chart (must be correct — it's the whole point)

Encode basic strategy as **three lookup tables**, keyed by player total / pair rank and dealer upcard, returning the optimal `Action`:
- `hardTotals[playerTotal][dealerUpcard]`
- `softTotals[playerTotal][dealerUpcard]`
- `pairs[pairRank][dealerUpcard]`

Resolve the "double else hit" and "split only if double-after-split" nuances for the fixed v1 rule set so each cell returns a single concrete action.

**Correctness requirement:** a trainer that teaches the *wrong* play is worse than no trainer. Source the chart from a reliable basic-strategy reference for this exact rule set and **spot-check known cells** as a test: hard 16 vs 10 → Hit; A-A → Split; 8-8 → Split; soft 18 vs 9 → Hit; hard 11 vs anything → Double; hard 12 vs 3 → Hit; hard 13 vs 6 → Stand. Write these as unit-test assertions so a bad transcription can't slip through.

---

## 5. The adaptive engine (this is the core — get it right)

This is what makes the app a real portfolio piece instead of a flashcard toy. It learns where the user is weak and pushes practice there, while still retaining mastered material.

**Per-situation record:**
```ts
{
  key: string;            // e.g. "soft-18-vs-9"
  attempts: number;
  correct: number;
  lastSeen: number;       // timestamp or hand index
  recentResults: boolean[]; // rolling window, e.g. last 5
}
```

**Weakness score (drives sampling).** For each valid situation, compute a score that is **higher when recent accuracy is lower and when it was missed recently**, with a **baseline for unseen situations** so they still get sampled. Sketch:
```
recentAccuracy = correct-in-window / window-size   (treat unseen as 0)
weakness = (1 - recentAccuracy) * recencyBoost + baseExploration
```
Keep `recencyBoost`, `baseExploration`, and the window size as tunable constants at the top of the file.

**Next-hand selection.** Weighted-random over all valid situations by weakness score — but **floor it with randomness** so mastered situations still recur (retention) and it never feels like grinding the same three hands. Suggested split: ~70% weighted-by-weakness, ~30% uniform random. Tunable.

**Hand generation.** Given a chosen situation key, `handGenerator` produces concrete cards that reproduce it (e.g. for `hard-16-vs-10`, deal 10+6 or 9+7 and a dealer 10; for pairs, deal the pair; for soft, include an ace). Verify the generated hand actually evaluates to the intended total/type.

---

## 6. Mastery & progress tracking

- **Marquee goal — the 150-hand perfect streak.** A streak counter: +1 per correct decision, **resets to 0 on any error**, target 150. Display it prominently ("127 / 150 perfect"). This is the headline challenge.
- **Per-category mastery.** A category (hard/soft/pairs) is "strong" when rolling accuracy over its last N attempts clears a threshold (e.g. ≥95% over the last 20). Drives the heatmap.
- **Weakness heatmap.** A grid of situations colored by strength (weak → strong). This is the at-a-glance "here's what to work on" view and a nice data-viz touch for the portfolio.
- Also track: lifetime accuracy, total hands played, current weakest situations.

**Feedback per decision.** Immediately show correct/incorrect. On a miss, show the correct action + a **short, rule-based reason** (a small static map keyed by category/situation, e.g. "Hard 16 vs 10: you bust often, but the dealer's upcard is strong — you can't win by standing, so hit"). Keep reasons concise. LLM-generated explanations are a v2 optional flourish, not v1.

---

## 7. Project structure

```
blackjack-trainer/
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── StrategyTrainer.tsx   # main drill view
│   │   ├── HandDisplay.tsx       # player hand + dealer upcard
│   │   ├── ActionButtons.tsx     # Hit / Stand / Double / Split / Surrender
│   │   ├── Feedback.tsx          # correct/incorrect + reason
│   │   ├── ProgressPanel.tsx     # streak, accuracy, mastery
│   │   └── WeaknessHeatmap.tsx   # situation strength grid
│   ├── lib/
│   │   ├── cards.ts              # card types + hard/soft hand value
│   │   ├── rules.ts              # rule-set config
│   │   ├── strategy.ts           # the three chart tables + lookup
│   │   ├── handGenerator.ts      # situation key -> concrete cards
│   │   ├── adaptiveEngine.ts     # weakness tracking + weighted sampling
│   │   ├── mastery.ts            # streak + per-category mastery
│   │   └── persistence.ts        # localStorage load/save
│   ├── types.ts
│   └── index.css
├── README.md
└── package.json
```

---

## 8. Build sequence (stay shippable at every step)

Build in vertical slices so the app always runs. **Deploy the empty shell on day one** so "does it deploy" is answered before you've written real logic.

1. Scaffold Vite + React + TS + Tailwind. **Deploy the empty app immediately.** Confirm the live URL.
2. `cards.ts`: card model + hard/soft hand-value calc. Unit-test a few hands (incl. soft→hard ace demotion).
3. `strategy.ts`: encode the three chart tables for the fixed rule set + a lookup function. **Add the spot-check unit tests from §4.**
4. `handGenerator.ts`: situation key → concrete cards. Verify generated hands evaluate correctly.
5. **Static drill loop** (no adaptivity yet): random situation → display → user picks → grade → feedback → next. Get the core loop working and deployed.
6. `adaptiveEngine.ts`: per-situation stats + weakness-weighted next-hand selection.
7. `persistence.ts`: stats + mastery survive refresh via localStorage.
8. `ProgressPanel`: streak + accuracy, and wire up the 150-perfect-streak goal.
9. `WeaknessHeatmap`: the situation-strength grid.
10. Polish UI/feedback/empty states; write README + gif; redeploy. **Done.**

---

## 9. README must include
- One-line description + a screenshot or short gif.
- The stack and the fixed rule set it trains.
- Setup: clone, `npm install`, `npm run dev`.
- The live demo URL.
- A 2–3 sentence "how the adaptive engine works" (tracks per-situation accuracy → weights practice toward weak spots → 150-hand mastery goal).

---

## 10. v2 stretch — Card Counting Trainer (ONLY after v1 is deployed and done)

A second mode/tab. Still fully client-side, zero API cost.

**Framing — this is the whole point of difference.** This trainer is built from the **surveillance / observer side**, not the player side. The user is casino surveillance learning to count players down in review and eventually live — not a player learning to beat the house. Every drill should be designed around what an observer watching a table (or reviewing footage) needs to do: track counts across multiple seats at once, estimate deck depth without being handed the number, and ultimately judge *other people's* play for advantage signals. This is different from a typical player-side counting trainer and should shape drill design choices throughout, not just the headline detection drill.

- **Hi-Lo values:** 2–6 = +1 · 7–9 = 0 · 10/J/Q/K/A = −1.

### Build sequence (v2)

Same vertical-slice discipline as §8: build, verify, and deploy at each step, one at a time, stopping for verification before moving on.

1. `lib/counting.ts` — Hi-Lo card values + running-count + true-count math, with spot-check unit tests (2-6=+1, 7-9=0, 10/J/Q/K/A=-1).
2. Navigation shell — tab/toggle in `App.tsx` between "Strategy Trainer" and "Card Counting." Deploy the empty shell.
3. Running-count drill, dealt as a realistic **observer-seat table** — cards go out to multiple player seats plus the dealer each round, and the user keeps the running count across the whole round from the surveillance vantage point (not single abstract flashing cards). Adjustable speed, configurable shoe size, and mistake feedback (show the actual count and where they likely drifted).
4. True-count drill with **deck estimation** — show a discard-tray / remaining-cards visual and make the user estimate decks remaining, then compute `trueCount = runningCount / decksRemaining`. Don't gift the decks-remaining number. Feedback on both the estimate and the math.
5. Shoe countdown speed drill — flip the full shoe as fast as possible, final count must hit 0, timed with personal-best tracking. (The bridge toward counting live.)
6. Settings + reset + persistence — a lean settings panel for drill speed, counting system, and shoe size; a "reset progress" button with a confirm step; personal bests; progression; extend `persistence.ts`. Do **not** add full strategy rule-set configuration here — that's deferred to a later pass.
7. Polish + README update — document the v2 counting mode, redeploy.

**Hold until steps 1-7 ship and are verified — do not weave these into the core:**

8. **Counter-detection drill (the headline differentiator).** Show a player's bet spread across a shoe alongside the true-count progression, and have the user judge whether the player's betting correlates with the count and whether they're making count-dependent strategy deviations. This trains the actual surveillance skill of spotting advantage players. Build it as its own phase. **Enriched by an evasion/detection pair, built together as part of this same step, not as a separate effort:** detection (the core, job-relevant skill) trains spotting bet-spread-to-count correlation and count-dependent strategy deviations *including when the player is using camouflage/cover plays to disguise them*; evasion (the mirror — modeling the player side: bet-spread camouflage, cover plays, disguised deviations) is what makes the detection trainer realistic in the first place, so the two are two faces of one camouflage system rather than independent features.
9. **(Future depth) Index plays / Illustrious 18** — true-count-dependent strategy deviations that connect the v1 strategy engine with the v2 counting engine, and are also relevant to detection since skilled counters use deviations.
10. **(Future capstone) Live Play mode.** Expanded from the original "Live Simulation" concept (Option B, considered and deliberately deferred during step 4's design — promoted to a capstone rather than discarded) into the full integration of both engines: the user plays actual blackjack hands using v1's strategy engine, keeps the running count from a live seat-dealing table (step 3's mechanic), estimates decks remaining from the discard tray (step 4's mechanic) and converts to true count, AND adjusts bet sizing to maximize EV based on the count — all as one continuous, unbroken task, the way a real player/observer actually works a table live. This is the most realistic and hardest mode, and the trainer's ultimate capstone. Build alongside step 8, after the core (steps 1-7) and the detection drill are solid.
11. **(Future polish) Realistic table layout.** A visual overhaul toward an actual blackjack table (felt, seats, dealer position) in the spirit of established trainers, replacing the current minimal layout. Includes bringing back a visible **shoe rack** alongside the discard tray, so the cards-remaining (shoe) and cards-played (tray) views are both present the way a real table actually presents them — currently only the discard tray exists (v2 step 4). Cross-cutting visual work, not tied to one specific drill.
12. **(Future major phase) "Live Count Worksheet" — an operational mode, NOT a training drill.** Captured as a roadmap item only; do not build until explicitly told to, and only after step 8 (including its still-pending multi-player table scan and evasion mirror) ships and is verified. A separate mode/tab, architecturally **independent of the detection drill** (`DetectionDrill.tsx`/`detectionSession.ts`) — the key difference is that there's no pre-generated ground truth to grade against, since the player being observed is real. This is a work tool that produces a structured report, not a scored exercise, and should not share state, persistence, or grading logic with the training drill even though the two are conceptually related.
    - **Core:** for each betting/playing action the agent observes, fillable fields: (1) follows basic strategy Y/N, (2) running count, (3) true count. Per-shoe Start/End controls, plus the ability to track one player continuously across **multiple shoes** in one session.
    - **Explicit design goal:** usable even by agents who can't count well themselves — the worksheet's structure is what helps determine whether a player was counting, not the agent's own counting skill.
    - **Session metadata header:** Date, Table, Player Name, Player Account Number, Table Games Dealer, Table Games Shift Supervisor, Decks.
    - **End-of-session tuned report** (for the agent's actual write-up): whether the player appears to be counting, their bet spread, bet-pattern type (progressive / chasing / counting / flat / etc.), how many shoes they were counted down, and whether they need to be counted again.
    - **CRITICAL COMPLIANCE GATE, not just a feature note:** this mode would store real player PII (names, account numbers) and constitutes real surveillance data. It must **NOT** store real PII until privacy/regulatory handling is reviewed with the user's director and casino IT. This blocks shipping any persistence for this mode, not just a detail to handle later in passing — treat it as a hard gate on the whole phase, separate from the usual build-sequence discipline.

Gate the start of step 1 behind a working, deployed v1. Do not start it before §8 step 10 is complete.

---

## 11. Build notes / TODOs

- **Hard 11 vs Ace.** v1 ships with "always double 11," including vs. dealer Ace — the simpler, widely-taught rule, and what the spec's spot-check tests assert. Some published S17/no-surrender charts instead say Hit vs. Ace for hard 11. TODO: (1) when rule sets become configurable (see "Multiple/selectable rule sets" in the out-of-scope list), make this cell configurable rather than hardcoded; (2) verify which hard-11-vs-Ace play the user's workplace's official chart uses, and default the trainer to match it.
- **Category mastery badge uses lifetime accuracy, not a true rolling window.** `categoryMastery` in `mastery.ts` (step 9) approximates "rolling accuracy over the last N attempts" as lifetime accuracy gated by a minimum attempt count, since the adaptive engine only keeps a short per-situation window, not a full chronological event log. TODO: replace with a true rolling window over the category's last N attempts so recent improvement isn't masked by early errors (e.g. someone who struggled early but has since mastered a category would currently show "Needs work" longer than they should).
- **True count rounds to the nearest whole number, not the nearest half-deck.** `trueCount` in `counting.ts` (v2 step 1) implements the spec's literal "(rounded)" instruction with `Math.round`. Real-world Hi-Lo practice often rounds true count to the nearest 0.5 instead, since that finer precision is what index plays (Illustrious 18) actually key off of. TODO: revisit when v2 step 9 (index plays / Illustrious 18) is in scope — that's the point where whole-number rounding would start costing real precision, since deviations are keyed to specific true-count thresholds like +3 or +1 that a coarser rounding could miss or misfire on.
- **Dealer's hole card is revealed at the same time as the upcard in the running-count drill.** `dealRound` in `countingDrill.ts` (v2 step 3) treats both dealer cards as visible together for counting purposes. In a real round, the hole card isn't exposed (and so isn't countable) until the dealer plays out the hand after all seats act — a true surveillance count would track that exact exposure timing. This drill simplifies to "deal phase only" rather than simulating full hand resolution (hits, dealer draws) across multiple seats, which would be considerably more machinery for a counting-mechanics drill. This stays as-is in `countingDrill.ts` (still deal-phase-only, fine for a counting-mechanics drill); resolved properly at **step 8** instead — see the step 8 note below for `detectionSession.ts`'s correct hole-card timing.
- **FUTURE SETTING — seat count is a fixed constant (4), not user-configurable.** `RunningCountDrill.tsx` (v2 step 3) hardcodes `SEAT_COUNT = 4`; only shoe size and speed are exposed as settings, per the spec's literal step 3 wording. TODO: when step 6 (settings + reset + persistence) is built, add seat count as a third configurable setting alongside shoe size and counting system, so observers can practice counting down tables of varying size (a 2-seat table counts very differently than a packed 6-7 seat table from the surveillance vantage).
- **True-count drill inherits `trueCount`'s negative-half rounding behavior, which may disagree with manual intuition.** `gradeTrueCountMath` in `trueCountDrill.ts` (v2 step 4) grades a submitted true count against `trueCount(runningCount, estimate)`, which uses `Math.round` — and `Math.round` resolves negative halves toward positive infinity (e.g. `Math.round(-2.5) === -2`, not `-3`). Someone manually dividing and rounding "by hand" might reasonably round -2.5 to -3 (rounding the magnitude up, away from zero) and get graded incorrect even though their instinct is mathematically defensible. This is inherited from step 1's "(rounded)" implementation choice, but step 4 is the first place a user manually redoes the rounding themselves and could notice the disagreement. Locked in as a regression test (`trueCountDrill.test.ts`) rather than silently fixed — revisit if this causes real confusion in practice.
- **FUTURE SETTING — `DECK_ESTIMATE_TOLERANCE` (±0.5 decks) is a fixed constant.** `trueCountDrill.ts` (v2 step 4) hardcodes the estimate-grading tolerance. TODO: when step 6's progression system is built, consider tightening this over time as a difficulty lever (per the spec's "increasing speed/difficulty" progression goal) — e.g. ±0.5 decks for beginners, tightening toward ±0.25 for advanced practice.
- **Switching the Card Counting sub-tab resets the other drill's in-progress session.** `CardCountingTrainer.tsx` (v2 step 4) added a sub-nav between "Running Count" and "True Count," each unmounting the other when not active. Neither drill persists to `localStorage` yet (that's step 6), so switching away and back loses an in-progress round/shoe session in the inactive drill — e.g. leaving a Running Count session mid-shoe to try True Count resets that shoe on return. Known consequence of deferring persistence to step 6, not a regression to fix now; likely resolves naturally once step 6 adds persistence (probably via the same unmount/reload-from-localStorage pattern `StrategyTrainer` already uses).
- **Fixed a played-vs-remaining labeling/grading mismatch in the true-count drill.** The original step 4 build had the discard tray's caption say "estimate how many decks have been played" directly above an input labeled "Decks remaining (estimate)," which the grading then used as decks remaining directly (`trueCount(runningCount, estimate)`). The math was internally self-consistent (confirmed by tracing: running count -3, decks remaining 1.5 → `Math.round(-3/1.5) = -2`, matching the originally reported example) — the bug was the contradictory UI, not the formula. Fixed by reframing the estimated quantity as decks **played** (matching the tray's actual fill direction), adding `decksRemainingFromPlayedEstimate(numDecks, playedEstimate)` as a named, separately-tested subtraction step, and showing the full worked chain in feedback rather than hiding the subtraction.
- **Tick-mark difficulty tiers for the true-count drill's discard tray (3 tiers, exact composition is a judgment call).** `tickMarks(numDecks, difficulty)` in `trueCountDrill.ts` implements: **beginner** = labeled major ticks at every whole deck + unlabeled minor ticks at every half-deck (matches the drill's own ±0.5 grading resolution); **intermediate** = labeled major ticks only, no minor ticks; **expert** = no ticks. This is one reasonable interpretation of "full marks → sparse marks → no marks" — the original spec didn't define "sparse" precisely. Default difficulty is **beginner**. TODO: if user testing shows beginner is still too hard or intermediate too big a jump, retune the tiers (the function is isolated and unit-tested independently of rendering specifically so this is cheap to revisit).
- **Shoe countdown's "Back to start" returns to the idle/setup screen, not straight into a new run.** `ShoeCountdownDrill.tsx` (v2 step 5) departs from `RunningCountDrill`/`TrueCountDrill`'s pattern of skipping idle and going straight into the next round after feedback. Reasoned as appropriate here because personal bests are tracked per shoe size (`PersonalBests` keyed by `numDecks`), so a user finishing one run may want to change shoe size before the next attempt — forcing that choice back through idle makes sense for this drill specifically, unlike the other two where round-to-round settings don't change. Revisit if this extra click feels like friction in practice for users who always drill the same shoe size.
- **Shoe countdown advances one card per press, ending on the press taken while viewing the last (revealed) card.** `ShoeCountdownDrill.tsx` (v2 step 5): pressing Space/Enter or "Next card" while looking at card N reveals card N+1 (or ends the run if N is the stop point — see below), so a run takes exactly as many presses as cards are dealt, with no extra "reveal card 1" press needed (card 1 is shown immediately on Start) and no extra terminal press needed beyond the one taken on the last revealed card. This was an inferred mechanic, not explicitly specified — chosen for the cleanest 1:1 mapping between "look at a card" and "press," which matches how a real speed-count drill feels. "Give up" abandons mid-run with no time recorded and no PB interaction.
- **Fixed an exploit: a full shoe always nets to 0 in Hi-Lo, so the original build let a user hold spacebar through every card without reading any of them and just type "0" to pass.** The known-constant target removed all accuracy pressure, defeating the drill's entire point. Fixed by no longer dealing the full shoe and grading against its (always-zero) total: `pickStopIndex(shoeLength, random)` in `shoeCountdown.ts` now picks a random stop point uniformly between `MIN_STOP_FRACTION` (1/3) and `MAX_STOP_FRACTION` (0.9) of the shoe, computed once at `start()` and stored in state; the run ends after dealing `stopIndex` cards, and grading is against `runningCount(shoe.slice(0, stopIndex))` — a value the user cannot know in advance and which is only "accidentally" 0 by chance. `random` is injectable for deterministic bounds tests. The 1/3 floor guarantees every run is a substantial counting effort; the 0.9 ceiling avoids the run always teasing right up to the literal last card (which would itself become a predictable "it's almost over, so it's probably near 0 again" tell). The second half of the fix was UI, not just math: the progress display was changed from "Card N of `shoe.length`" to just "Card N," since showing the original total would let a user watch the denominator and infer proximity to the stop even with a randomized target. Verified live (Playwright): 8 repeated "hold-space-and-guess-0" attempts on a 1-deck shoe all failed (actual counts ranged from -7 to +5, never landing on the guessed 0), and a 6-deck run's actual target came back as -10, confirming the target is genuinely not always 0.
- **Accepted, not engineered around: on long runs, an attentive user can narrow the stop window as they approach the 0.9 upper bound.** E.g. on a 1-deck shoe (52 cards), the stop always falls in [18, 46], so a user who has counted past card 46 without a stop knows it's imminent. This is an inherent property of any bounded random stop — moving the ceiling to 1.0 (allowing the literal last card) would just relocate the same predictability to the other edge instead of removing it. Not a flaw: a user "exploiting" this is, by construction, counting every card up to that point, which is the drill working as intended, not a workaround for skipping the count.
- **Deferred to step 6: mid-run checkpoints and a fuller difficulty progression.** A "what's your count right now?" prompt mid-flip (proving the count was held continuously, not crammed at the end-point) was considered alongside this fix but deliberately not built here — it's a distinct mechanic (pausing the flip loop, grading an intermediate answer separately from the final one, deciding how the count continues afterward) rather than a tweak to the existing slice. Revisit as part of step 6's progression system, where it fits naturally alongside other difficulty levers (e.g. tightening `MIN_STOP_FRACTION`/`MAX_STOP_FRACTION` over time, akin to the `DECK_ESTIMATE_TOLERANCE` tightening noted above).
- **Scale-reference toggle is idle-phase-only, unavailable mid-round.** `DeckScaleReference` (shown via a toggle in `TrueCountDrill.tsx`) is deliberately only rendered while `phase === 'idle'`, not during `guessing`/`feedback`. This was an inferred constraint (not explicit in the original request) to prevent it from functioning as a live answer key during actual grading — it's a calibration aid for before/between rounds only. Revisit if real usage suggests a mid-round "peek" would have legitimate training value at the beginner tier specifically.
- **Shoe size, seat count, and drill speed were consolidated into one shared settings panel, replacing the three drills' separate local selectors.** Step 6 ("a lean settings panel for drill speed, counting system, and shoe size") read most naturally as ONE shared config rather than three duplicated per-drill controls — `RunningCountDrill`, `TrueCountDrill`, and `ShoeCountdownDrill` previously each owned their own `numDecks` (and `RunningCountDrill` its own speed), so consolidating removes duplication and gives a single source of truth. `CardCountingTrainer.tsx` now owns `CountingSettings` (`numDecks`, `seatCount`, `cardsPerSecond`) and passes it down as props; each drill shows a small read-only summary line ("N decks · N seats · N cards/sec (change in Settings)") instead of an inline selector. Tradeoff: a user can no longer run, say, a 1-deck Shoe Countdown and a 6-deck Running Count session at the same time without revisiting Settings between them. Revisit if that feels like a real workflow people want — the per-drill selectors are cheap to restore since `numDecks` is still just a prop.
- **"Counting system" is shown as a read-only `Hi-Lo` row in Settings, not a selector.** The spec's step 6 wording lists "counting system" alongside drill speed and shoe size as something the settings panel covers, but only Hi-Lo is implemented (the v2 framing section fixes Hi-Lo the same way v1 fixes one rule set) — there is no second system to switch to. Built as an informational row rather than either a single-option dropdown (UI clutter for a choice that doesn't exist) or omitting it entirely (the spec text explicitly names it). Revisit if a second counting system (e.g. KO) is ever added — at that point this becomes a real selector.
- **"Reset progress" resets v2 counting progress only, not the v1 strategy trainer's streak/stats, unless "Reset everything" is used.** `resetCountingProgress` in `persistence.ts` operates on a separate storage key (`double-down:counting:v1`) from the v1 `PersistedState` (`double-down:v1`). (Originally the reset button lived inside the Card Counting Trainer specifically — superseded by the step 7.5 note below, which moved it to a global panel covering both modes with three independent, separately confirm-gated actions.) Settings (shoe size, seats, speed) are explicitly preserved across any counting-only reset — only personal bests and round/accuracy history clear — since those are stored preferences, not progress.
- **"Progression" was built as persisted lifetime counters + personal bests, not an automatic difficulty-unlock system.** Step 6 lists "personal bests" and "progression" as things the settings panel should surface. Per CLAUDE.md's own scope discipline against designing for hypothetical future requirements, this shipped as: Running Count's rounds-played/accuracy, True Count's scenarios/good-estimate-rate/math-accuracy, and Shoe Countdown's per-shoe-size personal bests, all now persisted across reloads (previously all three were ephemeral session state, lost on tab switch or refresh) and surfaced in the Settings panel's Progress section. No automatic tightening of difficulty levers (e.g. `DECK_ESTIMATE_TOLERANCE`, `MIN_STOP_FRACTION`/`MAX_STOP_FRACTION`) based on these counters was built — those remain manual constants, exactly as the earlier TODOs describe ("consider tightening... as a difficulty lever"), not wired to an auto-progression system. Revisit if real usage suggests automatic unlocks would add value over manual tuning.
- **Step 7.5: settings + reset moved to a global modal; Strategy Trainer's internal state was deliberately left untouched.** Two real gaps (settings trapped on the Card Counting tab; no reset for Strategy Trainer progress at all) were fixed by lifting `CountingSettings`/`CountingProgress` up to `App.tsx` (so a global `GlobalSettingsModal` and `CardCountingTrainer` can share them — `CardCountingTrainer` is now a controlled component, same pattern as its own drills one level down) and adding `clearState()` + a `strategyResetKey` prop bump on `<StrategyTrainer key={strategyResetKey} />` for the strategy reset, rather than lifting `StrategyTrainer`'s internal `stats`/`handsPlayed`/`currentStreak` too. The key-bump forces a remount, which re-runs `useState(() => loadState())` against the now-cleared storage — zero changes to `StrategyTrainer.tsx` itself, since only a reset was requested there, not new settings. The modal is an overlay (not a third tab) specifically so it doesn't unmount whichever trainer is active underneath, unlike switching between the existing tabs (which already discards in-progress sessions — see the step-4 note above). The Strategy Trainer section of the modal shows a read-only snapshot (hands played / lifetime accuracy / streak) taken via a fresh `loadState()` call on every `App` render — not lifted, just re-read, since nothing else needed live reactive access to v1's internals. "Reset everything" is explicitly composed from the other two reset functions (calls both), not a separate destructive code path.
- **Fixed a real bug surfaced by the step 7.5 lift: `RunningCountDrill`/`TrueCountDrill` only seeded their round counters from `initialProgress` once.** Both drills used `useState(initialProgress.x)` to seed local counters and only ever pushed updates outward via their own `onProgressChange` — they never read `initialProgress` again after mount. That was harmless while `CardCountingTrainer` owned `progress` itself (the only way `initialProgress` could change WAS the drill's own update echoing back down). Once progress was lifted to `App.tsx`, an external reset (clicking "Reset Card Counting progress" or "Reset everything" in the global modal while a drill happened to be mounted) would clear the persisted progress but leave that drill's on-screen counters stale until it next remounted. Fixed by adding a `useEffect` keyed on `initialProgress` that resyncs local state — safe to fire on every change including the drill's own echo round-trips, since resyncing to the same values is a no-op. `ShoeCountdownDrill` never had this problem since its `personalBests` was already a pure controlled prop with no local mirror.
- **The settings modal pauses both of the app's time-sensitive mechanics while open: `RunningCountDrill`'s auto-deal timer and `ShoeCountdownDrill`'s elapsed-time stopwatch (plus its Space/Enter key handler).** Both drills now take an `isPaused` prop (`App.tsx` passes `isPaused={settingsOpen}` down through `CardCountingTrainer`). `RunningCountDrill`'s deal-timer `useEffect` simply adds `isPaused` to its early-return guard — pausing skips scheduling the next card reveal, and resuming reschedules from wherever `revealedCount` already was (the current card's full interval restarts on resume rather than preserving exact remaining ms; not worth the extra complexity at this scale). `ShoeCountdownDrill` tracks accumulated paused duration in a ref (`pausedMsRef`) plus the timestamp of the currently-open pause (`pauseStartedAtRef`), and subtracts the total from the final `elapsedMs` computed at `finishRun()` — refs rather than state since neither value needs to trigger a render. Its keydown listener also gets `isPaused` added to its guard, since a `window`-level listener doesn't care about the modal's visual z-index — without that guard, Space/Enter presses while the modal was open would silently advance the card underneath. `RunningCountDrill` and `TrueCountDrill`'s other interactive elements (Submit, Next round, etc.) don't need an explicit guard since the modal's backdrop already physically blocks those clicks; only the two mechanisms that don't go through a click (a `setTimeout` and a `window` keydown listener) needed one. Verified live: cards-dealt count was confirmed frozen across a ~2.5s window with the modal open and resumed correctly after closing it; a Shoe Countdown run's recorded time (880ms) correctly excluded a deliberate ~2s pause out of ~3s of total wall-clock time.

- **Step 8 (counter-detection drill) — design forks resolved with the user, who does this professionally:**
  - **Representative deviation set (4 entries, confirmed):** hard 16 vs 10 (Stand, TC≥0), hard 12 vs 3 (Stand, TC≥2), hard 15 vs 10 (Stand, TC≥4), hard 10 vs 10 (Double, TC≥4) — see `indexPlays.ts`. All real Illustrious-18 entries landing on Hit/Stand/Double only.
  - **Insurance deliberately excluded.** A real, count-sensitive tell (take insurance at TC≥+3) but not modeled, because this codebase's `Action` type (`Hit`/`Stand`/`Double`/`Split`/`Surrender`) has no insurance decision, and the hand-resolution engine has no concept of a side bet. TODO: candidate for a later pass once/if insurance is modeled anywhere in the app — would need a new decision point type, not just a table entry.
  - **Bet-spread shape: step/threshold function (confirmed as the primary tell), not a linear ramp.** `BetSpreadStep[]` in `playerProfiles.ts` — flat at a base unit count until the true count crosses a threshold, then jumps to a higher unit count. Beginner = big jump (1→8 units) at a low threshold (TC≥+2); intermediate = smaller jump (1→4) at a higher threshold (TC≥+3); expert = smallest jump (1→3) at the highest threshold (TC≥+4), plus cover bets and cover deviations layered on top. Camouflage escalates via three independent dials (spread ratio, trigger threshold, noise) rather than one.
  - **Full hand + dealer resolution with correct hole-card exposure timing (confirmed, not the simplified alternative).** `detectionSession.ts`'s `dealSession` finally resolves the step-3 TODO above: the hole card is dealt (shoe position advances) before the player acts, but its Hi-Lo value isn't added to the running count until it's revealed after the player's decisions are locked in. Decks-remaining (the true-count denominator) tracks physical shoe depletion — including the not-yet-counted hole card — which is a distinct thing from the running count (the numerator) only reflecting known values; this distinction is precisely covered by a hand-built-shoe unit test in `detectionSession.test.ts` rather than left to chance via real shuffles.
  - **The dealer always plays out their hand to completion, even if the player busted.** Decided (not a user-confirmed fork, just a sensible default) because slice 1 only simulates one seat, but a real table usually has others — always resolving the dealer's hand keeps the shoe's count-progression realistic for what a multi-seat table would actually look like, and avoids bust hands producing a shorter/different count trajectory that could become an inadvertent tell unrelated to the modeled ones.
  - **Session length: ~25 rounds (confirmed), but only a ceiling, not a guarantee.** `SESSION_ROUNDS = 25` in `detectionSession.ts`. An average round consumes ~5-6 cards, so 25 rounds needs more than a 1-2 deck shoe reliably has — `generateDetectionSession` clamps to at least `MIN_DECKS_FOR_SESSION = 4` decks regardless of the shared `numDecks` setting (so a user who set a small shoe size for the speed drills doesn't get a starved detection session), and a `SHOE_SAFETY_MARGIN` stops the session early and gracefully if the shoe still runs low.
  - **Correlation coefficient dropped from the primary feedback (confirmed).** The bet-vs-count visualization (the bar chart, color-coded by true-count sign) is the teaching tool; no literal correlation number is computed or shown, since headlining one risks training people to hunt a statistic instead of reading the pattern the way real surveillance actually does it.
  - **Detection mechanic: single-player binary verdict shipped first (Option A); multi-player table scan (Option C) and evidence-flagging (Option B) explicitly deferred, in that order — evasion mirror deferred further still, as its own later slice within step 8, after both.** All confirmed sequencing from the planning discussion; not built in this slice.
  - **No player-side Split.** A dealt pair is played via its hard/soft total (new `getHardSoftAction`/`getHardSoftSituationKey` in `strategy.ts`, which always skip the pairs table) rather than splitting — multi-hand bookkeeping isn't worth it for a feature whose signal is bet size and Hit/Stand/Double deviations, none of which are pair-based.
  - **Two real correctness bugs caught by this addition, fixed in `strategy.ts`'s tables themselves, not worked around:** `hardTotals` only defined totals 5-21 and `softTotals` only 13-21, because `getAction()` always routes an actual pair through the pairs table first, so hard total 4 (2-2) and soft total 12 (A-A) were never reachable before. `getHardSoftAction`/`getHardSoftSituationKey` deliberately skip that pairs routing, surfacing both gaps immediately as crashes in `detectionSession.test.ts`. Fixed by adding `hardTotals[4]` and `softTotals[12]` (both "always Hit" — the simple, safe default for these never-split-aces/twos edge cases), with spot-check regression tests in `strategy.test.ts`. Purely additive — `getAction()` never reads these keys, so v1's existing correctness tests are untouched.
  - **`dealSession` is split out from `generateDetectionSession`** specifically so tests can hand it a fully controlled, hand-built shoe (not just a real shuffled one) and assert exact counting/timing behavior — this is how the hole-card-exposure-timing nuance above gets a precise unit test instead of just statistical confidence from many random runs.
- **Roadmap capture (2026-06-24): the session-metadata-header and tuned-report concepts from the future "Live Count Worksheet" phase (§10 step 12) could optionally also appear in a lighter form within the training detection drill, to add realism.** Their real home is the operational worksheet — this is just a note that the detection drill's feedback view is a plausible place to borrow the idea from later (e.g. a lightweight "report" summary after a session), not a commitment to build it there. Do not build either version until step 12 itself is reached and explicitly started.
- **Roadmap capture (2026-06-24): no auth/backend now — note the two distinct future paths if this ever changes.** A simple name/date leaderboard is a plausible, low-stakes **training-mode** feature (no real accounts, no PII, fits the current backend-less/free architecture). Real authentication plus a backend is a different, much bigger step that should only be revisited if the "Live Count Worksheet" (§10 step 12) gains real operational traction — and even then, only as a deliberate, director-sanctioned decision, since it changes the app's fundamental architecture away from "fully client-side, zero running cost." Do not build either now.
