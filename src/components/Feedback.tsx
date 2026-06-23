import type { Action } from '../types'

interface FeedbackProps {
  isCorrect: boolean
  chosenAction: Action
  correctAction: Action
  onNext: () => void
}

export function Feedback({ isCorrect, chosenAction, correctAction, onNext }: FeedbackProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className={`text-lg font-semibold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
        {isCorrect ? 'Correct!' : `Incorrect — you chose ${chosenAction}`}
      </p>
      {!isCorrect && <p className="text-slate-300">Correct play: {correctAction}</p>}
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
