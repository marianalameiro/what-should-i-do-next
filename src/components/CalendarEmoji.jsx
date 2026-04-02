// Mini SVG calendar icon always showing 14 de março.
// Use <CalendarEmoji /> anywhere a 📅/🗓️/📆 emoji would go in JSX.
// Use smartEmoji(str) when the emoji comes from a data string.

export function CalendarEmoji({ size = '1em', style }) {
  return (
    <svg
      viewBox="0 0 18 20"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: '-0.18em', display: 'inline', flexShrink: 0, ...style }}
      aria-label="14 de março"
      role="img"
    >
      {/* body */}
      <rect x="0.5" y="2.5" width="17" height="17" rx="2.5" fill="white" stroke="#e4e4e7" strokeWidth="1"/>
      {/* header */}
      <rect x="0.5" y="2.5" width="17" height="6.5" rx="2.5" fill="hsl(var(--accent-h), var(--accent-s), var(--accent-l))"/>
      <rect x="0.5" y="6.5" width="17" height="2.5" fill="hsl(var(--accent-h), var(--accent-s), var(--accent-l))"/>
      {/* rings */}
      <rect x="4.5"  y="0" width="2" height="5" rx="1" fill="#a1a1aa"/>
      <rect x="11.5" y="0" width="2" height="5" rx="1" fill="#a1a1aa"/>
      {/* month label */}
      <text x="9" y="8" textAnchor="middle" fill="white" fontSize="3.4" fontWeight="700" fontFamily="system-ui,sans-serif" letterSpacing="0.3">MAR</text>
      {/* day number */}
      <text x="9" y="17.8" textAnchor="middle" fill="#18181b" fontSize="8.5" fontWeight="800" fontFamily="system-ui,sans-serif">14</text>
    </svg>
  )
}

const CALENDAR_EMOJIS = new Set(['📅', '🗓', '🗓️', '📆'])

/** Returns <CalendarEmoji /> for calendar emoji strings, otherwise the string as-is. */
export function smartEmoji(emoji) {
  if (CALENDAR_EMOJIS.has(emoji)) return <CalendarEmoji />
  return emoji
}
