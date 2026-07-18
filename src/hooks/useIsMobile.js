import { useState, useEffect } from 'react'

// Devolve true quando o ecrã é estreito (telemóvel). Usado para adaptar layouts
// que estão em inline styles (onde media queries de CSS não chegam).
// Telemóvel = ecrã estreito (vertical) OU baixo (horizontal) — apanha as duas orientações.
const MOBILE_QUERY = '(max-width: 768px), (max-height: 500px)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}
