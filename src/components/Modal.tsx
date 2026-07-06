import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Generic overlay chrome — backdrop, Escape-to-close, backdrop-click-to-close,
 * a ✕ button — factored out of `GlobalSettingsModal.tsx`'s existing (and
 * left untouched) markup so Guides and Overview can use the same proven
 * pattern without risking that component's already-working reset flows.
 * Wider than Settings' modal (`max-w-3xl` vs `max-w-md`) since Guides'
 * strategy tables and the Lobby's tile grid need more room.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-lg bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
