 nativo trata via deep-link
  }
})

// Log all auth state transitions so unusual patterns are visible in logs.
supabase.auth.onAuthStateChange((event, session) => {
  logger.auth.stateChange(event, session?.user?.id)
  if (event === 'SIGNED_IN') {
    logger.auth.sessionRestored(session?.user?.id)
  }
})