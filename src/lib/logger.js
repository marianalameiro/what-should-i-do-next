/**
 * Centralized security logger for the Electron app.
 *
 * Outputs structured, searchable records for:
 *   • Auth events  (login, logout, OAuth, failures)
 *   • API errors   (Supabase calls that fail)
 *   • Suspicious patterns (repeated failures in a short window)
 *
 * In dev  → human-readable console output
 * In prod → compact JSON (visible in Electron DevTools / system logs)
 */

const isDev = import.meta.env.DEV;

// ─── Repeated-failure tracker ─────────────────────────────────────────────────
const _failures = new Map(); // email → { count, windowStart }
const FAILURE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const FAILURE_THRESHOLD = 5;

function _trackFailure(email) {
  const now = Date.now();
  const rec = _failures.get(email) ?? { count: 0, windowStart: now };
  if (now - rec.windowStart > FAILURE_WINDOW_MS) {
    rec.count = 1;
    rec.windowStart = now;
  } else {
    rec.count += 1;
  }
  _failures.set(email, rec);
  return rec.count;
}

// ─── Core emit ────────────────────────────────────────────────────────────────
function _emit(level, category, message, data) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    category,
    msg: message,
    ...(data && Object.keys(data).length ? { data } : {}),
  };

  if (isDev) {
    const fn =
      level === 'ERROR' ? console.error :
      level === 'WARN'  ? console.warn  :
      console.info;
    fn(`[${level}][${category}] ${message}`, data ?? '');
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ─── Email masking ────────────────────────────────────────────────────────────
function _maskEmail(email) {
  if (!email || !email.includes('@')) return '[invalid-email]';
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const logger = {
  auth: {
    loginAttempt(email) {
      _emit('INFO', 'AUTH', 'Login attempt', { email: _maskEmail(email) });
    },
    loginSuccess(email) {
      _emit('INFO', 'AUTH', 'Login success', { email: _maskEmail(email) });
      _failures.delete(email);
    },
    loginFailure(email, reason) {
      const count = _trackFailure(email);
      _emit('WARN', 'AUTH', 'Login failed', { email: _maskEmail(email), reason });
      if (count >= FAILURE_THRESHOLD) {
        _emit('WARN', 'SECURITY', 'Repeated login failures', {
          email: _maskEmail(email),
          failureCount: count,
          windowMinutes: FAILURE_WINDOW_MS / 60000,
        });
      }
    },
    signupAttempt(email) {
      _emit('INFO', 'AUTH', 'Signup attempt', { email: _maskEmail(email) });
    },
    signupSuccess(email) {
      _emit('INFO', 'AUTH', 'Signup success', { email: _maskEmail(email) });
    },
    signupFailure(email, reason) {
      _emit('WARN', 'AUTH', 'Signup failed', { email: _maskEmail(email), reason });
    },
    logout(email) {
      _emit('INFO', 'AUTH', 'Logout', { email: _maskEmail(email) });
    },
    sessionRestored(userId) {
      _emit('INFO', 'AUTH', 'Session restored', { userId });
    },
    stateChange(event, userId) {
      _emit('INFO', 'AUTH', `Auth state: ${event}`, { userId: userId ?? 'none' });
    },
    oauthAttempt(provider) {
      _emit('INFO', 'AUTH', 'OAuth login attempt', { provider });
    },
    oauthFailure(provider, reason) {
      _emit('WARN', 'AUTH', 'OAuth login failed', { provider, reason });
    },
  },

  api: {
    error(operation, error) {
      _emit('ERROR', 'API', `API error during: ${operation}`, {
        message: error?.message,
        code: error?.code,
      });
    },
  },

  security: {
    suspiciousActivity(description, data) {
      _emit('WARN', 'SECURITY', description, data);
    },
  },
};
