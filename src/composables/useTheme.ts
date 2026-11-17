/** Tema claro / oscuro / del sistema, recordado por navegador (preferencia personal). */
import { ref } from 'vue'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'invexa.theme'

function read(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function apply(value: Theme) {
  const root = document.documentElement
  if (value === 'system') delete root.dataset.theme
  else root.dataset.theme = value
}

const theme = ref<Theme>(read())
apply(theme.value)

export function useTheme() {
  function setTheme(value: Theme) {
    theme.value = value
    apply(value)
    try {
      if (value === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Sin almacenamiento (modo privado): el tema dura solo esta sesión.
    }
  }

  return { theme, setTheme }
}
