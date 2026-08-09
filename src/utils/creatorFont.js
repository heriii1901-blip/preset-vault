const FONT_MAP = {
  default: 'var(--font-sans)',
  poppins: 'var(--font-creator-poppins)',
  pacifico: 'var(--font-creator-pacifico)',
  bebas: 'var(--font-creator-bebas)',
  caveat: 'var(--font-creator-caveat)',
  righteous: 'var(--font-creator-righteous)',
}

export const CREATOR_FONT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'pacifico', label: 'Pacifico (cursive)' },
  { value: 'bebas', label: 'Bebas Neue (tebal-tegas)' },
  { value: 'caveat', label: 'Caveat (tulisan tangan)' },
  { value: 'righteous', label: 'Righteous' },
]

export function creatorNameStyle(font, bold) {
  return {
    fontFamily: FONT_MAP[font] || FONT_MAP.default,
    fontWeight: bold ? 800 : 600,
  }
}
