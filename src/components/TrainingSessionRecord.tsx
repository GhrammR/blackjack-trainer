import { useEffect, useState } from 'react'
import { loadCountingState, loadState } from '../lib/persistence'
import {
  buildTrainingLogText,
  captureSessionBaseline,
  loadSessionBaseline,
  saveSessionBaseline,
  type SessionBaseline,
} from '../lib/trainingLog'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './theme'

const POLL_MS = 1000

type View = 'session' | 'lifetime'

/**
 * Always-visible training-log record — deliberately self-contained (no
 * props): it polls `persistence.ts` directly rather than relying on parent
 * re-renders, since Basic Strategy manages its own stats without lifting
 * them to `App.tsx` the way every v2 mode does. That also means this
 * component can be mounted anywhere with zero wiring — this is a *temporary*
 * placement (below the Lobby/active mode in `App.tsx`); it's built to be
 * dropped under the future persistent-table-shell restructure without a
 * rewrite.
 *
 * Reuses `buildTrainingLogText`/the session-baseline logic unchanged — this
 * component only adds the always-visible placement and the Session/Lifetime
 * toggle. "Lifetime" always passes `baseline: null` to force lifetime
 * totals regardless of whether a session is running; "Session" passes the
 * real baseline (which itself falls back to lifetime totals, with a
 * matching header, if no session has been started yet).
 */
export function TrainingSessionRecord() {
  const [view, setView] = useState<View>('session')
  const [baseline, setBaseline] = useState<SessionBaseline | null>(() => loadSessionBaseline())
  const [v1State, setV1State] = useState(() => loadState())
  const [countingState, setCountingState] = useState(() => loadCountingState())
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'fallback'>('idle')
  const [fallbackText, setFallbackText] = useState('')

  useEffect(() => {
    const id = setInterval(() => {
      setV1State(loadState())
      setCountingState(loadCountingState())
      setBaseline(loadSessionBaseline())
    }, POLL_MS)
    return () => clearInterval(id)
  }, [])

  function handleStartSession() {
    const newBaseline = captureSessionBaseline(v1State, countingState)
    saveSessionBaseline(newBaseline)
    setBaseline(newBaseline)
    setCopyState('idle')
  }

  async function handleCopy() {
    // Excludes the "Training Log — ..." header — the on-screen <pre> below keeps it for context,
    // but the copied text (for pasting into an external log) should start at the actual stats.
    const text = buildTrainingLogText(v1State, countingState, view === 'session' ? baseline : null, {
      includeHeader: false,
    })
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState((s) => (s === 'copied' ? 'idle' : s)), 2500)
    } catch {
      // Clipboard permission denied or unavailable (e.g. non-secure context) — fall back to a
      // selectable textarea so the text can still be copied manually.
      setFallbackText(text)
      setCopyState('fallback')
    }
  }

  const text = buildTrainingLogText(v1State, countingState, view === 'session' ? baseline : null)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 border-t border-slate-800 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span role="group" aria-label="View" className="inline-flex overflow-hidden rounded border border-slate-600">
          <button
            type="button"
            onClick={() => setView('session')}
            aria-pressed={view === 'session'}
            className={`px-3 py-1.5 text-sm font-medium transition ${
              view === 'session' ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Current Session
          </button>
          <button
            type="button"
            onClick={() => setView('lifetime')}
            aria-pressed={view === 'lifetime'}
            className={`px-3 py-1.5 text-sm font-medium transition ${
              view === 'lifetime' ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Lifetime
          </button>
        </span>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleStartSession} className={SECONDARY_BUTTON}>
            Start New Session
          </button>
          <button type="button" onClick={handleCopy} className={PRIMARY_BUTTON}>
            {copyState === 'copied' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <pre className="whitespace-pre-wrap rounded bg-slate-800/50 p-3 font-mono text-xs text-slate-300">{text}</pre>

      {copyState === 'fallback' && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-slate-500">Clipboard access isn't available here — select all and copy manually:</p>
          <textarea
            readOnly
            value={fallbackText}
            onFocus={(e) => e.currentTarget.select()}
            className="h-40 w-full rounded bg-slate-800 p-2 font-mono text-xs text-white"
          />
        </div>
      )}
    </div>
  )
}
