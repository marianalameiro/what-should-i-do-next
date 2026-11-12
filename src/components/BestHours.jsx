import { analyseHours } from '../lib/bestHours'

const fmt = n => n.toFixed(1).replace('.', ',')
const range = w => `${w.from}h–${w.to}h`
const join = list => list.map(range).join(' e ')

export default function BestHours() {
  const a = analyseHours()
  const cap = { fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: '4px 0 0' }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><span className="card-title">⏰ Melhores horas para estudar</span></div>
      <div className="card-body">
        {!a.ready && (
          <p style={cap}>
            Ainda há poucos dados por hora ({a.used} sessões com humor e hora). Quando houver pelo menos 4 sessões em 3 janelas diferentes, aparece aqui o padrão.
          </p>
        )}
        {a.ready && !a.clear && (
          <p style={{ ...cap, marginTop: 0 }}>
            Ainda não há um padrão claro: o teu humor é parecido a todas as horas. Isto é uma boa notícia, podes estudar quando for mais prático.
          </p>
        )}
        {a.clear && (
          <>
            <p style={{ margin: '0 0 6px', fontSize: 'var(--t-body)', color: 'var(--gray-800)' }}>
              🔥 <b>Tarefas difíceis e matéria nova:</b> {join(a.best)}
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 'var(--t-body)', color: 'var(--gray-800)' }}>
              🌿 <b>Tarefas leves e revisões:</b> {join(a.worst)}
            </p>
            {a.reliable.map(w => (
              <div key={w.from} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 70, fontSize: 'var(--t-caption)', fontWeight: 600, color: 'var(--gray-700)' }}>{range(w)}</span>
                <div className="progress-wrap" style={{ flex: 1, height: 8 }}>
                  <div className="progress-fill" style={{ width: `${(w.avg - 1) / 3 * 100}%`, height: '100%', background: 'var(--rose-300)' }} />
                </div>
                <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', fontWeight: 600, minWidth: 110, textAlign: 'right' }}>
                  humor {fmt(w.avg)} · {w.n} sess.
                </span>
              </div>
            ))}
            <p style={cap}>
              Humor de 1 (cansada) a 4 (flow), pela hora a que começaste. Janelas com menos de 4 sessões não aparecem. É uma tendência, não uma certeza.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
