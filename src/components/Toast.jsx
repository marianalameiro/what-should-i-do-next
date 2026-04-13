import { useState, useCallback, useRef } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback(({ message, onUndo, duration = 5000 }) => {
    const id = Date.now()
    setToasts(prev => [...prev.slice(-2), { id, message, onUndo }])
    timers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
    return id
  }, [])

  return { toasts, toast, dismiss }
}

export function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9998, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--gray-900, #111)', color: '#fff',
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600,
          animation: 'fadeSlideUp 0.2s ease',
          minWidth: 240,
        }}>
          <span style={{ flex: 1 }}>{t.message}</span>
          {t.onUndo && (
            <button
              onClick={() => { t.onUndo(); onDismiss(t.id) }}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.78rem', color: '#fff', fontWeight: 700,
              }}
            >
              Desfazer
            </button>
          )}
          <button
            onClick={() => onDismiss(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontFamily: 'inherit', fontSize: '1rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
