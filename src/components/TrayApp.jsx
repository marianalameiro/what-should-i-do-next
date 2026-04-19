import { useState, useEffect } from 'react';
import { Play, Pause, ExternalLink } from 'lucide-react';

export default function TrayApp() {
  const [timerState, setTimerState] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    // Load initial state
    try {
      setTimerState(JSON.parse(localStorage.getItem('pomodoro-timer-state')));
      setSettings(JSON.parse(localStorage.getItem('user-settings')));
    } catch {}

    const handleStorage = (e) => {
      if (e.key === 'pomodoro-timer-state') {
        try { setTimerState(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === 'user-settings') {
        try { setSettings(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    
    // Auto-update seconds while running
    const interval = setInterval(() => {
      try {
        const raw = JSON.parse(localStorage.getItem('pomodoro-timer-state'));
        if (raw?.running && raw?.savedAt) {
          const elapsed = Math.floor((Date.now() - raw.savedAt) / 1000);
          const live = raw.isStopwatch
            ? { ...raw, secondsElapsed: (raw.secondsElapsed || 0) + elapsed }
            : { ...raw, secondsLeft: Math.max(0, (raw.secondsLeft || 0) - elapsed) };
          setTimerState(live);
        } else {
          setTimerState(raw);
        }
      } catch {}
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const toggleTimer = () => {
    const channel = new BroadcastChannel('pomodoro-sync');
    channel.postMessage({ type: 'TOGGLE_PLAY' });
    channel.close();
  };

  const openMainWindow = () => {
    const channel = new BroadcastChannel('pomodoro-sync');
    channel.postMessage({ type: 'FOCUS_APP' });
    channel.close();
  };

  if (!timerState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 10, background: '#fdfdfd' }}>
        <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>Nenhum Pomodoro ativo.</p>
        <button onClick={openMainWindow} style={{ padding: '6px 12px', background: 'var(--gray-100)', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12 }}>Abrir App</button>
      </div>
    );
  }

  const { isStopwatch, secondsLeft, secondsElapsed, running, subject } = timerState;
  const displaySeconds = isStopwatch ? secondsElapsed : secondsLeft;
  const mm = Math.floor(displaySeconds / 60).toString().padStart(2, '0');
  const ss = (displaySeconds % 60).toString().padStart(2, '0');

  const subjectObj = settings?.subjects?.find(s => s.key === subject);

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100vh', 
      padding: 16, background: 'rgba(253,253,253,0.95)', color: '#333', 
      fontFamily: 'system-ui, sans-serif' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1 }}>POMODORO</div>
        <button onClick={openMainWindow} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }} title="Abrir App Principal">
          <ExternalLink size={14} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: -20 }}>
        <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
          {mm}:{ss}
        </div>
        
        {subjectObj && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, background: subjectObj.color + '22', color: subjectObj.color, padding: '4px 10px', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 600 }}>
            <span>{subjectObj.emoji}</span>
            <span>{subjectObj.name}</span>
          </div>
        )}

        <button 
          onClick={toggleTimer} 
          style={{ 
            marginTop: 30, width: 56, height: 56, borderRadius: '50%',
            background: running ? '#e5e7eb' : '#ef4444', 
            color: running ? '#4b5563' : '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: running ? 'none' : '0 4px 14px rgba(239, 68, 68, 0.4)'
          }}
        >
          {running ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: 3 }} />}
        </button>
      </div>
    </div>
  );
}
