import type { Action } from '../types'

interface FeedbackProps {
  isCorrect: boolean
  chosenAction: Action
  correctAction: Action
  reason: string | null
  onNext: () => void
}

export function Feedback({ isCorrect, chosenAction, correctAction, reason, onNext }: FeedbackProps) {
  return (
    <div className="flex max-w-md flex-col items-center gap-3 text-center">
      <p className={`text-lg font-semibold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
        {isCorrect ? 'Correct!' : `Incorrect — you chose ${chosenAction}`}
      </p>
      {!isCorrect && <p className="text-slate-300">Correct play: {correctAction}</p>}
      {!isCorrect && reason && <p className="text-sm text-slate-400">{reason}</p>}
      <button
        type="button"
        onClick={onNext}
        className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
      >
        Next hand
      </button>
    </div>
  )
}
