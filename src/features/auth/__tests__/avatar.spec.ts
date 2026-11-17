import { describe, expect, it, vi } from 'vitest'

import { avatarFileError, uploadAvatar } from '../avatar'

const authorizedFetch = vi.fn<(path?: string, init?: RequestInit) => Promise<Response>>(
  async () =>
    new Response(JSON.stringify({ avatar_url: '/media/avatars/foto.png' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
)
vi.mock('@/api/client', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...(args as [])),
}))

describe('foto de perfil', () => {
  it('acepta PNG, JPG y GIF hasta 10 MB', () => {
    expect(avatarFileError({ type: 'image/png', size: 1000 })).toBeUndefined()
    expect(avatarFileError({ type: 'image/jpeg', size: 1000 })).toBeUndefined()
    expect(avatarFileError({ type: 'image/gif', size: 1000 })).toBeUndefined()
  })

  it('rechaza otros tipos y fotos de más de 10 MB', () => {
    expect(avatarFileError({ type: 'application/pdf', size: 1000 })).toContain('PNG, JPG o GIF')
    expect(avatarFileError({ type: 'image/png', size: 11 * 1024 * 1024 })).toContain('10 MB')
  })

  it('subir la foto llama a la API del avatar con el archivo', async () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' })
    const result = await uploadAvatar(file)
    expect(authorizedFetch).toHaveBeenCalledWith(
      '/api/auth/me/avatar/',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.avatar_url).toContain('foto.png')
  })
})
