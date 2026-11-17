import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import UiDialog from '../UiDialog.vue'
import UiPagination from '../UiPagination.vue'
import UiTable, { type TableColumn } from '../UiTable.vue'
import UiToastHost from '../UiToastHost.vue'
import { dismissAll, toast } from '@/composables/useToast'

const columns: TableColumn[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Producto', sortable: true },
  { key: 'stock', label: 'Stock', align: 'right', sortable: true },
]
const rows = [
  { id: 1, sku: 'PIN-001', name: 'Pintura látex blanco 1 gal', stock: 40 },
  { id: 2, sku: 'ELE-003', name: 'Interruptor simple empotrable', stock: 9 },
]

describe('UiTable', () => {
  it('muestra encabezados y filas', () => {
    const wrapper = mount(UiTable, { props: { columns, rows, caption: 'Productos' } })
    expect(wrapper.findAll('th').map((th) => th.text())).toEqual(['SKU', 'Producto', 'Stock'])
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.get('caption').text()).toBe('Productos')
  })

  it('permite personalizar celdas con slots', () => {
    const wrapper = mount(UiTable, {
      props: { columns, rows },
      slots: { 'cell-stock': '<strong>{{ params.row.stock }} u.</strong>' },
    })
    expect(wrapper.findAll('tbody strong').map((s) => s.text())).toEqual(['40 u.', '9 u.'])
  })

  it('muestra el estado vacío', () => {
    const wrapper = mount(UiTable, { props: { columns, rows: [], emptyText: 'No hay productos.' } })
    expect(wrapper.text()).toContain('No hay productos.')
  })

  it('muestra el estado de carga sin filas reales', () => {
    const wrapper = mount(UiTable, { props: { columns, rows, loading: true } })
    expect(wrapper.get('table').attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).not.toContain('PIN-001')
  })

  it('muestra el error y permite reintentar', async () => {
    const wrapper = mount(UiTable, { props: { columns, rows: [], error: 'No se pudo cargar.' } })
    expect(wrapper.text()).toContain('No se pudo cargar.')
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Reintentar')!
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('ordena con un botón en el encabezado y anuncia aria-sort', async () => {
    const wrapper = mount(UiTable, {
      props: {
        columns,
        rows,
        sort: { key: 'stock', direction: 'asc' as const },
        'onUpdate:sort': (value: unknown) => wrapper.setProps({ sort: value as never }),
      },
    })
    const stockHeader = wrapper.findAll('th')[2]!
    expect(stockHeader.attributes('aria-sort')).toBe('ascending')
    await stockHeader.get('button').trigger('click')
    expect(wrapper.props('sort')).toEqual({ key: 'stock', direction: 'desc' })
    await wrapper.findAll('th')[1]!.get('button').trigger('click')
    expect(wrapper.props('sort')).toEqual({ key: 'name', direction: 'asc' })
  })
})

describe('UiPagination', () => {
  it('muestra el rango y navega entre páginas', async () => {
    const wrapper = mount(UiPagination, {
      props: {
        page: 1,
        count: 80,
        pageSize: 20,
        'onUpdate:page': (p: number) => wrapper.setProps({ page: p }),
      },
    })
    expect(wrapper.text()).toContain('1–20 de 80')
    const [prev, next] = wrapper.findAll('button')
    expect(prev!.attributes('disabled')).toBeDefined()
    await next!.trigger('click')
    expect(wrapper.props('page')).toBe(2)
    expect(wrapper.text()).toContain('21–40 de 80')
  })

  it('deshabilita "Siguiente" en la última página', () => {
    const wrapper = mount(UiPagination, { props: { page: 4, count: 80 } })
    expect(wrapper.findAll('button')[1]!.attributes('disabled')).toBeDefined()
  })

  it('sin resultados no se muestra', () => {
    const wrapper = mount(UiPagination, { props: { page: 1, count: 0 } })
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('ofrece Ver de 10 a 100 de 5 en 5 y no muestra páginas si todo cabe', () => {
    const wrapper = mount(UiPagination, { props: { page: 1, count: 12 } })
    const options = wrapper.findAll('select option').map((o) => o.text())
    expect(options[0]).toBe('10')
    expect(options).toContain('25')
    expect(options[options.length - 1]).toBe('100')
    expect(options).toHaveLength(19)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})

describe('UiDialog', () => {
  beforeAll(() => {
    // jsdom no implementa showModal/close del <dialog>
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })

  it('se abre con v-model y tiene título accesible', async () => {
    const wrapper = mount(UiDialog, {
      props: { open: false, title: 'Anular venta V-000080' },
      slots: { default: '<p>Se devolverá el stock.</p>' },
      attachTo: document.body,
    })
    await wrapper.setProps({ open: true })
    const dialog = wrapper.get('dialog')
    expect(dialog.attributes('open')).toBeDefined()
    const labelledBy = dialog.attributes('aria-labelledby')!
    expect(wrapper.get(`#${labelledBy}`).text()).toBe('Anular venta V-000080')
    wrapper.unmount()
  })

  it('emite update:open false al cerrarse (Esc o botón)', async () => {
    const wrapper = mount(UiDialog, {
      props: { open: true, title: 'Confirmar' },
      attachTo: document.body,
    })
    await nextTick()
    await wrapper.get('button[aria-label="Cerrar"]').trigger('click')
    const events = wrapper.emitted('update:open') ?? []
    expect(events[events.length - 1]).toEqual([false])
    wrapper.unmount()
  })

  it('devuelve el foco al elemento que lo abrió', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const wrapper = mount(UiDialog, { props: { open: false, title: 'X' }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
    opener.remove()
  })
})

describe('Toasts', () => {
  afterEach(() => {
    dismissAll()
    vi.useRealTimers()
  })

  it('anuncia los avisos en una región aria-live', async () => {
    const wrapper = mount(UiToastHost)
    toast.success('Venta V-000081 registrada.')
    await nextTick()
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('Venta V-000081 registrada.')
  })

  it('los errores usan role="alert"', async () => {
    const wrapper = mount(UiToastHost)
    toast.error('No se pudo conectar con el servidor.')
    await nextTick()
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo conectar')
  })

  it('se cierran solos y con el botón', async () => {
    vi.useFakeTimers()
    const wrapper = mount(UiToastHost)
    toast.info('Guardado.')
    toast.info('Exportando…')
    await nextTick()
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.text()).not.toContain('Guardado.')
    vi.advanceTimersByTime(6000)
    await nextTick()
    expect(wrapper.text()).not.toContain('Exportando…')
  })
})
