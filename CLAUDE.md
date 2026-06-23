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

8. **Counter-detection drill (the headline differentiator).** Show a player's bet spread across a shoe alongside the true-count progression, and have the user judge whether the player's betting correlates with the count and whether they're making count-dependent strategy deviations. This trains the actual surveillance skill of spotting advantage players. Build it as its own phase.
9. **(Future depth) Index plays / Illustrious 18** — true-count-dependent strategy deviations that connect the v1 strategy engine with the v2 counting engine, and are also relevant to detection since skilled counters use deviations.

Gate the start of step 1 behind a working, deployed v1. Do not start it before §8 step 10 is complete.

---

## 11. Build notes / TODOs

- **Hard 11 vs Ace.** v1 ships with "always double 11," including vs. dealer Ace — the simpler, widely-taught rule, and what the spec's spot-check tests assert. Some published S17/no-surrender charts instead say Hit vs. Ace for hard 11. TODO: (1) when rule sets become configurable (see "Multiple/selectable rule sets" in the out-of-scope list), make this cell configurable rather than hardcoded; (2) verify which hard-11-vs-Ace play the user's workplace's official chart uses, and default the trainer to match it.
- **Category mastery badge uses lifetime accuracy, not a true rolling window.** `categoryMastery` in `mastery.ts` (step 9) approximates "rolling accuracy over the last N attempts" as lifetime accuracy gated by a minimum attempt count, since the adaptive engine only keeps a short per-situation window, not a full chronological event log. TODO: replace with a true rolling window over the category's last N attempts so recent improvement isn't masked by early errors (e.g. someone who struggled early but has since mastered a category would currently show "Needs work" longer than they should).
- **True count rounds to the nearest whole number, not the nearest half-deck.** `trueCount` in `counting.ts` (v2 step 1) implements the spec's literal "(rounded)" instruction with `Math.round`. Real-world Hi-Lo practice often rounds true count to the nearest 0.5 instead, since that finer precision is what index plays (Illustrious 18) actually key off of. TODO: revisit when v2 step 9 (index plays / Illustrious 18) is in scope — that's the point where whole-number rounding would start costing real precision, since deviations are keyed to specific true-count thresholds like +3 or +1 that a coarser rounding could miss or misfire on.
