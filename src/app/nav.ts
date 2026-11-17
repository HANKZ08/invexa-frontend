/**
 * Mapa de navegación por rol (ver SPEC.md → Navegación por rol).
 * El backend es la barrera real; esto solo ordena lo que cada rol ve.
 */
import type { Component } from 'vue'
import {
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  UserRound,
  Users,
} from 'lucide-vue-next'

export type Role = 'admin' | 'cashier' | 'warehouse'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  cashier: 'Cajero',
  warehouse: 'Bodeguero',
}

export interface NavItem {
  label: string
  to: string
  icon: Component
  roles: Role[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const ALL: Role[] = ['admin', 'cashier', 'warehouse']

const NAV: NavGroup[] = [
  {
    label: 'Negocio',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
      { label: 'Usuarios', to: '/usuarios', icon: Users, roles: ['admin'] },
      { label: 'Configuración', to: '/configuracion', icon: Settings, roles: ['admin'] },
    ],
  },
  {
    label: 'Venta',
    items: [
      { label: 'Caja', to: '/caja', icon: ShoppingCart, roles: ['admin', 'cashier'] },
      { label: 'Ventas', to: '/ventas', icon: ReceiptText, roles: ['admin', 'cashier'] },
      { label: 'Clientes', to: '/clientes', icon: UserRound, roles: ['admin', 'cashier'] },
      { label: 'Deudores', to: '/deudores', icon: HandCoins, roles: ['admin', 'cashier'] },
    ],
  },
  {
    label: 'Almacén',
    items: [
      {
        label: 'Inventario',
        to: '/inventario',
        icon: ClipboardList,
        roles: ['admin', 'warehouse'],
      },
      { label: 'Productos', to: '/productos', icon: Package, roles: ALL },
      { label: 'Categorías', to: '/categorias', icon: Tags, roles: ALL },
      { label: 'Proveedores', to: '/proveedores', icon: Truck, roles: ['admin', 'warehouse'] },
    ],
  },
]

/** Grupos de navegación visibles para el rol (sin grupos vacíos). */
export function navFor(role: Role): NavGroup[] {
  return NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)
}

const HOME: Record<Role, string> = {
  admin: '/dashboard',
  cashier: '/caja',
  warehouse: '/inventario',
}

/** Pantalla de inicio de cada rol. */
export function homeFor(role: Role): string {
  return HOME[role]
}

/** Si el rol puede abrir una ruta con `meta.roles`; sin lista, la ruta es para todos. */
export function canAccess(role: Role, roles: readonly Role[] | undefined): boolean {
  return !roles || roles.includes(role)
}
