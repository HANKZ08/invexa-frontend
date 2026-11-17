import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import AccountView from '../views/AccountView.vue'

const server = setupServer(
  http.patch('*/api/auth/me/', async ({ request }) => {
    const body = (await request.json()) as { first_name: string; last_name: string }
    return HttpResponse.json({
      id: 2,
      username: 'cajero',
      first_name: body.first_name,
      last_name: body.last_name,
      role: 'cashier',
    })
  }),
  http.post('*/api/auth/change-password/', async ({ request }) => {
    const body = (await request.json()) as { current_password: string }
    if (body.current_password !== 'Actual-123456') {
      return HttpResponse.json(
        { current_password: ['La contraseña actual no es correcta.'] },
        { status: 400 },
      )
    }
    return new HttpResponse(null, { status: 204 })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  setActivePinia(createPinia())
  useSessionStore().setUser({
    id: 2,
    username: 'cajero',
    fullName: 'Luis Ramírez',
    role: 'cashier',
  })
})
afterEach(() => server.resetHandlers())

async function mountView() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/cuenta')
  await router.isReady()
  const wrapper = mount(AccountView, { global: { plugins: [router] } })
  return { wrapper, session: useSessionStore() }
}

describe('AccountView', () => {
  it('muestra el perfil y guardar actualiza el nombre sin recargar', async () => {
    const { wrapper, session } = await mountView()
    expect(
      (wrapper.get('input[autocomplete="given-name"]').element as HTMLInputElement).value,
    ).toBe('Luis')

    await wrapper.get('input[autocomplete="given-name"]').setValue('Luisa')
    await wrapper.get('form[data-profile]').trigger('submit')
    await flushPromises()

    expect(session.user?.fullName).toBe('Luisa Ramírez')
    expect(wrapper.get('[role="status"]').text()).toContain('Datos guardados.')
  })

  it('cambiar contraseña con la actual incorrecta muestra el error en su campo', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('input[name="current-password"]').setValue('mal')
    await wrapper.get('input[name="new-password"]').setValue('Nueva-Clave-2026')
    await wrapper.get('form[data-password]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('La contraseña actual no es correcta.')
  })

  it('cambiar contraseña correctamente limpia los campos y avisa', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('input[name="current-password"]').setValue('Actual-123456')
    await wrapper.get('input[name="new-password"]').setValue('Nueva-Clave-2026')
    await wrapper.get('form[data-password]').trigger('submit')
    await flushPromises()

    expect((wrapper.get('input[name="current-password"]').element as HTMLInputElement).value).toBe(
      '',
    )
    expect(wrapper.get('[role="status"]').text()).toContain('Contraseña cambiada.')
  })
})
