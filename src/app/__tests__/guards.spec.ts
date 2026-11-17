import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import { authGuard, routes } from '../router'

function makeRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach(authGuard)
  return router
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
})

describe('guardas de ruta', () => {
  it('sin sesión, una ruta privada lleva a login y recuerda a dónde iba', async () => {
    const router = makeRouter()
    await router.push('/productos?x=1')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/productos?x=1')
  })

  it('el cajero que abre /dashboard vuelve a /caja', async () => {
    const router = makeRouter()
    useSessionStore().setUser({ id: 2, username: 'c', fullName: 'C', role: 'cashier' })
    await router.push('/dashboard')
    expect(router.currentRoute.value.path).toBe('/caja')
  })

  it('el administrador puede abrir el dashboard', async () => {
    const router = makeRouter()
    useSessionStore().setUser({ id: 1, username: 'a', fullName: 'A', role: 'admin' })
    await router.push('/dashboard')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('con sesión, login lleva a la pantalla de inicio del rol', async () => {
    const router = makeRouter()
    useSessionStore().setUser({ id: 3, username: 'b', fullName: 'B', role: 'warehouse' })
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/inventario')
  })

  it('las rutas públicas no piden sesión', async () => {
    const router = makeRouter()
    await router.push('/estado')
    expect(router.currentRoute.value.path).toBe('/estado')
  })
})
