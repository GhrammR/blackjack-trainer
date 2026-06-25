# CLAUDE.md — Double Down (Blackjack Strategy & Counting Trainer)

A portfolio + personal-skill app that has grown from a single adaptive blackjack basic-strategy trainer (v1) into a full suite: the original Strategy Trainer, a Card Counting Trainer (Hi-Lo running count, true count, shoe countdown), a counter-detection family built from the casino-surveillance side rather than the player side (single-player verdict, multi-player table scan, evidence-flagging, and a player-side evasion mirror), an Index Plays drill (the verified Illustrious 18, connecting the strategy and counting engines), and an in-progress Live Play capstone integrating real hand play with live counting and (soon) EV-based bet sizing. Fully client-side, zero API cost, deploys as a static site.

> **v1's original definition of done**, kept here for history — see "Build Status & Roadmap" below for what's actually built today: Deployed to a public URL. Presents strategy decisions (hit/stand/double/split/surrender), grades each one against a correct, verified basic-strategy chart, tracks per-situation accuracy, weights upcoming hands toward your weak spots, tracks a 150-hand perfect streak, persists progress across sessions, and ships with a public GitHub repo + README.

This is a legal personal skill trainer — basic strategy and card counting are skilled play, not cheating.

See `DECISIONS.md` for the detailed "why we built it this way" archive behind every shipped slice. This file (CLAUDE.md) is the lean, every-session reference: current scope, roadmap, living conventions, and open TODOs.

---

## Build Status & Roadmap

**This section is the single source of truth for "what's done and what's next."** `DECISIONS.md` is the detailed judgment-call history — read it for *why* something was built a certain way, not for *what's left*. Update this checklist every time a slice ships or a sequencing decision changes.

- ✅ **v1 — Strategy Trainer.** All of §8 steps 1-10. Shipped, deployed, public repo + README.
- ✅ **v2 core — Card Counting Trainer, §10 steps 1-7.** Hi-Lo counting math, Running Count drill, True Count drill, Shoe Countdown (including the random-stop exploit fix), settings/reset/persistence, README update.
- ✅ **Step 7.5 — Global settings modal + unified reset.** Settings lifted to `App.tsx`, accessible from both tabs via a header modal; independent Reset Strategy / Reset Counting / Reset Everything; pause-on-open for the two time-sensitive mechanics (Running Count's deal timer, Shoe Countdown's stopwatch).
- ✅ **Step 8, slice 1 — Counter-detection drill: single-player binary verdict (Option A).** `playerProfiles.ts`, `indexPlays.ts`, `handResolution.ts`, `detectionSession.ts`, `DetectionDrill.tsx`. Three difficulty tiers (beginner/intermediate/expert), full hand + dealer resolution with correct hole-card timing, no player-side split.
- ✅ **Step 8, slice 2 — Multi-player table scan (Option C).** `multiPlayerSession.ts`, `TableScanDrill.tsx`. N seats dealt off one shared shoe each round; exactly one seat is a counter (random difficulty tier), the rest are flat bettors. Reuses slice 1's `PlayerProfile`/`computeBet`/`resolvePlayerHand`/`resolveDealerHand` completely unchanged — only the dealing/round orchestration is new.
- ✅ **Step 8, slice 3 — Evidence-flagging (Option B).** `evidenceGrading.ts`, `EvidenceDrill.tsx`. Adds round-level flagging *alongside* slice 1's binary verdict (not instead of it) on the same single-player session; ground truth for "this round is evidence" = a real, uncamouflaged bet-size tell (`isElevatedBet`) or a real count-driven deviation (`deviationType === 'index'`) — cover bets/cover deviations are explicitly excluded as camouflage, not evidence. Graded with precision + recall, shown separately.
- ✅ **Step 8, slice 4 — Evasion mirror. Step 8 is now fully complete.** `evasionSession.ts`, `evasionScoring.ts`, `EvasionDrill.tsx`. The user plays the counter's seat directly — true count given each round (decision-only, not a counting-skill test), bet sizing + deviation choices are the user's own, single-player, round-by-round and interactive (unlike slices 1-3's generate-then-review shape). Graded on two axes mirroring slice 3's precision/recall split: Heat (rounds that would read as evidence to slice 3's unchanged `isEvidenceRound` classifier) and Edge captured (a bet-size × true-count proxy benchmarked against flat and aggressive-uncamouflaged baselines over the same true-count trajectory).
- ✅ **Step 9 — Index plays / Illustrious 18.** `indexPlays.ts` expanded from the 4-entry representative set to 14 verified entries (the real Illustrious 18 minus Insurance and minus the two Split-based entries, which stay unrepresentable for reasons logged in `DECISIONS.md`). New `indexPlayDrill.ts` + `IndexPlayDrill.tsx` ("Index Plays" tab) is the literal "connects v1 and v2" piece: a live decision drill using v1's full `getAction`/`getSituationKey` (real pairs/Split support) plus a directly-shown true count, weighted so index-play situations come up often enough to actually train. The expanded dataset also automatically enriches slices 1-4's simulated counters with more deviation variety, with no extra wiring needed.
- ✅ **Step 10, slice 1 — Live Play capstone, core loop.** `livePlaySession.ts`, `LivePlayDrill.tsx` (new top-level "Live Play" tab). Play full hands (Hit/Stand/Double/Split/Surrender, real multi-hand resplitting up to 4 hands, standard split-aces rule) against the dealer using v1's real chart, while keeping your own running count, single-seat, continuous/open-ended. Count checked once per hand, revealed immediately, same pattern as Running Count. The first engine in the app where a single round can hold more than one graded decision point — `LiveRound.hands` is a small queue, not a single hand. No true count or bet sizing yet — those are slices 2 and 3. See `DECISIONS.md` for the full design-fork log and two non-obvious correctness fixes (the Split-cap and Double-illegality chart bypasses).
- ✅ **Step 10, slice 2 — + true-count conversion.** Adds `decksRemaining()` to `livePlaySession.ts` and a second graded field to the same once-per-hand checkpoint. The engine hands the user decks-remaining directly rather than asking them to estimate it — confirmed with the user, since deck estimation is already trained standalone by the True Count drill, and re-testing it here would conflate two skills. The user enters both the running count (existing) and the true count (new); each is graded independently (`countAttempts`/`countCorrect` vs. the new `trueCountAttempts`/`trueCountCorrect` in `CountingProgress.livePlay`), mirroring the True Count drill's existing estimate/math split. Reuses `trueCount()` from `counting.ts` unchanged.
- ✅ **Step 10, slice 3 — + bet sizing for EV. Step 10's core capstone build is now complete.** Adds a bet-sizing checkpoint to `livePlaySession.ts` (`EV_BET_RAMP`, `BET_TIERS`, `correctBetUnits()`) and a new `betting` phase to `LivePlayDrill.tsx`. The bet for the next hand is placed right after the count-check feedback reveals the actual true count (isolating bet-sizing as its own skill, same reasoning as slice 2), using a small set of preset unit tiers graded by exact match against `EV_BET_RAMP` — a fourth independent stat (`betAttempts`/`betCorrect` in `CountingProgress.livePlay`), consistent with the other three. Pure value optimization, not the camouflage/heat tradeoff already covered by step 8 slice 4's evasion mirror.
- 🚫 **Step 10, later bucket (bankroll tracking, session scoring) — closed as WON'T-BUILD for v2.** Would require a real payout engine (never built anywhere in this app) and reopening Live Play's deliberately continuous/no-end-summary design — for a player-side feature that cuts against the app's surveillance-side framing and demonstrates no new engineering value over the already-complete capstone. See `DECISIONS.md`. The one approved exception (a flavor-only "net units this session" display line, no payout engine, no persistence) shipped as part of step 11 slice A instead — see below.
- ✅ **Step 11, slice A — Visual foundation + 2-tab verification.** `theme.ts` (shared tokens), `TableFelt.tsx` (abstract felt "seat-frame" panel), `ShoeRack.tsx`, restyled `PlayingCard`/`HiddenCard`, global header/nav chrome polish, plus the approved net-units display line (`netUnitsForRound()` in `livePlaySession.ts`) wired into Live Play. Verified end-to-end on the two representative tabs (Strategy Trainer, Live Play). **NEXT, after this slice's redeploy-and-verify:** slice B — apply the same tokens/components across the remaining tabs (Card Counting's 3 drills, the 4 detection-family drills, Index Plays), per the bounded scope and stopping rule in `DECISIONS.md`. Felt-green is confined to table panels only; the rest of the app keeps its existing dark-slate chrome. Table Scan's dense sparkline-per-seat layout stays structurally unchanged (token/color pass only) — that density was a deliberate, documented tradeoff, not something to undo for visual conformity.
- ⏳ **Step 12 — "Live Count Worksheet" (operational mode, not a training drill). ASYNC, NON-BLOCKING.** Gated behind a PII/compliance review with the user's director and casino IT, plus external input from the workplace Training Agent, before any real player data can be stored. v2 is considered done for portfolio purposes at the end of step 11 — step 12 does not gate that milestone and may never land in the public repo. See §10 step 12 and the related roadmap-capture notes in `DECISIONS.md`.

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

## 11. Architecture & Conventions

Living rules and patterns future code must follow. (See "Build Status &
Roadmap" above for what's shipped, and `DECISIONS.md` for the reasoning
behind each one.)

**Rule set & domain**
- Fixed table rules (§3): 6 decks, dealer stands soft 17, double-after-split
  allowed, no surrender, blackjack pays 3:2. Not configurable yet.
- Hard 11 always Doubles, including vs. dealer Ace (`hardTotals[11]` in
  `strategy.ts`) — the simpler, widely-taught rule. Not rule-set-aware (see
  Open TODOs).
- Hi-Lo is the only counting system (`counting.ts`): 2-6 = +1, 7-9 = 0,
  10/J/Q/K/A = -1.
- True count = `Math.round(runningCount / max(decksRemaining,
  MIN_DECKS_REMAINING))` (`trueCount()` in `counting.ts`). Rounds to the
  nearest whole number, not nearest 0.5. `Math.round` resolves negative
  halves toward +∞ (e.g. -2.5 → -2) — locked in by regression test, not a
  bug.

**Detection-family engine** (`detectionSession.ts`, `multiPlayerSession.ts`,
`evidenceGrading.ts`, `evasionSession.ts`)
- No player-side Split. A dealt pair is played via its hard/soft total using
  `getHardSoftAction`/`getHardSoftSituationKey` (`strategy.ts`), which always
  skip the pairs table. (Live Play, step 10, is the one exception — it does
  support real Split.)
- Hole-card exposure timing: the hole card is dealt (shoe position advances)
  before the player acts, but its Hi-Lo value isn't added to the running
  count until revealed after all player decisions are locked in. Decks
  remaining (true-count denominator) tracks physical depletion including the
  not-yet-counted hole card; running count (numerator) only reflects known
  values. Applies in every session engine, including `livePlaySession.ts`
  (generalized to "until every hand in the queue is done").
- `RoundRecord` (shared across detection-family slices 1-3) carries
  `isElevatedBet` and `deviationType` (`null`/`'index'`/`'cover'`) — additive
  fields, not slice-1-only.
- The dealer always plays out their hand to completion, even on a player
  bust, to keep the shoe's count trajectory realistic.
- Shoe-depletion safety margins scale with what a session actually needs:
  `MIN_DECKS_FOR_SESSION`, `SHOE_SAFETY_MARGIN` (detection), scaled further
  by seat count for multi-seat drills (`multiPlayerSession.ts`).

**Grading philosophy**
- Independent stats over one blended score, wherever a drill tests more than
  one skill: True Count drill (estimate vs. math), Evidence drill (precision
  vs. recall), Evasion drill (Heat vs. Edge captured), Live Play (play
  accuracy vs. count accuracy vs. true-count accuracy). Don't collapse these
  into a single number.
- A metric is `null` (not 0%) when it's undefined for the session (e.g.
  `recall` with zero real evidence rounds, `edgeCapturedPct` when baselines
  coincide) — avoids a misleading 0%.

**Settings & persistence**
- Two independent localStorage keys: `double-down:v1` (v1 strategy trainer:
  `stats`/`handsPlayed`/`currentStreak`) and `double-down:counting:v1` (all
  of v2: settings + every drill's progress, including `livePlay`).
  `persistence.ts` owns both.
- `CountingSettings` (`numDecks`, `seatCount`, `cardsPerSecond`) is one
  shared config object, not per-drill duplicates — every v2 drill reads it
  as a prop. "Counting system" is shown read-only (`Hi-Lo`) since there's no
  second system yet.
- Reset is three independent, separately confirm-gated actions (Reset
  Strategy / Reset Counting / Reset Everything) from a global settings modal
  (`App.tsx` + `GlobalSettingsModal.tsx`). Settings (shoe size, seats, speed)
  survive a counting-only reset; only progress/personal-bests clear.
- "Progression" is persisted lifetime counters + personal bests, not an
  automatic difficulty-unlock system. Difficulty levers
  (`DECK_ESTIMATE_TOLERANCE`, `MIN_STOP_FRACTION`/`MAX_STOP_FRACTION`, etc.)
  are manual tunable constants.

**Time-sensitive mechanics**
- Any drill with a timer or auto-advance (`RunningCountDrill`'s deal timer,
  `ShoeCountdownDrill`'s stopwatch + keydown handler) takes an `isPaused`
  prop, driven by `settingsOpen` in `App.tsx`, so opening Settings mid-drill
  doesn't let cards advance underneath it. Fully click-gated drills (Live
  Play) don't need this.

**Testing & components**
- Logic lives in `lib/*.ts` with thorough Vitest unit tests, including
  spot-check regression tests for anything chart- or math-correctness-
  sensitive. No React component test files exist anywhere in this codebase
  — components are verified live via Playwright driver scripts (written to
  a temp `.cjs` file, run, screenshots reviewed, then deleted), not
  automated component tests.
- Components don't extract shared subcomponents prematurely — one-off
  pieces (`HandGroup` in `LivePlayDrill.tsx`, `SeatRow`/`MiniBetBar` in
  `TableScanDrill.tsx`) are defined locally in the file that needs them.
- Extend shared components via an optional prop with a sensible default
  (e.g. `ActionButtons`'s `actions?: Action[]`) rather than a new component,
  so existing call sites need zero changes.

---

## 12. Open TODOs / Deferred

- **Hard 11 vs Ace.** Currently always Doubles (`hardTotals[11]` in
  `strategy.ts`), including vs. dealer Ace. Some S17/no-surrender charts say
  Hit vs. Ace instead. TODO once rule sets are configurable: make this cell
  configurable, and verify which play the user's workplace's official chart
  uses. (Also blocks one Illustrious 18 entry — 11 vs A, Double@+1 — which
  is currently a no-op since there's nothing to deviate from.)
- **Category mastery badge** (`mastery.ts`) approximates "rolling accuracy
  over last N attempts" as lifetime accuracy gated by a minimum attempt
  count. TODO: replace with a true rolling window so early struggles don't
  mask a since-mastered category.
- **Automatic difficulty progression** — not built. Difficulty levers
  (`DECK_ESTIMATE_TOLERANCE`, `MIN_STOP_FRACTION`/`MAX_STOP_FRACTION`) remain
  manual constants; revisit if real usage suggests auto-tightening would
  add value.
- **Shoe Countdown mid-run checkpoint** — a "what's your count right now?"
  prompt mid-flip (proving continuous counting, not end-cramming) was
  considered and deferred; distinct mechanic from the existing slice,
  candidate for a future progression pass.
- **Insurance** — not modeled anywhere (no side-bet concept in the engine,
  no insurance decision type). A real, count-sensitive tell (take insurance
  at TC≥+3); candidate if insurance is ever modeled.
- **Counting-system selector** — only Hi-Lo exists; the Settings row is
  read-only. Becomes a real selector if a second system (e.g. KO) is added.
- **Card Counting sub-tab switching** still discards an in-progress
  round/shoe in the inactive drill (lifetime stats persist; mid-session
  state doesn't). Known gap, not yet fixed.
- **Detection / Table Scan lifetime stats** aren't surfaced in the Settings
  panel's Progress section yet (other drills' stats are).
- **Negative-half true-count rounding** — `Math.round(-2.5) = -2`, which may
  disagree with someone's manual "round magnitude up" instinct. Currently
  locked in via regression test (`trueCountDrill.test.ts`); revisit if this
  causes real confusion in practice.
- **"Live Count Worksheet"** (§10 step 12) — operational mode, not a
  training drill. Do not build until explicitly started, and only after
  step 8 (done) — but the **PII/compliance gate is the hard blocker**: must
  NOT store real player PII until reviewed with the user's director and
  casino IT. Architecturally independent of the detection drill — no shared
  state, persistence, or grading logic. The detection drill's feedback view
  is a plausible (not committed) place to later borrow a lighter version of
  its session-metadata-header / end-of-session-report concepts.
- **Auth / backend** — none now, by design. A simple name/date leaderboard
  for training mode (no PII) is plausible without changing the
  architecture. Real auth + backend is a much bigger, separate step — only
  revisit if the Live Count Worksheet gains real operational traction, and
  only as a deliberate, director-sanctioned decision.
- **Step 10 slice 3** (bet sizing for EV) — next up; no open design
  questions currently carried forward for it.
