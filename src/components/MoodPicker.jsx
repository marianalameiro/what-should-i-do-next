const MOODS = [
  { emoji: '😴', label: 'Cansada' },
  { emoji: '😐', label: 'Normal' },
  { emoji: '😊', label: 'Bem' },
  { emoji: '🔥', label: 'Flow' },
]

// Seletor de humor opcional: carregar outra vez no escolhido desfaz a escolha.
export default function MoodPicker({ value, onChange }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', marginBottom: 4 }}>Humor (opcional)</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {MOODS.map(m => (
          <button key={m.emoji} type="button" title={m.label}
            onClick={() => onChange(value === m.emoji ? '' : m.emoji)}
            style={{
              width: 36, height: 36, borderRadius: 'var(--r)', cursor: 'pointer', fontSize: '1.1rem',
              border: '2px solid ' + (value === m.emoji ? 'var(--rose-300)' : 'var(--gray-200)'),
              background: value === m.emoji ? 'var(--rose-50)' : 'var(--white)',
            }}>{m.emoji}</button>
        ))}
      </div>
    </div>
  )
}
