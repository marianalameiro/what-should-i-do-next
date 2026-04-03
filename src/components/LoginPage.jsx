import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

export default function LoginPage({ onLogin, onSkip }) {
  const [mode, setMode]       = useState('login') // 'login' | 'register'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmail = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        logger.auth.loginAttempt(email)
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          logger.auth.loginFailure(email, error.message)
          throw error
        }
        logger.auth.loginSuccess(email)
      } else {
        logger.auth.signupAttempt(email)
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) {
          logger.auth.signupFailure(email, error.message)
          throw error
        }
        logger.auth.signupSuccess(email)
      }
      onLogin()
    } catch (e) {
      setError(e.message || 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    logger.auth.oauthAttempt('google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      logger.auth.oauthFailure('google', error.message)
      setError(error.message)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gray-50)',
    }}>
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--gray-200)',
        borderRadius: 'var(--radius)',
        padding: '36px 32px',
        width: '100%',
        maxWidth: 380,
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: -0.5, color: 'var(--gray-900)', marginBottom: 4 }}>
            what should I do next?
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)', fontWeight: 500 }}>
            {mode === 'login' ? 'Bem-vinda de volta 👋' : 'Cria a tua conta'}
          </p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: '1.5px solid var(--gray-200)',
            background: 'var(--white)',
            fontFamily: 'inherit',
            fontWeight: 600,
            fontSize: '0.88rem',
            color: 'var(--gray-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 18,
            transition: 'background 0.15s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Continuar com Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--gray-100)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: 'var(--gray-100)' }} />
        </div>

        {/* Email + password */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            style={inputStyle}
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmail()}
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            style={inputStyle}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmail()}
          />
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: '0.8rem',
            color: '#dc2626',
            marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleEmail}
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}
        >
          {loading ? 'A entrar...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--gray-400)' }}>
          {mode === 'login' ? 'Ainda não tens conta? ' : 'Já tens conta? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--rose-400)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}
          >
            {mode === 'login' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>

        {onSkip && (
          <button
            onClick={onSkip}
            style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', display: 'block', margin: '12px auto 0', textDecoration: 'underline' }}
          >
            Continuar sem conta
          </button>
        )}
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '0.73rem',
  fontWeight: 700,
  color: 'var(--gray-500)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const inputStyle = {
  width: '100%',
  fontFamily: 'inherit',
  fontSize: '0.88rem',
  border: '1.5px solid var(--gray-200)',
  borderRadius: 8,
  padding: '9px 12px',
  outline: 'none',
  background: 'var(--white)',
  color: 'var(--gray-900)',
  boxSizing: 'border-box',
}