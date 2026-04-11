// ─── Shared constants across the app ─────────────────────────────────────────

export const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DAY_NAMES_FULL  = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEK_DAYS       = [1, 2, 3, 4, 5, 6, 0] // Mon–Sun order
export const MONTHS          = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

export const QUADRANTS = {
  Q1: { label: 'Urgente + Importante',       emoji: '🔴', color: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  Q2: { label: 'Importante, não urgente',    emoji: '🟡', color: '#fefce8', border: '#fde047', text: '#854d0e' },
  Q3: { label: 'Urgente, não importante',    emoji: '🟠', color: '#fff7ed', border: '#fdba74', text: '#9a3412' },
  Q4: { label: 'Nem urgente nem importante', emoji: '⚪', color: '#fafafa', border: '#e4e4e7', text: '#52525b' },
}

export const ENERGY_LEVELS = [
  { id: 'high',      label: 'Alta',     emoji: '🔋', color: '#16a34a', bg: '#f0fdf4', border: '#86efac',
    quadrantOrder: ['Q1','Q2','Q3','Q4'],
    tip: 'Começa pelas tarefas mais difíceis e urgentes — estás no teu melhor!' },
  { id: 'medium',    label: 'Média',    emoji: '😐', color: '#d97706', bg: '#fefce8', border: '#fde047',
    quadrantOrder: ['Q2','Q1','Q3','Q4'],
    tip: 'Foca nas tarefas importantes mas sem pressão imediata.' },
  { id: 'low',       label: 'Baixa',    emoji: '🪫', color: '#ea580c', bg: '#fff7ed', border: '#fdba74',
    quadrantOrder: ['Q3','Q2','Q4','Q1'],
    tip: 'Trata das tarefas rápidas e leves. Guarda o difícil para depois.' },
  { id: 'exhausted', label: 'Esgotada', emoji: '😴', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    quadrantOrder: ['Q4','Q3','Q2','Q1'],
    tip: 'Só o essencial. Descansa quando puderes.' },
]

export const PERIODS = [
  { id: 'morning',   label: 'Manhã',  emoji: '🌅', hours: '6h–13h' },
  { id: 'afternoon', label: 'Tarde',  emoji: '☀️', hours: '13h–19h' },
  { id: 'evening',   label: 'Noite',  emoji: '🌙', hours: '19h–23h' },
]

export const CONFIDENCE = [
  { id: 'unknown', label: 'Não sei',       color: '#b91c1c', bg: '#fee2e2' },
  { id: 'little',  label: 'Sei pouco',     color: '#b45309', bg: '#fef3c7' },
  { id: 'good',    label: 'Sei bem',       color: '#1d4ed8', bg: '#dbeafe' },
  { id: 'great',   label: 'Sei muito bem', color: '#15803d', bg: '#dcfce7' },
]

export const EVENT_TYPES = ['Exame', 'Teste', 'Mini-teste', 'Apresentação']
