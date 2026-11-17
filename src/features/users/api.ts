/** Gestión de usuarios del personal (solo administrador). */
import { api, unwrap } from '@/api/client'

export type Role = 'admin' | 'cashier' | 'warehouse'

export interface AppUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  role: Role
  role_display: string
  is_active: boolean
  email_verified_at: string | null
}

export interface UserForm {
  username: string
  first_name: string
  last_name: string
  email: string
  role: Role
}

/** Estado legible de la cuenta: activa, pendiente de verificar o inactiva. */
export function accountStatus(user: AppUser): 'active' | 'pending' | 'inactive' {
  // Una cuenta nueva aún no verificada está pendiente aunque no esté activa.
  if (!user.email_verified_at) return 'pending'
  return user.is_active ? 'active' : 'inactive'
}

export const STATUS_LABEL = {
  active: 'Activo',
  pending: 'Pendiente de verificar',
  inactive: 'Inactivo',
} as const

export function fetchUsers() {
  return unwrap(
    api.GET('/api/users/', { params: { query: { page_size: 100 } as never } }),
  ) as Promise<{
    results: AppUser[]
  }>
}

export function createUser(body: UserForm) {
  return unwrap(api.POST('/api/users/', { body: body as never })) as Promise<AppUser>
}

export function updateUser(id: number, body: Partial<UserForm>) {
  return unwrap(
    api.PATCH('/api/users/{id}/', { params: { path: { id } }, body: body as never }),
  ) as Promise<AppUser>
}

export function resendVerification(id: number) {
  return unwrap(api.POST('/api/users/{id}/resend-verification/', { params: { path: { id } } }))
}

export function deactivateUser(id: number) {
  return unwrap(api.DELETE('/api/users/{id}/', { params: { path: { id } } }))
}
