# Pushup Tracking — Design Spec
_2026-05-30_

## Summary
Add pushup tracking (Wide / Standard / Diamond) to the existing GTG Pull Tracker. Mirrors the pull-up structure exactly. No new tabs, no refactor — everything slots into existing components.

---

## Push Types
```js
PUSH_TYPES = [
  { id: "wide",     label: "Wide",     sub: "hands wide · chest focus",  color: "#FF6B6B" },
  { id: "standard", label: "Standard", sub: "shoulder-width · balanced", color: "#FBBF24" },
  { id: "diamond",  label: "Diamond",  sub: "hands close · triceps",     color: "#A78BFA" },
]
PUSH_GOAL_START = 150
```

---

## Data / Storage
Extends the existing `gtg_pull_v1` localStorage key — no migration needed, old fields are untouched.

```js
{
  logs:     { "2026-05-30": { narrow:5, wide:0, neutral:0, chin:10 } },  // unchanged
  pushLogs: { "2026-05-30": { wide:20, standard:15, diamond:10 } },      // new
  weekGoal:  100,    // unchanged
  pushGoal:  150,    // new
  bodyweight: 105,   // unchanged
}
```

Missing `pushLogs` or `pushGoal` on load → treated as empty object / 150 default. No explicit migration required.

---

## State (App component)
New state variables added alongside existing pull state:
```js
const [pushLogs, setPushLogs]   = useState({});
const [pushGoal, setPushGoal]   = useState(PUSH_GOAL_START);
const [pushDraft, setPushDraft] = useState(null);
```

Derived values (same pattern as pull equivalents):
- `savedPushLog` — today's saved push entry or zeroed object
- `todayPushLog` — draft if editing, else saved
- `todayPushReps` — sum of today's push reps
- `pushWeekReps` — sum of all push reps this week (useMemo)
- `pushWeekPct` — pushWeekReps / pushGoal
- `pushAllReps` — all-time push total (useMemo)
- `pushWeekGripReps` — per-type weekly totals (useMemo)
- `pushLast7` — array matching shape of pull `last7`
- `pushLast8weeks`, `pushAllTimeWeeks` — weekly aggregates for charts

Draft handlers: `setPushGripVal`, `savePushDraft`, `cancelPushDraft` — identical pattern to pull equivalents.

---

## TODAY Tab

### Header
Two stacked progress sections, labelled PULLS and PUSHES:
```
PULLS   75 ████████░░ 75% of 100 · X to go
PUSHES 120 █████████░ 80% of 150 · X to go
```
Each shows: rep count, progress bar, percentage, "to go" or "✓ DONE". TONNAGE/ENERGY/KCAL mini-cards remain (pulls only — push energy display is out of scope).

### Inline Logger
A second card below the existing pull card, identical structure:
- Header: "PUSHUPS" label + today's push rep count
- Three rows (Wide / Standard / Diamond) with −, number input, +1, +5, × buttons
- SAVE / CANCEL buttons (same colour logic as pull card — cyan border when dirty)

---

## STATS Tab

Push section added below existing pull content:

1. **All-time cards** — TOTAL REPS / TONNAGE / ENERGY / KCAL (2×2 grid, same style, push colours)
2. **Chart** — same WEEK / MONTH / ALL TIME toggle, stacked bars using PUSH_TYPES colours
3. **All-time by push type** — horizontal progress bars (same style as pull grip breakdown)

---

## LOG Tab (History)

Each history entry gains push data if any pushes were logged that day:
- Push total shown inline with pull total: `15 pulls · 45 pushes`
- Push type pills row below pull pills (same coloured pill style)
- EditLogModal is pull-only — push edits handled by a new `EditPushLogModal` (identical component, PUSH_TYPES instead of GRIPS)

---

## Settings Modal (GoalModal)

Add one field: **WEEKLY PUSH GOAL** (number input, same style as existing fields).

`onSave` signature extends to: `onSave(pullGoal, bodyweight, pushGoal)`

---

## Out of Scope
- Push energy/tonnage on TODAY header (adds clutter, can add later)
- Push-specific history editing via swipe/long-press
- Combining pull + push into a single chart
- Any changes to pull-up logic
