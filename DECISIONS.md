# DECISIONS.md — Double Down build history & rationale

This is the "why we built it this way" archive. `CLAUDE.md`'s "Build Status &
Roadmap" covers *what* shipped and what's next; its "Architecture &
Conventions" section covers the *living rules* future code must follow. This
file is purely historical — design forks resolved with the user, correctness
bugs caught and fixed, and tradeoffs accepted on purpose. Organized
chronologically by build step/slice.

---

## v1 — Strategy Trainer

- **Hard 11 vs Ace.** Ships with "always Double 11," including vs. dealer Ace
  — the simpler, widely-taught rule, and what the original spot-check tests
  assert. Some published S17/no-surrender charts say Hit vs. Ace instead. See
  CLAUDE.md's Open TODOs for the follow-up.
- **Category mastery badge** (`mastery.ts`) approximates "rolling accuracy
  over the last N attempts" as lifetime accuracy gated by a minimum attempt
  count, since the adaptive engine only keeps a short per-situation window,
  not a full chronological event log. A true rolling window is a known gap
  (see Open TODOs).

## v2 step 1-3 — Counting math & Running Count drill

- **True count rounds to the nearest whole number** (`Math.round`), per the
  spec's literal "(rounded)" instruction, not the nearest half-deck some
  real-world Hi-Lo practice uses (relevant once index plays, keyed to
  thresholds like +3 or +1, entered scope at step 9 — revisited there, see
  below, and resolved as "keep whole-number rounding").
- **Dealer's hole card was originally revealed at deal time** in the Running
  Count drill (`countingDrill.ts`), rather than only after the dealer plays
  out the hand — a simplification acceptable for a counting-*mechanics* drill
  that only simulates the deal phase, not full hand resolution. Properly
  fixed with correct timing at step 8's `detectionSession.ts` (see below);
  `countingDrill.ts` itself was left as-is since it's still adequate for its
  narrower purpose.
- **Seat count was originally a hardcoded constant (4)** in
  `RunningCountDrill.tsx`; later made configurable via the shared
  `CountingSettings.seatCount` at step 6 (see below) — this gap is resolved,
  not open.

## v2 step 4 — True Count drill

- **Fixed a played-vs-remaining labeling/grading mismatch.** The original
  build had the discard tray's caption say "estimate how many decks have been
  played" directly above an input labeled "Decks remaining (estimate)," which
  grading then used as decks-remaining directly. The math was internally
  self-consistent (traced: RC −3, decks remaining 1.5 → `Math.round(−3/1.5) =
  −2`, matching the reported example) — the bug was the contradictory UI, not
  the formula. Fixed by reframing the estimated quantity as decks **played**
  (matching the tray's fill direction), adding
  `decksRemainingFromPlayedEstimate(numDecks, playedEstimate)` as a named,
  separately-tested subtraction step, and showing the full worked chain in
  feedback.
- **Tick-mark difficulty tiers (3 tiers) are a judgment call**, since the
  original spec didn't define "sparse" precisely: beginner = labeled
  whole-deck ticks + unlabeled half-deck ticks (matching the drill's own ±0.5
  grading resolution); intermediate = labeled whole-deck ticks only; expert =
  none. Default is beginner.
- **`trueCount`'s negative-half rounding** (`Math.round(-2.5) === -2`, not
  `-3`) may disagree with someone manually rounding "by hand" toward the
  larger magnitude. Locked in as a regression test (`trueCountDrill.test.ts`)
  rather than silently changed — this is step 4, the first place a user
  manually redoes the rounding and could notice the disagreement.
- **Scale-reference toggle is idle-phase-only**, unavailable mid-round — an
  inferred constraint (not explicit in the original request) so it can't
  function as a live answer key during grading; a calibration aid for
  before/between rounds only.
- **Switching the Card Counting sub-tab reset the other drill's in-progress
  session** (Running Count vs. True Count unmount each other). Accepted as a
  consequence of deferring persistence to step 6; this specific *in-progress
  round* gap was not actually closed by step 6's persistence work (which only
  persists lifetime stats, not mid-round state) — still true today, see
  CLAUDE.md's Open TODOs.

## v2 step 5 — Shoe Countdown

- **"Back to start" returns to idle**, unlike Running Count/True Count's
  skip-straight-to-next-round pattern — reasoned as correct here because
  personal bests are tracked per shoe size, so a finishing user may want to
  change shoe size before the next attempt.
- **One card revealed per press**, ending on the press taken while viewing
  the last (stop-point) card — an inferred mechanic chosen for the cleanest
  1:1 mapping between "look at a card" and "press." "Give up" abandons
  mid-run with no time recorded and no PB interaction.
- **Fixed a real exploit:** a full shoe always nets to 0 in Hi-Lo, so the
  original build let a user hold spacebar through every card and just type
  "0" to pass, with zero accuracy pressure. Fixed by no longer dealing the
  full shoe: `pickStopIndex(shoeLength, random)` picks a random stop point
  uniformly between `MIN_STOP_FRACTION` (1/3) and `MAX_STOP_FRACTION` (0.9) of
  the shoe at `start()`, the run ends after `stopIndex` cards, and grading
  uses `runningCount(shoe.slice(0, stopIndex))` — not knowable in advance and
  only "accidentally" 0 by chance. The 1/3 floor guarantees a substantial
  counting effort; the 0.9 ceiling avoids always teasing the literal last
  card (itself a predictable tell). The progress display was also changed
  from "Card N of `shoe.length`" to just "Card N" so the denominator can't
  leak proximity to the stop. Verified live via Playwright: 8 repeated
  hold-space-and-guess-0 attempts on a 1-deck shoe all failed (actual counts
  ranged −7 to +5), and a 6-deck run's actual target came back as −10.
- **Accepted, not engineered around:** on long runs, an attentive user can
  narrow the stop window as they approach the 0.9 upper bound (e.g. on a
  1-deck/52-card shoe, the stop always falls in [18, 46]). This is inherent
  to any bounded random stop — moving the ceiling to 1.0 would just relocate
  the same predictability to the other edge. Not a flaw: "exploiting" this
  requires counting every card up to that point anyway, which is the drill
  working as intended.
- **Mid-run checkpoints were considered and deliberately deferred**, not
  built here — a "what's your count right now?" prompt mid-flip is a
  distinct mechanic (pausing the loop, grading an intermediate answer,
  deciding how the count continues) rather than a tweak to this slice. Open
  candidate for a future progression pass.

## v2 step 6 — Settings, reset, persistence

- **Shoe size, seat count, and drill speed were consolidated into one shared
  settings panel**, replacing three drills' separate local selectors —
  `CardCountingTrainer.tsx` now owns `CountingSettings` (`numDecks`,
  `seatCount`, `cardsPerSecond`) and passes it down as props. Tradeoff: a
  user can't run a 1-deck Shoe Countdown and a 6-deck Running Count session
  concurrently without revisiting Settings. Cheap to revert since `numDecks`
  is still just a prop.
- **"Counting system" is a read-only `Hi-Lo` row**, not a selector — only
  Hi-Lo is implemented, so a single-option dropdown would just be clutter.
  Becomes a real selector if a second system is ever added.
- **"Reset progress" only resets v2 counting progress**, not v1's
  streak/stats, unless "Reset everything" is used — separate storage keys
  (`double-down:counting:v1` vs `double-down:v1`). Settings (shoe size,
  seats, speed) are explicitly preserved across a counting-only reset; only
  personal bests and round/accuracy history clear.
- **"Progression" shipped as persisted lifetime counters + personal bests,
  not an automatic difficulty-unlock system** — per the project's standing
  discipline against designing for hypothetical future requirements.
  Difficulty levers (`DECK_ESTIMATE_TOLERANCE`, `MIN_STOP_FRACTION`/
  `MAX_STOP_FRACTION`) remain manual constants, not wired to an
  auto-progression system.

## Step 7.5 — Global settings modal + unified reset

- **Strategy Trainer's internal state was deliberately left untouched.**
  Fixed two real gaps (settings trapped on the Card Counting tab; no reset
  for Strategy Trainer at all) by lifting `CountingSettings`/
  `CountingProgress` to `App.tsx` and adding `clearState()` +
  a `strategyResetKey` prop bump on `<StrategyTrainer key={strategyResetKey}
  />`, rather than lifting `StrategyTrainer`'s internal `stats`/
  `handsPlayed`/`currentStreak` too. The key-bump forces a remount that
  re-runs `useState(() => loadState())` against now-cleared storage — zero
  changes to `StrategyTrainer.tsx` itself. The modal is an overlay (not a
  third tab) specifically so it doesn't unmount whichever trainer is active
  underneath. "Reset everything" is explicitly composed from the other two
  reset functions, not a separate destructive code path.
- **Fixed a real bug surfaced by the lift:** `RunningCountDrill`/
  `TrueCountDrill` only seeded their round counters from `initialProgress`
  once (`useState(initialProgress.x)`), so an external reset while a drill
  was mounted would clear persisted progress but leave on-screen counters
  stale. Fixed with a `useEffect` keyed on `initialProgress` that resyncs
  local state on every change, including the drill's own echo round-trips
  (safe since resyncing to the same values is a no-op).
  `ShoeCountdownDrill` never had this problem — `personalBests` was already
  a pure controlled prop with no local mirror.
- **The settings modal pauses both of the app's time-sensitive mechanics**:
  `RunningCountDrill`'s deal timer and `ShoeCountdownDrill`'s stopwatch +
  keydown handler, via a new `isPaused` prop. `RunningCountDrill` simply adds
  `isPaused` to its `setTimeout` early-return guard (resuming restarts the
  current card's full interval, not exact remaining ms). `ShoeCountdownDrill`
  tracks accumulated paused duration in a ref and subtracts it from the final
  elapsed time at `finishRun()`. Only the two non-click mechanisms
  (`setTimeout`, a `window` keydown listener) needed the guard — other
  buttons are already blocked by the modal's backdrop. Verified live: a
  ~2.5s pause froze the deal count correctly, and a Shoe Countdown run's
  recorded time (880ms) correctly excluded a ~2s pause out of ~3s wall-clock.

## Step 8 — Counter-detection drill family

### Slice 1: single-player binary verdict

Design forks resolved with the user, who does this professionally:

- **Representative deviation set (4 entries):** hard 16 vs 10 (Stand, TC≥0),
  hard 12 vs 3 (Stand, TC≥2), hard 15 vs 10 (Stand, TC≥4), hard 10 vs 10
  (Double, TC≥4) — all real Illustrious-18 entries landing on Hit/Stand/
  Double only. (Superseded by the full 14-entry set at step 9.)
- **Insurance deliberately excluded** — a real, count-sensitive tell (take
  insurance at TC≥+3) but unmodelable: the `Action` type has no insurance
  decision, and hand resolution has no side-bet concept. Needs a new
  decision-point type; tracked in CLAUDE.md's Open TODOs.
- **Bet-spread shape: step/threshold function, not a linear ramp**
  (`BetSpreadStep[]` in `playerProfiles.ts`) — flat at a base unit count
  until the true count crosses a threshold, then jumps higher. Beginner =
  big jump (1→8 units) at TC≥+2; intermediate = smaller jump (1→4) at TC≥+3;
  expert = smallest jump (1→3) at TC≥+4, plus cover bets/deviations layered
  on top. Camouflage escalates via three independent dials (spread ratio,
  trigger threshold, noise).
- **Full hand + dealer resolution with correct hole-card exposure timing.**
  `detectionSession.ts`'s `dealSession` finally resolves the step-3 gap
  above: the hole card is dealt (shoe advances) before the player acts, but
  isn't added to the running count until revealed after decisions lock in.
  Decks-remaining (true-count denominator) tracks physical depletion
  including the not-yet-counted hole card, distinct from the running count
  (numerator, known values only) — covered by a hand-built-shoe unit test in
  `detectionSession.test.ts`.
- **The dealer always plays out their hand to completion**, even on a player
  bust — a sensible default (not a user-confirmed fork) since slice 1
  simulates one seat but real tables have others; keeps the shoe's count
  trajectory realistic.
- **Session length ~25 rounds, a ceiling not a guarantee**
  (`SESSION_ROUNDS = 25`). `generateDetectionSession` clamps to at least
  `MIN_DECKS_FOR_SESSION = 4` decks regardless of the shared `numDecks`
  setting, and a `SHOE_SAFETY_MARGIN` stops the session early/gracefully if
  the shoe runs low.
- **Correlation coefficient dropped from feedback** — the bet-vs-count bar
  chart is the teaching tool; no literal correlation number is shown, to
  avoid training people to hunt a statistic instead of reading the pattern.
- **Mechanic choice: single-player binary verdict (Option A)** over
  evidence-flagging (Option B) or multi-player table scan (Option C) for
  this first slice — the true minimum end-to-end engine, reused unchanged by
  every later slice.
- **No player-side Split.** A dealt pair is played via its hard/soft total
  (`getHardSoftAction`/`getHardSoftSituationKey` in `strategy.ts`, skipping
  the pairs table) — multi-hand bookkeeping wasn't worth it for a feature
  whose signal is bet size and Hit/Stand/Double deviations.
- **Two real correctness bugs caught by this addition:** `hardTotals` only
  defined totals 5-21 and `softTotals` only 13-21, because `getAction()`
  always routes an actual pair through the pairs table first — so hard 4
  (2-2) and soft 12 (A-A) were never reachable. The new bypass functions
  skip that routing, surfacing both gaps as crashes in
  `detectionSession.test.ts`. Fixed by adding `hardTotals[4]` and
  `softTotals[12]` (both "always Hit"), with spot-check regression tests.
  Purely additive — `getAction()` never reads these keys.
- **`dealSession` is split out from `generateDetectionSession`** so tests can
  hand it a fully controlled, hand-built shoe and assert exact
  counting/timing behavior precisely, not just statistically.

**Roadmap captures logged alongside slice 1 (2026-06-24):**
- The future "Live Count Worksheet" phase's session-metadata-header and
  tuned-report concepts could optionally appear in a lighter form within the
  detection drill's feedback view later — not a commitment, just a plausible
  future borrow.
- No auth/backend now. A simple name/date leaderboard (no PII) is a
  plausible low-stakes training-mode feature within the current
  architecture. Real auth + backend is a much bigger, separate step, only
  worth revisiting if the Live Count Worksheet gains real operational
  traction, and only as a deliberate, director-sanctioned decision.

### Slice 2: multi-player table scan

- **Exactly one counter per session, always** — the one genuine new fork.
  Asked directly whether "no one is counting" should ever be the correct
  answer (more realistic, forces judgment every session) vs. always exactly
  one counter among N seats (simpler grading, matches the spec's literal
  wording). User chose **always exactly one counter**
  (`dealMultiPlayerSession` always assigns one seat a `COUNTER_PROFILES`
  tier, every other seat `FLAT_PROFILE`). Revisit if real practice shows
  this lets users shortcut to "pick whichever seat looks most different."
- **Shared shoe, shared running/true count across seats** — the central new
  mechanic. `trueCountAtBet` is computed once per round before any seat's
  cards are dealt. Seats resolve in seat order within the round (slice 1's
  `resolvePlayerHand` via `Array.prototype.map`, synchronous index order), so
  a later seat's `trueCountAtDecision` reflects cards already drawn by
  earlier seats' hits — free extra table realism slice 1 didn't need.
- **Required shoe size scales with seat count**: `generateMultiPlayerSession`
  clamps to `MIN_DECKS_FOR_SESSION + seatCount * 2` decks and scales the
  safety margin by `SHOE_SAFETY_MARGIN_PER_SEAT * seatCount` — the `* 2`
  multiplier was tuned empirically against a 6-seat session landing 1-2
  rounds short of the `SESSION_ROUNDS` ceiling.
- **Seat count reuses the existing shared `CountingSettings.seatCount`**
  (relabeled "Seats (Running Count, Table Scan)"), not a new setting.
- **UI: a compact bet-spread "sparkline" per seat** (`MiniBetBar`/`SeatRow`)
  rather than slice 1's full per-round row repeated per seat — at up to 6
  seats × 25 rounds, the detailed view would be ~150 rows of clutter.
- **Verdict UI is select-a-seat-then-submit**, not click-to-lock-in — a
  separate "Submit: Seat N" button (disabled until chosen) commits the
  verdict, fitting an N-way choice the way slice 1's separate
  Counting/Not-counting buttons fit a binary one.
- **Progress tracked as its own counter** (`tableScan`), separate from
  slice 1's `detection` counter — different skills (binary judgment vs. seat
  ID) and different chance baselines (50% vs. `1/seatCount`). Neither is yet
  surfaced in the Settings panel's Progress section.

### Slice 3: evidence-flagging

Three forks confirmed with the user, since the roadmap explicitly flagged
ground-truth grading as needing design work:

- **Verdict + flagging together**, not flagging-instead-of-verdict —
  `EvidenceDrill.tsx` keeps slice 1's binary verdict and adds round-flagging
  as a second task on the same session, graded and shown separately.
- **Evidence ground truth: a real, uncamouflaged bet-size tell or a real
  count-driven deviation — camouflage explicitly excluded.**
  `isEvidenceRound` = `round.isElevatedBet || round.deviationType ===
  'index'`. Cover bets/deviations don't count — they're the counter's own
  camouflage, and flagging them would be a false-positive judgment in real
  surveillance terms. Required adding `isElevatedBet` to `ComputedBet` and
  threading it through `RoundRecord` in both session engines — purely
  additive; `RoundRecord` is now shared infrastructure across slices 1-3.
- **Grading: precision and recall as two separate numbers**, not one blended
  score — missing real evidence and crying wolf on innocent rounds are
  different failure modes a real reviewer needs to see distinctly.
  `precision` is `null` when nothing was flagged; `recall` is `null` when a
  session has zero real evidence rounds (nothing to catch) — both confirmed
  via dedicated unit tests rather than left as edge cases to discover live.

### Slice 4: evasion mirror

Three forks confirmed with the user, since this slice inverts the engine's
role rather than extending the review mechanic:

- **The true count is shown directly each round**, not tracked by the user —
  keeps this slice scoped to the camouflage *decision* layer (bet sizing +
  deviation choices), leaving the perception/counting layer to the future
  Live Play capstone, which is explicitly defined as the combined task.
- **Decision scope is bet sizing AND deviation choices**, not bet sizing
  alone. Required `resolvePlayerHandWithAction` in `handResolution.ts` — the
  user-driven mirror of `resolvePlayerHand`, taking an explicit chosen action
  instead of rolling a `PlayerProfile`'s rates, deriving `deviationType`
  (`null`/`'index'`/`'cover'`) by comparing the choice to basic strategy and
  the indicated index play. Shared post-decision logic (Hit loop, Double
  draw) was extracted into a private `resolveFromInitialAction` helper so
  both functions stay in sync; `resolvePlayerHand`'s existing tests passed
  unchanged after the refactor.
- **Scoring: Heat + Edge captured, two independent axes** — Heat reuses
  slice 3's `isEvidenceRound` classifier unchanged. Since there's no
  `PlayerProfile` here to define a "base" bet step, the user's own *lowest*
  bet of the session stands in as their personal baseline for
  `isElevatedBet` (computed only after the session ends, since Heat can't be
  shown mid-session without leaking the answer). Edge captured is a
  deliberately simple bet-size × true-count proxy (not a real payout
  simulation), benchmarked against a flat-bettor baseline and an
  aggressive/uncamouflaged-counter baseline over the same true-count
  trajectory the session actually produced — valid because bet size never
  affects which cards get drawn, only play actions do. `edgeCapturedPct` is
  `null` when the aggressive and flat baselines coincide.
- **Structurally interactive (round-by-round)**, unlike slices 1-3's
  generate-then-review shape — `evasionSession.ts`'s `dealRound`/
  `resolveRound` split mirrors slice 1's hole-card-timing discipline but is
  built to be called once per round across separate React events.

## Step 9 — Index plays / Illustrious 18

Three forks confirmed with the user, plus a verification process and a real
source disagreement worth recording given this data's correctness stakes:

- **Scope: a new "Index Plays" drill connecting v1 and v2 directly**, not
  just a backend dataset expansion. The dataset expansion was needed either
  way; the user confirmed the new drill too, as the most literal reading of
  "connects v1's strategy engine with v2's counting engine."
- **Insurance stays excluded** — same reasoning as step 8, confirmed again
  rather than assumed.
- **Dataset: full 17 non-insurance plays, verified against reliable sources
  — two turned out unrepresentable, surfaced only by doing the
  verification:**
  - **Verification method:** cross-referenced three independent sources
    (blackjack3000.com, gamblingcalc.com, a Schlesinger-attributed summary).
    The 13 positive-correlation entries agreed exactly across all three. The
    5 negative-correlation entries did NOT all agree: a fourth source
    (casinonewsdaily.com) gave different thresholds for 12-vs-5 (−1 instead
    of −2) and 13-vs-2 (0 instead of −1) — a real, material disagreement
    between reputable-looking sources. The three agreeing sources' values
    were used; casinonewsdaily's were treated as a transcription error.
  - **Two entries (10,10 vs 5 Split@+5, 10,10 vs 6 Split@+4) are omitted
    entirely**, not just unused by v2 — this dataset is shared by the new
    drill and v2's simulated-counter engine, which never models player-side
    Split. v2's engine would never look these up anyway (it always queries
    via `getHardSoftSituationKey`), but leaving Split-valued entries that one
    consumer can use and the other silently can't felt like the wrong
    default. Final count: 14 entries, not 17.
  - **A third entry (11 vs A, Double@+1) is a genuine no-op in this
    codebase** — v1's `hardTotals[11]` always returns Double regardless of
    dealer upcard (the existing hard-11-vs-Ace gap), but the real
    Illustrious 18 entry assumes a rule variant where basic strategy is Hit
    vs Ace. Since this app already always doubles 11, there's nothing to
    deviate from. Excluded rather than forced in; would become meaningful if
    hard-11-vs-Ace is ever made configurable.
- **The new drill reuses v1's `getAction`/`getSituationKey`** (full
  pairs/Split support), not v2's bypass — it's a decision-only drill (grades
  the choice, never resolves a played-out hand, same v1 scope rule), so
  Split is a perfectly gradable answer here. `generateScenario` weights hand
  generation 70% "targeted" (pick one of the 14 entries, generate that exact
  hand, sample a true count ~50/50 on either side of the threshold so
  resisting a false trigger gets tested as often as taking a real one) and
  30% fully random — a uniformly random deal would land on one of 14
  specific cells too rarely to train anything.

## Step 10 — Live Play capstone

### Slice 1: core loop

Six forks resolved with the user across two rounds of questions, since this
is the biggest build left and several choices reopened sub-questions:

- **Slicing confirmed as proposed by the user.** Slice 1 = play + count
  together; slice 2 = + true-count conversion; slice 3 = + EV bet sizing;
  bankroll/session-scoring pushed to an unscoped "later" bucket. Considered
  giving "play a hand to completion" its own slice before adding counting,
  and rejected it: playing without counting would just rebuild v1's existing
  single-decision drill with extra steps — the *integration* of play and
  count together is what's actually new.
- **No player-side Split was the default everywhere else (steps 8/9's
  shared engine) — the user explicitly chose to break that precedent here.**
  Full Split resolution, not graded-but-unresolved or disabled. A genuinely
  bigger engine than recommended: a multi-hand "queue of hands to play"
  replaces the single-hand loop, since a round can now produce 2-4 player
  hands.
- **Resplitting allowed up to the standard cap (4 hands total)**, not capped
  at one split — the multi-hand state is recursive (a split-result hand can
  itself draw into a new pair and split again, up to the cap).
- **Split Aces: the near-universal real-table rule** — one card each, then
  the hand stands automatically (no further hits, no double), regardless of
  DAS. Confirmed rather than assumed, since the fixed rule set's "double
  after split allowed" wording has no explicit ace carve-out.
- **Single-seat**, not multi-seat — avoids stacking the new multi-decision
  interactive loop (plus full split-tree resolution) with multi-seat dealing
  in the same slice. Multi-seat live play (reusing Running Count's
  `seatCount` mechanic) remains a plausible future enrichment.
- **Running count checked once per hand, revealed immediately afterward** —
  confirmed by re-reading `RunningCountDrill.tsx` directly rather than
  recalling its behavior from memory. Matches that drill's existing pattern
  rather than a stricter no-reveal mode or an unstructured on-demand check.
- **Continuous, open-ended session with lifetime stats**, not a
  fixed-length session with an end summary — matches Running Count/True
  Count's existing shape rather than the detection family's
  bounded-session-then-summary shape. Consistent with the roadmap's own
  deferral of "session scoring" to a later, unscoped bullet. The shoe
  reshuffles (and running count resets to 0) once it runs low mid-session,
  same trigger `RunningCountDrill` already uses.
- **Engine design, worked out before building:** the post-split grading
  story turned out simpler than the "full Split" choice first suggested —
  post-split hands grade against the *same* hard/soft chart as any normal
  hand (DAS already covers doubling; no new chart data needed), so the only
  genuinely new piece is orchestration: a queue of in-progress hands
  processed one at a time, where choosing Split replaces the current hand
  with two new ones (or, for Aces, two immediately-terminal one-card hands).
  The hole card stays uncounted until *all* hands in the queue reach a
  terminal state, then the dealer's hand is compared against each completed
  player hand independently.
- **Two non-obvious correctness fixes caught during implementation, not
  anticipated in planning:**
  - **Split is illegal once the hand cap (4) is reached, but the real pairs
    table doesn't know that.** `correctActionFor` checks for this and falls
    back to `getHardSoftAction` (the same pairs-bypass the detection-family
    engines use) whenever the chart says Split but `canSplit()` says no.
    Caught by reasoning through the cap before writing code; verified with a
    test that drives three real splits to reach 4 hands and confirms the
    5th would-be split is illegal and no longer the graded-correct answer.
  - **Double is illegal after a hand's first decision, but several chart
    cells unconditionally say "Double" regardless of card count** — hard 11
    most notably, reachable via a Hit (e.g. 2+3 hit into +6 = 11) just as
    easily as the initial deal. Naively falling back to "Hit" is wrong:
    checking every Double cell in `hardTotals`/`softTotals` by hand, every
    one collapses to Hit except soft 18 (≥18, already strong enough to
    Stand once doubling for value is off the table). `noDoubleAlternative()`
    encodes "Stand if total ≥ 18, else Hit" — regression-tested for both the
    hard-11→Hit case and the soft-18→Stand case.
- **`ActionButtons.tsx` gained an optional `actions` prop** (defaulting to
  all five) rather than a new component — Live Play passes
  `legalActions(round)` to restrict buttons after the first decision; no
  existing call site needed to change.
- **No new shared "multi-hand display" component** — `HandDisplay` assumes
  exactly one player hand, so a small local `HandGroup` was built directly
  inside `LivePlayDrill.tsx` (active hand ring-highlighted, completed hands
  labeled Stood/Busted/Surrendered, then Win/Lose/Push/Busted once the
  dealer resolves), consistent with `DetectionDrill.tsx`'s precedent of
  defining one-off subcomponents locally.
- **In-hand decisions get inline, non-blocking feedback; round-boundary
  moments get an explicit click.** Choosing an action immediately shows
  "Correct!"/"Incorrect — correct play was X" alongside the next decision's
  buttons, without forcing a "Continue" click in between — clicking through
  a Hit-Hit-Hit sequence one acknowledgment at a time would be tedious. An
  explicit click is still required at the two real checkpoints (round
  complete → count check, count check → next hand).
- **Live Play needs no `isPaused` prop** — every transition is click-gated,
  so the settings modal's backdrop already blocks interaction with no extra
  wiring, unlike Running Count's deal timer or Shoe Countdown's stopwatch.
- **Lives as a third top-level tab ("Live Play")**, not nested under Card
  Counting's already-crowded sub-nav — a plain decision during planning
  (not put to a formal fork) given its low stakes and reversibility.

### Slice 2: + true-count conversion

One fork confirmed with the user, since the roadmap had explicitly left it
open: should the user re-estimate decks remaining themselves (stacking
deck-estimation + division + recall into one combined skill test), or should
the engine show decks-remaining directly so this slice isolates just the
running-count → true-count conversion step?

- **User confirmed: engine shows decks remaining.** Deck estimation is
  already trained standalone by the True Count drill, so re-testing it here
  would conflate two skills. `decksRemaining(state)` in `livePlaySession.ts`
  computes `(shoe.length - position) / 52` directly from session state — no
  estimation step, no tray visual, no tick marks (those stay specific to the
  True Count drill).
- **Both the running count and the true count are entered and graded at the
  same once-per-hand checkpoint**, not the true count replacing the
  running-count entry — running-count tracking stays graded independently
  (`countAttempts`/`countCorrect`, unchanged) alongside a new, separate
  true-count stat (`trueCountAttempts`/`trueCountCorrect`) — three
  independent stats total (play/count/true-count), mirroring the True Count
  drill's estimate/math split.
- **Reuses `trueCount()` from `counting.ts` unchanged** — no
  `gradeTrueCountMath`-style duplication was needed since there's no
  separate "what decks-remaining figure was supplied" question to thread
  through; the engine's own `decksRemaining(state)` is the only input.
- **No new component-level tests** (consistent with the rest of the
  codebase). Added a `decksRemaining` test block to `livePlaySession.test.ts`;
  verified the full checkpoint UI live via Playwright, confirming the math
  end-to-end (e.g. RC −2 with 5.9 decks remaining → true count
  `round(−2/5.9) = 0`, matching the on-screen value) across multiple
  consecutive hands with both stats updating independently.

### Slice 3: + bet sizing for EV

Two forks confirmed with the user before building:

- **Bet graded against the just-revealed actual true count**, not the
  user's own TC guess — same reasoning as slice 2: isolates "can you size a
  bet correctly for a given count" from "can you count," rather than
  compounding a counting error into the bet grade too. The betting phase
  happens immediately after the count-check feedback reveals the actual TC,
  and that same TC is displayed again at the betting prompt (`pendingTrueCountForBet`)
  rather than relying on the user to remember it from the previous screen —
  consistent with handing over the known quantity to isolate the new skill,
  the same way slice 2 hands over decks-remaining instead of making the user
  re-estimate it.
- **Grading: discrete preset bet tiers with exact match**, not a continuous
  "EV captured %" benchmarked against baselines (the technique step 8 slice
  4's evasion drill uses for its Edge-captured metric). Chosen to keep the
  same stat shape as Live Play's other three metrics (play/count/true-count
  accuracy — all `attempts`/`correct` counters), rather than introducing a
  differently-shaped session-level percentage just for this one stat.
  `betAttempts`/`betCorrect` was added to `CountingProgress.livePlay` as a
  fourth independent counter.
- **The bet ramp (`EV_BET_RAMP` in `livePlaySession.ts`) is a judgment call,
  not a single objectively-correct chart** — unlike the Illustrious 18
  strategy deviations (multi-source verified), optimal bet-spread width
  depends on bankroll and risk-of-ruin tolerance, which this trainer doesn't
  model. Shipped as a deliberately conservative, widely-taught ramp (1 unit
  at TC≤1, 2 at TC≥2, 4 at TC≥3, 6 at TC≥4, 8 at TC≥5, capped at 8 to match
  the existing detection-family `beginner` profile's max spread rather than
  introducing a new unit value), reusing `BetSpreadStep`/`baseBetUnits` from
  `playerProfiles.ts` instead of duplicating the step-function logic. The
  preset bet buttons (`BET_TIERS`) are derived directly from the ramp so the
  choices and the grading can never drift apart. Tunable if this judgment
  changes — flagged as a convention, not a fact, in CLAUDE.md.
- **No new engine state was needed for betting** — no bankroll, no win/loss
  tracking (both explicitly deferred to the unscoped "Step 10, later"
  bucket). The bet phase is purely a graded decision point bookended by
  "Place your bet" and "Deal hand," with no effect on dealing or grading
  elsewhere in the round.
- Verified live via Playwright: the first bet (TC 0, 1 unit) graded
  Correct; a deliberately wrong bet (TC 0, 4 units) graded Incorrect with
  the correct tier shown; all four Live Play stats (play/count/true-count/
  bet accuracy) updated independently across a multi-round session, and the
  play loop continued normally into the next hand afterward.

## v2 scoping pass — closing the step 10 "later" bucket, sequencing steps 11-12

After step 10's three slices shipped, the user asked for an honest
scoping/sequencing pass on the rest of v2 before committing further work —
not a "plan because asked," an actual recommendation on what to skip.

- **Step 10's "later" bucket (bankroll tracking + session scoring) — closed
  as WON'T-BUILD, not deferred.** Three reasons, given as a real
  recommendation rather than a default plan: (1) it demonstrates no new
  engineering value over what the capstone's three slices already proved —
  payout math is the least interesting part of blackjack to show off; (2) it
  is thematically player-side, directly at odds with the app's repeatedly-
  stated surveillance/observer framing — every other drill in the app
  (including the evasion mirror) deliberately avoided real payout
  simulation for exactly this reason; (3) building real bankroll tracking
  requires a payout engine that doesn't exist anywhere in the codebase, and
  session scoring would require reopening slice 1's deliberate, documented
  choice to make Live Play continuous and open-ended with no end summary —
  reversing an intentional decision for low payoff. User confirmed this
  recommendation outright, including the surveillance-framing argument
  specifically.
  - **The one approved exception:** a flavor-only "net units this session"
    display line, computed from data Live Play already has
    (`handOutcome()` + the bet size already chosen each round) — no
    bankroll, no payout engine, no persistence. Originally floated as a
    footnote to fold into step 11 rather than build standalone (cheaper to
    add once during the visual pass than to build, style, then restyle).
    The user's approval message initially left this as an unfilled
    placeholder; clarified via a follow-up question before scoping step 11,
    and confirmed: include it.
- **Sequencing: step 11 (visual pass) next; step 12 (Live Count Worksheet)
  as a separate, non-blocking async track — not "step 11 then step 12,"
  but explicitly "step 11, with step 12 outside the dependency chain
  entirely."** Step 12 is gated on a PII/compliance review plus external
  input from the user's workplace Training Agent — a timeline the user does
  not control. Step 11 has real portfolio value (a polished, presentable
  demo) and zero external dependency. Recommended, and the user confirmed,
  that **v2 is considered "done for portfolio purposes" at the end of step
  11** — step 12 does not gate moving on to a new portfolio project, and may
  never land in the public repo at all depending on what compliance review
  and the Training Agent say. The only real sequencing constraint flagged
  and resolved: decide the bankroll/net-units question *before* step 11, so
  the visual layout doesn't need to reserve space for a stat that's later
  cut, or get redone to fit one added afterward.

## Step 11 — Visual polish (table layout / whole-app presentation pass)

**Explicit, user-set scoping constraint carried through the whole step:**
this is the kind of work with no objective "done," so the plan fixed a
tight, finite scope and a hard stopping rule up front — once the bounded
scope and the done-criteria are met, stop; anything noticed afterward is a
dated follow-up note, not grounds to reopen the step. This section is the
record of where that line was actually drawn.

**Scope, fixed before any code:** shared design tokens/primitives; an
abstract felt "seat-frame" panel (not a literal illustrated table); a
shoe-rack visual pairing with the existing discard tray; consistent
card/button/label styling; applied across every tab. Explicitly NOT in
scope: bankroll/payout simulation beyond the one approved net-units line,
animations, custom art assets, a theme switcher, responsive/accessibility
audits, or any logic changes beyond that one flagged exception.

**Three forks resolved with the user, all in the direction of the
recommended (lower-risk, tighter-scope) option:**
- **Abstract felt panel + spacing cues, not a literal curved/illustrated
  table.** Lower effort, fits the app's existing clean/minimal aesthetic,
  avoids the risk of a more ambitious literal table looking cheesy if not
  well executed. `TableFelt.tsx` is a plain rounded panel
  (`bg-gradient-to-b from-emerald-950/50 to-emerald-900/20`) framing a
  dealer slot and a seats slot — no SVG, no illustrated table edge.
- **Felt-green confined to the table panel only; the rest of the app keeps
  its current dark-slate chrome.** No full-app recolor. `theme.ts`'s
  `FELT_PANEL` token is the only place the green accent appears; the header,
  nav, and every non-table surface stayed on the existing `bg-slate-900`/
  `bg-slate-800` palette, just consolidated into shared tokens rather than
  repeated ad-hoc strings.
- **Seat-frame treatment only where a single hand-vs-dealer view reads
  naturally as a table** (Strategy Trainer, Index Plays via the shared
  `HandDisplay` component, and Live Play) — not applied to Table Scan's
  dense sparkline-per-seat layout, which keeps its existing structure
  untouched (token/color consistency only, in slice B) since that density
  was a deliberate, already-documented tradeoff (see step 8 slice 2's
  entry above) against ~150 rows of clutter at 6 seats × 25 rounds.
  Rebuilding it into literal seat slots for visual conformity would have
  undone that tradeoff for no real gain.

**Slicing:** foundation first (slice A — tokens, global chrome, restyled
shared primitives, the new `TableFelt`/`ShoeRack` components), verified on
two representative tabs before any further rollout, exactly the same
foundation-first discipline used for every other multi-step build in this
project. Slice B (applying the foundation to the remaining ~8 tabs) is
explicitly held until slice A's redeploy-and-verify.

**Slice A implementation notes:**
- **`HandDisplay.tsx` is shared by three consumers** (Strategy Trainer,
  Index Plays, and the Evasion drill), so restyling it once to use
  `TableFelt` propagated the felt treatment to all three "for free" —
  Index Plays and Evasion picked up the new look without being touched
  directly, the same high-leverage effect already used for `PlayingCard.tsx`
  (every card everywhere) and `ActionButtons.tsx` (every Hit/Stand-style
  button everywhere). Not a scope violation: these are the same shared
  primitives the two verification tabs (Strategy Trainer, Live Play) use,
  not bespoke per-drill work pulled forward from slice B.
- **`ShoeRack.tsx` is a new, separate component from the True Count drill's
  existing `DeckEstimateTray.tsx`**, not a reuse — `DeckEstimateTray` is
  specifically built for the *estimation* framing (tick marks, difficulty
  tiers, "guess how much is played"). Live Play already has a known,
  computed `decksRemaining` value; showing it doesn't need any estimation
  machinery, so dragging in ticks/difficulty would import unused complexity.
  The two components intentionally share the same visual texture (the
  repeating-gradient "card stack" fill) for family resemblance, with the
  small CSS duplicated directly rather than extracted — consistent with the
  project's standing preference against premature shared abstractions for a
  few lines of style.
- **The net-units exception's actual mechanics:** `netUnitsForRound()`
  (new, tested function in `livePlaySession.ts`) weights every hand in a
  resolved round by the single bet placed before that round and a fixed
  outcome multiplier (win +1, lose/bust −1, push 0, surrendered −0.5).
  Deliberately does not model double or split bet-doubling (a real table
  requires an equal extra wager per split hand, and double doubles the
  original wager) — flagged explicitly in the function's own doc comment as
  a simplification, since this is a derived, non-persisted flavor number,
  not a graded or audited mechanic. `LivePlayDrill.tsx` carries the current
  bet forward in a small local `currentBetUnits` state (set in `chooseBet`,
  read when the dealer resolves) since `betFeedback` itself is cleared
  before the round it applies to actually finishes. This was the one
  explicitly pre-approved exception to "presentation only" for this slice;
  every other diff this slice touched is JSX/className-only.
- **Verification:** full test suite went from 247 to 249 — confirmed by
  diffing the test files that the increase is exactly two new tests for
  `netUnitsForRound` (the flagged exception's logic), with zero existing
  assertions modified anywhere, including `persistence.test.ts` (untouched,
  since the net-units line adds no persisted state). Live-verified on
  Strategy Trainer (felt panel, restyled cards, action buttons, feedback
  colors) and Live Play (felt panel around the dealer/hand area, the shoe
  rack replacing the old bare-text decks-remaining line, and the net-units
  line updating correctly — e.g. +1.0 after a won 1-unit hand).

## Full rule matrix (Pass 1 of 3) — deck size × soft-17 × surrender mode

Extends the strategy engine from one fixed rule set (6 decks, H17, DAS,
optional late surrender) to a matrix of deck size (1/2/6 — the exact
values `shoe.ts`'s `SHOE_SIZE_OPTIONS` already offers), dealer soft-17 rule
(H17/S17), and surrender mode (none/late), for Basic Strategy Trainer and
Live Play only — the same two-mode scope `lateSurrender` already had.
Correctness-critical: a wrong cell teaches a wrong play, so every changed
cell had to be cited, and anything that couldn't be reliably sourced was
dropped rather than guessed.

**Sourcing pivoted through three methods before landing on one that could
be trusted — each rejection is worth keeping on record:**

1. **A blog transcription (readybetgo.com's single-deck H17 chart) — REJECTED.**
   Produced an 11-cell delta list, 5 of which were single-sourced. 3 of
   those (pair 2,2 vs 2, pair 3,3 vs 2/3 → claimed "Hit") were later proven
   flatly wrong: the blog had read a chart's NO-DAS conditional branch
   while this app's rule set always has DAS on — those cells are actually
   Split, matching the base chart, not a delta at all. A wrong cell would
   have taught users to hit pairs they should split.
2. **A manual pixel-read of four official Wizard of Odds chart GIFs —
   REJECTED.** Same author/authority as the already-proven 6-deck source,
   and careful (cross-checked against known-good cells, re-read twice per
   chart) — but still produced a real error: a column-alignment slip on
   the 2-deck "4,4" pair row invented a delta that doesn't exist (the row
   is Split vs 5/6 only, identical to the 6-deck base — matching WoO's own
   4-deck text: "Split 4s only if DAS is allowed and the dealer shows a 5
   or 6"). Since the same careful process produced that error, every other
   image-derived cell was untrustworthy by extension and discarded
   wholesale rather than cherry-picked.
3. **Wizard of Odds' Basic Strategy Calculator, driven by Playwright —
   USED.** Same authority, but this page renders its chart as a real HTML
   table wired to rule-parameter `<select>` inputs and a JS
   `ComputeStrategy()` function — so it can be queried mechanically
   (set the inputs, call the function, read the table's text) instead of
   read by eye. No pixels, no column-counting, no OCR.

**The self-check that makes method 3 trustworthy, kept as a permanent
regression test** (`strategy.chartReference.test.ts`): the calculator's
own 6-deck/H17/DAS-allowed/no-surrender output was diffed against
`hardTotals`/`softTotals` — 0 differences. Its late-surrender output
matched `HARD_SURRENDER_CELLS` exactly, except one cell — which turned out
to be real.

**Correctness fix to already-shipped code, found as a side effect:** pair
8,8 vs dealer A was being surrendered unconditionally whenever late
surrender was on, at every deck size. The calculator resolves that exact
cell as `Rp` — "surrender only if double-after-split is NOT allowed,
otherwise split." This app's rule set always has DAS on, so the cell
should always be Split, never Surrender — the app had been grading it
wrong. `effectivePairs` no longer applies any pair override for late
surrender (the cell was the only one, and it's gone). Pinned by a
dedicated regression test so it can't reappear.

**Early surrender — dropped, not built.** The calculator has no explicit
early-surrender option. The only working proxy (Surrender = any upcard +
Peek = European/no-hole-card) also silently changes unrelated
non-surrender cells — e.g. hard 11 vs 10/A flips from Double to Hit,
because in a true no-hole-card game doubling into a possible dealer
natural is worse EV. That's a real consequence of a *different* rule (no
dealer hole card) this app doesn't model — `handResolution.ts` always
deals and checks a hole card, matching real American peek behavior.
Isolating "just the surrender cells" from that proxy is inference on top
of an already-imperfect proxy, with no independent check on the result —
unlike every other cell in this matrix, which is machine-extracted *and*
self-check-validated. Early surrender is also essentially extinct in real
casinos — Atlantic City, whose rules this app's default follows, offered
it from 1978 and banned it in 1981 for being too player-favorable — so the
payoff for shipping an unvalidated corner is small. Revisit only if a
cleaner source (one that separates surrender timing from hole-card
mechanics) turns up.

**Engine design:** the existing `hardTotals`/`softTotals`/`pairs`/
`getAction`/`getHardSoftAction`/`effectiveHardTotals`/`effectivePairs`
stay completely untouched — every existing caller (detection family,
evasion, table scan, Index Plays) keeps using the boolean surrender-only
path exactly as before. The new `RuleConfig`-aware
`resolveHardTotals`/`resolveSoftTotals`/`resolvePairs`/`getActionForRules`
are additive, used only by `livePlaySession.ts`'s
`legalActions`/`correctActionFor`/`decide` (now taking a `RuleConfig`
instead of a bare surrender boolean — no default, so every call site is
explicit) and, through those, by Basic Strategy Trainer and Live Play.
1-deck gets two complete, independently sourced table sets (H17 and S17 —
NOT shared: pair 9,9 vs A is Split under H17 but base Stand under S17, a
real divergence a shared table would have gotten wrong one way or the
other) rather than deltas layered on the 6-deck base, since the sourcing
history above proved layering isn't safe at 1-deck (soft 18 vs 2 takes a
*third*, different value at 1-deck than either the 6-deck base or the
generic S17 revert would predict). 2-deck is small enough (4 cells for
hard/soft, 2 for pairs, machine-extracted and confirmed non-zero — not the
"reuse 6-deck" assumption an earlier draft of this plan made before the
calculator data existed) to express as literal delta overlays instead.
Index Plays stays pinned to a fixed `{ 6 decks, H17, no surrender }`
`RuleConfig` constant, matching its existing untouched-rule-surface
guarantee from the Index Plays play-out work earlier this session.

## Double-after-split (DAS) as a 4th rule axis

Extends the rule matrix from Pass 1 (deck size × soft-17 × surrender mode)
with a 4th axis: `das: boolean` in `RuleConfig`, default `true` (existing/
current behavior). Matrix is now 3 decks × 2 soft17 × 2 surrender × 2 DAS
= 24 sourced combinations. Same extraction pipeline as Pass 1 (Wizard of
Odds' Basic Strategy Calculator, driven via Playwright, `das` `<select>`
Allowed/Not Allowed) — no new sourcing method needed.

**Why DAS was worth its own pass, not folded into Pass 1 as an
afterthought:** this app had already been bitten twice by DAS-adjacent
errors. The readybetgo blog transcription (rejected during Pass 1
sourcing) had read the NO-DAS branch of several conditional cells (2,2 v
2, 3,3 v 2/3 → Hit under no-DAS, Split under DAS) as if they applied
unconditionally. And the already-shipped pair-8,8-vs-A bug (found and
fixed during Pass 1) exists *because* WoO's calculator codes that cell
`Rp` — "surrender only if DAS is NOT allowed, otherwise split" — meaning
DAS state changes what the correct play even is for that one cell. Adding
DAS as a real, toggleable axis was the way to make both of those errors
structurally impossible to reintroduce, rather than trusting a
DAS-always-on assumption baked silently into the rest of the matrix.

**Mandatory self-check (run first, before trusting any new data):**
re-extracted 6-deck/H17/DAS-ON, both surrender modes, and diffed against
the shipped `hardTotals`/`softTotals`/`pairs`/`effectiveHardTotals(true)`/
`effectivePairs(true)` — 0 differences. The pipeline had not drifted since
Pass 1.

**Finding: DAS is pair-table-only.** Machine-verified across all 24
combinations — zero hard-total or soft-total cells ever differ between
DAS-on and DAS-off, at any deck size or soft-17 rule. This makes
mechanical sense (DAS only changes the EV of a post-split hand's own
double, so it can only move a *splitting* decision) but wasn't assumed —
it's the direct, measured result of the extraction. `resolveHardTotals`/
`resolveSoftTotals` in `strategy.ts` don't take a `das` branch at all, by
design, because there's nothing to branch on; only `resolvePairs` applies
a DAS-off overlay (`DAS_OFF_PAIR_DELTA`).

**Independent validation of the 6-deck DAS-off deltas (2,2v2, 2,2v3, 3,3v2,
3,3v3, 4,4v5, 4,4v6, 6,6v2):** these seven cells exactly match WoO's own
prose on the 4-deck strategy page ("Split 2s and 3s against 4-7, and
against 2 or 3 if DAS... Split 4s only if DAS and dealer 5 or 6... Split
6s against 3-6, and against 2 if DAS") — a second, independent WoO source
confirming the calculator extraction. Also internally self-consistent with
Pass 1's own data: at 1-deck, pair 4,4 vs 5/6 goes to **Double** (not Hit)
with DAS off, because a pair of 4s is a hard 8, and the 1-deck extraction
already has hard 8 vs 5/6 → Double — the DAS pull agrees with the
deck-size pull rather than contradicting it.

**Pair 8,8 vs dealer A — the one cell that's dynamic across the full DAS ×
surrender × deck × soft17 grid.** The naive rule of thumb ("surrender iff
DAS is not allowed") turns out to be wrong outside a specific corner:
Surrender only fires at **2-deck or 6-deck, combined with H17, DAS off,
and late surrender**. It stays Split at 1-deck (any soft17 rule, DAS off
or on) and under S17 at any deck size (DAS off or on) — the WoO EV
crossover for this exact cell only happens in that one combination.
Reported as a correction to an initial hypothesis, not asserted — the
extraction data is the source of truth, not the rule of thumb. Encoded as
a literal, independently-keyed cell list (`DAS_OFF_LATE_SURRENDER_PAIR_CELLS`
in `strategy.ts`, keyed by deck bucket and soft17 rule), not derived from
any other table, and pinned by a dedicated test
(`strategy.chartReference.test.ts`'s "pair 8,8 vs A" describe block) that
walks the full grid rather than spot-checking one cell.

**Slider/DAS interaction — decided, not assumed.** The true-count slider
(Pass 3, `GuidesView.tsx`) shows Illustrious 18 deviations, all 14 of
which are hard-total situations (`indexPlays.ts`). Since DAS produces zero
hard-total deltas (measured above) and the slider never touches a pair
cell, DAS cannot affect anything the slider displays — so the slider stays
gated only to 6-deck (Pass 3's existing gate), with **no new DAS gate and
no new UI caveat**. This is a measured conclusion (DAS's hard-total delta
count is exactly zero, checked across all 24 combinations), not an
assumption that "DAS probably doesn't matter for hit/stand/double." Flagged
directly in `indexPlays.ts` as a code comment noting the dependency: if a
future pass ever adds a pair-based index play (the two real
Illustrious-18 entries this dataset already omits — 10,10 vs 5 and vs 6,
per the Step 9 header comment — are exactly that), DAS becomes relevant
and this no-gate decision must be revisited.

**Where DAS threads through:** `RuleConfig.das` (default `true`);
`CountingSettings.das` in `persistence.ts` (default `true`, with
migration — an absent field parses as `true`, preserving every existing
save's current behavior exactly); a DAS selector in
`CountingSettingsPanel.tsx`; `App.tsx`'s rule badge (previously hardcoded
literal "DAS" text — now reads `rules.das` and shows "DAS" or "No DAS");
`IndexPlayMode.tsx`'s pinned `FIXED_RULES` constant gains `das: true`
(its rule surface stays fixed, unaffected by the live setting, matching
its existing documented behavior); a 4th selector in `GuidesView.tsx`'s
Strategy Chart section, so all 24 combinations are browsable. Detection
family, evasion, table scan, and Index Plays' grading path are untouched —
same scope boundary as every other rule-matrix axis.

## Split limits + split-Aces rules as a config-driven axis

**Source.** An internal Squaxin Island Tribal Gaming Regulatory Agency
training manual (revised 5-11-19) documenting that casino's own posted
rules. **Authoritative for rules only, not for strategy cells** —
`hardTotals`/`softTotals`/`pairs`/the deck-size and DAS overlays in
`strategy.ts` stay entirely machine-extracted from WoO's Basic Strategy
Calculator, per the sourcing discipline established in the earlier rule-
matrix passes. Nothing in this pass touches a chart cell. The document is
7 years old as of this writing; the double-deck ruleset in particular
should be re-confirmed as current before it's treated as authoritative for
a future pass.

**The sourced rules:**
- 6-deck shoe: H17, DAS, double any two cards, split to **4 hands**, no
  re-split Aces, cannot hit split Aces, no surrender, 3:2. This exactly
  matches the app's default `RuleConfig`/`CountingSettings` — independent
  confirmation for that config.
- Double deck: H17, **no DAS**, double any two cards, split to **2 hands
  only**, no re-split Aces, cannot hit split Aces, no surrender, 3:2.

**Audit finding before any code changed.** `livePlaySession.ts` was
already correctly enforcing the 6-deck sourced rules — a hardcoded
`MAX_HANDS = 4` constant, plus `splitHand()` marking a split-Ace hand
`done: true` the instant it's dealt its one card (so it can never become
the active hand again, structurally preventing both re-splitting Aces and
hitting a split Ace — double-enforced by `legalActions` also returning
`[]` for any `isSplitAces` hand). What was actually broken: none of this
was rule-config-driven. Every game — double-deck included — was allowing
a 4-hand split cap, directly contradicting the sourced double-deck rule of
2.

**Chart-cell question — checked, not assumed.** Does the number of
permitted splits affect any basic-strategy chart cell (e.g. does a tighter
split cap change whether pair 8,8 vs 10 should split at all)? Verified
directly: WoO's Basic Strategy Calculator — this app's sole chart-data
source — exposes no resplit / max-splits parameter anywhere in its
interface (confirmed via WebFetch of the calculator page: its inputs are
Decks, Soft 17, Double After Split, Surrender, Dealer Peek — nothing
about split count). **No cell deltas can be sourced for this axis, so
none are inferred.** (Splitting strategy — whether to take the *first*
split — plausibly doesn't depend on a resplit cap that only matters after
that decision is already made, but that reasoning is explicitly flagged as
unsourced theory, not a chart fact, and nothing in the shipped chart
tables relies on it.)

**Why no `resplitAces`/`hitSplitAces` toggles.** Both sourced configs
(6-deck and double-deck) agree on both behaviors — no re-split Aces, no
hitting a split Ace. Adding toggles for axes with zero sourced variation
would be unsourced flexibility, not a real rule surface. Kept hardcoded in
`livePlaySession.ts`'s `splitHand()`, with a comment noting they're
constant across every sourced config this app knows about, not universal
blackjack law.

**`maxSplitHands` typed as `number`, not `2 | 4`.** A two-value union would
bake "only 2 or 4 exist" into the type — split-to-3 is a real rule at some
houses, and a third sourced value later would then be a type change
rippling through `RuleConfig`, `CountingSettings`, `rulePresets.ts`, and
`persistence.ts`, instead of just a new number. Same lesson as the
one-deck pairs table (Pass 1): don't let a convenient assumption become
structural. `RuleConfig.maxSplitHands` is optional (defaulting to 4 via
`effectiveMaxSplitHands`), so the ~35 pre-existing chart-lookup
`RuleConfig` literals in `strategy.chartReference.test.ts` — which never
read this field — needed no changes. `CountingSettings.maxSplitHands` is
required (it's the persisted, always-fully-specified live setting);
`parseSettings` clamps to a generous, non-sourced sanity range
(`[1, 8]`) and falls back to the default of 4 on anything absent,
non-integer, or out of range.

**Third rule preset — "Double Deck (H17 · No DAS)".** 2D/H17/no-DAS/no-
surrender/`maxSplitHands: 2`, per the same training manual. Labeled
generically by ruleset, not by casino, matching the existing presets'
convention of never naming a specific property in a preset label. Unlike
the merged "Washington & Vegas Strip" preset (independently confirmed by
two separate public/regulator sources), this double-deck ruleset rests on
one internal document only — flagged in the header comment as not yet
cross-checked against a second source.

**Gap found during verification, fixed before commit:** the first build of
this pass left `maxSplitHands` settable only via the three presets. Picking
the Double Deck preset (cap 2) and then manually changing deck size to 6
left the user stuck on a 6-deck game capped at 2 splits, with no way back
except another preset. Fixed with a manual "Split to" selector in
`CountingSettingsPanel.tsx` (options 2/3/4 — 3 isn't sourced for any preset
here, but is included since it's a real cap at some houses and
`maxSplitHands`'s whole point is not constraining the type to sourced
values only), independent of and always available alongside the presets —
the same pattern as the existing soft17/surrender/DAS selectors. Chosen
over the alternative (silently resetting `maxSplitHands` to 4 on a manual
deck-size change) because this is a real, user-facing rule axis that
deserves direct control, not a special-cased reset tied to one other
field's changing.
