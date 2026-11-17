import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { toast } from '@/composables/useToast'
import { useSessionStore } from '@/stores/session'
import { useShopStore } from '@/stores/shop'

import AppShell from './AppShell.vue'
import { canAccess, homeFor, type Role } from './nav'
import PlaceholderView from './views/PlaceholderView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Título de la pestaña y de la pantalla. */
    title?: string
    /** Roles que pueden abrir la ruta; sin lista, todos los que tengan sesión. */
    roles?: Role[]
    /** Tarea del plan donde se construye (solo pantallas pendientes). */
    task?: string
    /** Ruta pública: no pide sesión. */
    public?: boolean
  }
}

const ALL: Role[] = ['admin', 'cashier', 'warehouse']

/** Secciones de la app; cada una se reemplaza por su vista real en su tarea. */
const sections: { path: string; title: string; roles: Role[]; task: string }[] = []

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/features/auth/views/LoginView.vue'),
    meta: { title: 'Iniciar sesión', public: true },
  },
  {
    path: '/recuperar',
    name: 'recuperar',
    component: () => import('@/features/auth/views/PasswordResetView.vue'),
    meta: { title: 'Recuperar contraseña', public: true },
  },
  {
    path: '/activar',
    name: 'activate',
    component: () => import('@/features/auth/views/ActivateView.vue'),
    meta: { title: 'Activar cuenta', public: true },
  },
  {
    path: '/',
    component: AppShell,
    children: [
      {
        path: '',
        name: 'home',
        redirect: () => ({ path: homeFor(useSessionStore().role ?? 'cashier') }),
      },
      ...sections.map(({ path, title, roles, task }) => ({
        path,
        name: path,
        component: PlaceholderView,
        meta: { title, roles, task },
      })),
      {
        path: 'productos',
        name: 'productos',
        component: () => import('@/features/catalog/views/ProductsView.vue'),
        meta: { title: 'Productos', roles: ALL },
      },
      {
        path: 'categorias',
        name: 'categorias',
        component: () => import('@/features/catalog/views/CategoriesView.vue'),
        meta: { title: 'Categorías', roles: ALL },
      },
      {
        path: 'proveedores',
        name: 'proveedores',
        component: () => import('@/features/catalog/views/SuppliersView.vue'),
        meta: { title: 'Proveedores', roles: ['admin', 'warehouse'] },
      },
      {
        path: 'inventario',
        name: 'inventario',
        component: () => import('@/features/stock/views/StockView.vue'),
        meta: { title: 'Inventario', roles: ['admin', 'warehouse'] },
      },
      {
        path: 'caja',
        name: 'caja',
        component: () => import('@/features/pos/views/CajaView.vue'),
        meta: { title: 'Caja', roles: ['admin', 'cashier'] },
      },
      {
        path: 'ventas',
        name: 'ventas',
        component: () => import('@/features/sales/views/SalesView.vue'),
        meta: { title: 'Ventas', roles: ['admin', 'cashier'] },
      },
      {
        path: 'clientes',
        name: 'clientes',
        component: () => import('@/features/sales/views/CustomersView.vue'),
        meta: { title: 'Clientes', roles: ['admin', 'cashier'] },
      },
      {
        path: 'deudores',
        name: 'deudores',
        component: () => import('@/features/debts/views/DebtorsView.vue'),
        meta: { title: 'Deudores', roles: ['admin', 'cashier'] },
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/features/reports/views/DashboardView.vue'),
        meta: { title: 'Dashboard', roles: ['admin'] },
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        component: () => import('@/features/users/views/UsersView.vue'),
        meta: { title: 'Usuarios', roles: ['admin'] },
      },
      {
        path: 'configuracion',
        name: 'configuracion',
        component: () => import('@/features/shop/views/SettingsView.vue'),
      },
      {
        path: 'cuenta',
        name: 'account',
        component: () => import('@/features/auth/views/AccountView.vue'),
        meta: { title: 'Mi cuenta', roles: ALL },
      },
    ],
  },
  {
    path: '/estado',
    name: 'health',
    component: () => import('@/views/HealthView.vue'),
    meta: { title: 'Estado de la API', public: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./views/NotFoundView.vue'),
    meta: { title: 'Página no encontrada', public: true },
  },
]

// Página de muestra del sistema visual: solo en desarrollo.
if (import.meta.env.DEV) {
  routes.splice(routes.length - 1, 0, {
    path: '/muestra',
    name: 'design-preview',
    component: () => import('@/views/DesignPreviewView.vue'),
    meta: { title: 'Muestra del sistema visual', public: true },
  })
}

/**
 * Guarda global: sin sesión → /login (con ?redirect=); rol sin permiso → su pantalla
 * de inicio con un aviso. Las rutas públicas no piden sesión.
 */
export function authGuard(to: {
  name?: unknown
  path: string
  fullPath: string
  meta: { public?: boolean; roles?: Role[] }
}) {
  const session = useSessionStore()
  if (to.meta.public) {
    if (to.name === 'login' && session.isAuthenticated) {
      return { path: homeFor(session.role ?? 'cashier') }
    }
    return true
  }
  if (!session.isAuthenticated || !session.role) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (!canAccess(session.role, to.meta.roles)) {
    toast.info('Tu rol no tiene acceso a esa pantalla.')
    return { path: homeFor(session.role) }
  }
  return true
}

export function setDocumentTitle(title: string | undefined): void {
  const shopName = useShopStore().name
  document.title = title ? `${title} · ${shopName}` : shopName
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(authGuard)
router.afterEach((to) => setDocumentTitle(to.meta.title))

export default router
