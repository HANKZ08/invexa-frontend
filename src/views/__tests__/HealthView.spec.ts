import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import HealthView from '../HealthView.vue'

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

describe('HealthView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('muestra que la API está conectada cuando /api/health/ responde ok', async () => {
    mockFetch({ ok: true, json: async () => ({ status: 'ok' }) })
    const wrapper = mount(HealthView)
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/health/')
    expect(wrapper.get('[role="status"]').attributes('data-status')).toBe('ok')
  })

  it('muestra un error cuando la API no responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const wrapper = mount(HealthView)
    await flushPromises()

    expect(wrapper.text()).toContain('No se pudo conectar con la API')
  })
})
