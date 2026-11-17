/** Configuración de la app leída de variables de entorno de Vite. */

/** URL base de la API sin barra final. Vacío = mismo origen (proxy de Vite en desarrollo). */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

/** Construye la URL completa de un endpoint de la API, por ejemplo `apiUrl('/api/health/')`. */
export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`
}
