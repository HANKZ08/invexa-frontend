/**
 * Sesión del usuario: login, restauración tras recargar y cierre de sesión.
 * - access token: solo en memoria (se pierde al recargar).
 * - refresh token: localStorage (la sesión sigue al cerrar y abrir el navegador; expira a los 7 días).
 * Un solo refresh en vuelo aunque lleguen varias peticiones con 401.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api, setAccessTokenProvider, setUnauthorizedHandler, unwrap } from '@/api/client'
import { apiUrl } from '@/config'
import { ApiError, toApiError } from '@/api/errors'
import type { Role } from '@/app/nav'
import { avatarSrc } from '@/features/auth/avatar'

export interface SessionUser {
  id: number
  username: string
  fullName: string
  role: Role
  avatarUrl?: string | null
}

interface MeResponse {
  id: number
  username: string
  first_name: string
  last_name: string
  role: Role
  avatar_url?: string | null
}

const REFRESH_KEY = 'invexa.refresh'

export const useSessionStore = defineStore('session', () => {
  const user = ref<SessionUser | null>(null)
  let access: string | null = null
  let refreshing: Promise<boolean> | null = null

  const role = computed<Role | null>(() => user.value?.role ?? null)
  const isAuthenticated = computed(() => user.value !== null)

  function storedRefresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  }

  function remember(refresh: string | null) {
    try {
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
      else localStorage.removeItem(REFRESH_KEY)
    } catch {
      // Sin localStorage (modo privado): la sesión dura solo mientras la pestaña viva.
    }
  }

  async function loadMe(): Promise<void> {
    const me = await unwrap(api.GET('/api/auth/me/'))
    const data = me as unknown as MeResponse
    user.value = {
      id: data.id,
      username: data.username,
      fullName: `${data.first_name} ${data.last_name}`.trim() || data.username,
      role: data.role,
      avatarUrl: avatarSrc(data.avatar_url),
    }
  }

  /** Pide un access nuevo con el refresh guardado. Compartido entre peticiones simultáneas. */
  function refreshAccess(): Promise<boolean> {
    if (!refreshing) {
      refreshing = (async () => {
        const refresh = storedRefresh()
        if (!refresh) return false
        try {
          const response = await fetch(apiUrl('/api/auth/token/refresh/'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh }),
          })
          if (!response.ok) return false
          const body = (await response.json()) as { access: string; refresh?: string }
          access = body.access
          if (body.refresh) remember(body.refresh)
          return true
        } catch {
          return false
        } finally {
          refreshing = null
        }
      })()
    }
    return refreshing
  }

  /** Registra en el cliente de API cómo leer el token y qué hacer ante un 401. */
  function bindApiClient() {
    setAccessTokenProvider(() => access)
    setUnauthorizedHandler(async () => {
      const ok = await refreshAccess()
      if (!ok) {
        logout()
      }
      return ok
    })
  }

  async function login(username: string, password: string): Promise<void> {
    bindApiClient()
    let tokens: { access: string; refresh: string }
    try {
      tokens = await unwrap(api.POST('/api/auth/token/', { body: { username, password } }))
    } catch (error) {
      throw error instanceof ApiError ? error : toApiError(0, null)
    }
    access = tokens.access
    remember(tokens.refresh)
    await loadMe()
  }

  /** Al recargar la página: intenta recuperar la sesión con el refresh guardado. */
  async function restore(): Promise<void> {
    bindApiClient()
    if (!storedRefresh()) return
    if (!(await refreshAccess())) {
      remember(null)
      return
    }
    try {
      await loadMe()
    } catch {
      logout()
    }
  }

  function logout() {
    access = null
    user.value = null
    remember(null)
  }

  /** Fija el usuario sin pedir al servidor (usado al restaurar y en pruebas). */
  function setUser(value: SessionUser | null) {
    user.value = value
  }

  return { user, role, isAuthenticated, login, restore, logout, bindApiClient, setUser }
})
