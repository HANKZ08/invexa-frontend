/** Foto de perfil: validación del archivo y llamadas a la API. */
import { apiUrl } from '@/config'
import { authorizedFetch } from '@/api/client'

export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif'] as const
export const MAX_AVATAR_BYTES = 10 * 1024 * 1024

/** Mensaje de error si el archivo no sirve como foto; undefined si está bien. */
export function avatarFileError(file: { type: string; size: number }): string | undefined {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
    return 'Solo se aceptan fotos PNG, JPG o GIF.'
  }
  if (file.size > MAX_AVATAR_BYTES) return 'La foto supera los 10 MB.'
  return undefined
}

async function parse(response: Response): Promise<{ avatar_url: string | null }> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { avatar?: string[]; detail?: string }
    throw new Error(body.avatar?.[0] ?? body.detail ?? 'No pudimos guardar la foto.')
  }
  return (await response.json()) as { avatar_url: string | null }
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string | null }> {
  const form = new FormData()
  form.append('avatar', file)
  return parse(await authorizedFetch('/api/auth/me/avatar/', { method: 'POST', body: form }))
}

export async function removeAvatar(): Promise<{ avatar_url: string | null }> {
  return parse(await authorizedFetch('/api/auth/me/avatar/', { method: 'DELETE' }))
}

/** Dirección absoluta de la foto (la API la devuelve relativa a su host). */
export function avatarSrc(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('http') ? url : apiUrl(url)
}
