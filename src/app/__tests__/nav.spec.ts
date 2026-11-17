import { describe, expect, it } from 'vitest'

import { canAccess, homeFor, navFor } from '../nav'

const labels = (role: Parameters<typeof navFor>[0]) =>
  navFor(role).map((group) => [group.label, group.items.map((item) => item.label)])

describe('navegación por rol', () => {
  it('el administrador ve todo agrupado por tarea', () => {
    expect(labels('admin')).toEqual([
      ['Negocio', ['Dashboard', 'Usuarios', 'Configuración']],
      ['Venta', ['Caja', 'Ventas', 'Clientes', 'Deudores']],
      ['Almacén', ['Inventario', 'Productos', 'Categorías', 'Proveedores']],
    ])
  })

  it('el cajero ve venta y consulta de productos, sin dashboard ni proveedores', () => {
    expect(labels('cashier')).toEqual([
      ['Venta', ['Caja', 'Ventas', 'Clientes', 'Deudores']],
      ['Almacén', ['Productos', 'Categorías']],
    ])
  })

  it('el bodeguero ve solo el almacén', () => {
    expect(labels('warehouse')).toEqual([
      ['Almacén', ['Inventario', 'Productos', 'Categorías', 'Proveedores']],
    ])
  })
})

describe('pantalla de inicio por rol', () => {
  it.each([
    ['admin', '/dashboard'],
    ['cashier', '/caja'],
    ['warehouse', '/inventario'],
  ] as const)('%s empieza en %s', (role, path) => {
    expect(homeFor(role)).toBe(path)
  })
})

describe('canAccess', () => {
  it('permite rutas sin restricción de rol', () => {
    expect(canAccess('cashier', undefined)).toBe(true)
  })

  it('respeta la lista de roles de la ruta', () => {
    expect(canAccess('cashier', ['admin'])).toBe(false)
    expect(canAccess('admin', ['admin'])).toBe(true)
  })
})
