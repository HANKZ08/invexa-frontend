<script setup lang="ts">
/** Usuarios del personal: alta sin contraseña, edición, reenvío de código y desactivación. */
import { Ban, Mail, Pencil } from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiDialog from '@/components/UiDialog.vue'
import UiSearch from '@/components/UiSearch.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiSelect from '@/components/UiSelect.vue'
import UiPagination from '@/components/UiPagination.vue'
import { usePagedList } from '@/composables/usePagedList'
import UiTable, { type TableColumn } from '@/components/UiTable.vue'
import { toast } from '@/composables/useToast'

import {
  accountStatus,
  createUser,
  deactivateUser,
  fetchUsers,
  resendVerification,
  STATUS_LABEL,
  updateUser,
  type AppUser,
  type Role,
  type UserForm,
} from '../api'

const queryClient = useQueryClient()
const users = useQuery({ queryKey: ['users'], queryFn: fetchUsers })

const roleFilter = ref('')
const search = ref('')
const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (users.data.value?.results ?? []).filter(
    (u) =>
      (!roleFilter.value || u.role === roleFilter.value) &&
      (!term ||
        [u.username, u.first_name, u.last_name, u.email].some((v) =>
          v.toLowerCase().includes(term),
        )),
  ) as unknown as Record<string, unknown>[]
})
const { page, pageSize, count, pageItems } = usePagedList(rows)
const asUser = (row: Record<string, unknown>) => row as unknown as AppUser

const ROLE_OPTIONS = [
  { value: 'cashier', label: 'Cajero' },
  { value: 'warehouse', label: 'Bodeguero' },
  { value: 'admin', label: 'Administrador' },
]

const columns: TableColumn[] = [
  { key: 'first_name', label: 'Nombre' },
  { key: 'username', label: 'Usuario' },
  { key: 'email', label: 'Correo' },
  { key: 'role_display', label: 'Rol' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: '' },
]

// --- Formulario --------------------------------------------------------------
const open = ref(false)
const editing = ref<AppUser | null>(null)
const form = reactive<UserForm>({
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  role: 'cashier',
})
const errors = reactive<Record<string, string | undefined>>({})
const formError = ref('')

function resetErrors() {
  for (const key of Object.keys(errors)) errors[key] = undefined
  formError.value = ''
}

function openNew() {
  editing.value = null
  Object.assign(form, { username: '', first_name: '', last_name: '', email: '', role: 'cashier' })
  resetErrors()
  open.value = true
}

function openEdit(user: AppUser) {
  editing.value = user
  Object.assign(form, {
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
  })
  resetErrors()
  open.value = true
}

const save = useMutation({
  mutationFn: () => {
    const body: UserForm = {
      username: form.username.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      role: form.role as Role,
    }
    return editing.value ? updateUser(editing.value.id, body) : createUser(body)
  },
  onSuccess: (saved) => {
    toast.success(
      editing.value
        ? `Datos de ${saved.username} guardados.`
        : `Cuenta creada. Se envió un código de activación a ${saved.email}.`,
    )
    queryClient.invalidateQueries({ queryKey: ['users'] })
    open.value = false
  },
  onError: (error) => {
    if (!(error instanceof ApiError)) {
      formError.value = 'No pudimos guardar el usuario.'
      return
    }
    errors.username = error.fieldError('username')
    errors.email = error.fieldError('email')
    errors.role = error.fieldError('role')
    formError.value = errors.username || errors.email || errors.role ? '' : error.message
  },
})

function submit() {
  resetErrors()
  errors.username = form.username.trim() ? undefined : 'Escribe el usuario.'
  errors.email = /^\S+@\S+\.\S+$/.test(form.email.trim()) ? undefined : 'Escribe un correo válido.'
  if (errors.username || errors.email) return
  save.mutate()
}

// --- Acciones ----------------------------------------------------------------
const resend = useMutation({
  mutationFn: (id: number) => resendVerification(id),
  onSuccess: () => toast.info('Enviamos un código de activación nuevo.'),
  onError: (error) =>
    toast.error(error instanceof ApiError ? error.message : 'No pudimos reenviar el código.'),
})

const toDeactivate = ref<AppUser | null>(null)
const deactivate = useMutation({
  mutationFn: (user: AppUser) => deactivateUser(user.id),
  onSuccess: (_, user) => {
    toast.success(`${user.username} quedó inactivo. Sus ventas se conservan.`)
    toDeactivate.value = null
    queryClient.invalidateQueries({ queryKey: ['users'] })
  },
  onError: (error) =>
    toast.error(error instanceof ApiError ? error.message : 'No pudimos desactivar la cuenta.'),
})

void updateUser
</script>

<template>
  <section class="page">
    <header class="head">
      <div>
        <h1>Usuarios</h1>
        <p class="sub">
          Cuentas del personal. Cada persona elige su contraseña al activar su cuenta.
        </p>
      </div>
      <UiButton variant="primary" @click="openNew">Nuevo usuario</UiButton>
    </header>

    <div class="filters">
      <UiSearch v-model="search" label="Buscar" placeholder="Nombre, usuario o correo" />
      <label class="field"
        ><span>Rol</span>
        <select v-model="roleFilter" name="role-filter">
          <option value="">Todos</option>
          <option v-for="r in ROLE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
      </label>
    </div>

    <article class="sheet">
      <UiTable
        caption="Usuarios"
        :columns="columns"
        :rows="pageItems"
        :loading="users.isPending.value"
        :error="users.isError.value ? 'No se pudieron cargar los usuarios.' : undefined"
        empty-text="No hay usuarios con estos filtros."
        @retry="users.refetch()"
      >
        <template #cell-status="{ row }">
          <span class="tag" :class="accountStatus(asUser(row))">{{
            STATUS_LABEL[accountStatus(asUser(row))]
          }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <UiButton size="sm" variant="ghost" @click="openEdit(asUser(row))"
              ><Pencil :size="14" aria-hidden="true" /> Editar</UiButton
            >
            <UiButton
              v-if="accountStatus(asUser(row)) === 'pending'"
              size="sm"
              variant="secondary"
              :loading="resend.isPending.value"
              @click="resend.mutate(asUser(row).id)"
            >
              <Mail :size="14" aria-hidden="true" /> Reenviar código
            </UiButton>
            <UiButton
              v-if="accountStatus(asUser(row)) !== 'inactive'"
              size="sm"
              variant="danger"
              @click="toDeactivate = asUser(row)"
            >
              <Ban :size="14" aria-hidden="true" /> Desactivar
            </UiButton>
          </div>
        </template>
      </UiTable>
      <UiPagination v-model:page="page" v-model:page-size="pageSize" :count="count" />
    </article>

    <UiDialog
      v-model:open="open"
      :title="editing ? 'Editar usuario' : 'Nuevo usuario'"
      :description="
        editing
          ? ''
          : 'La persona elige su contraseña al activar su cuenta con el código del correo.'
      "
    >
      <form novalidate class="form" @submit.prevent="submit">
        <div class="two">
          <UiField v-slot="f" label="Nombres">
            <UiInput
              :id="f.id"
              v-model="form.first_name"
              name="first_name"
              :aria-describedby="f.describedBy"
            />
          </UiField>
          <UiField v-slot="f" label="Apellidos">
            <UiInput
              :id="f.id"
              v-model="form.last_name"
              name="last_name"
              :aria-describedby="f.describedBy"
            />
          </UiField>
        </div>
        <UiField v-slot="f" label="Usuario" :error="errors.username" required>
          <UiInput
            :id="f.id"
            v-model="form.username"
            name="username"
            autocomplete="off"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="Correo" :error="errors.email" required>
          <UiInput
            :id="f.id"
            v-model="form.email"
            name="email"
            type="email"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="Rol" :error="errors.role" required>
          <UiSelect
            :id="f.id"
            v-model="form.role"
            name="role"
            :options="ROLE_OPTIONS"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="actions">
          <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
          <UiButton type="submit" variant="primary" :loading="save.isPending.value"
            >Guardar</UiButton
          >
        </div>
      </form>
    </UiDialog>

    <UiDialog
      :open="!!toDeactivate"
      title="Desactivar usuario"
      :description="
        toDeactivate
          ? `${toDeactivate.username} ya no podrá entrar. Sus ventas y movimientos se conservan.`
          : ''
      "
      @update:open="
        (v: boolean) => {
          if (!v) toDeactivate = null
        }
      "
    >
      <template #footer>
        <UiButton variant="ghost" @click="toDeactivate = null">Volver</UiButton>
        <UiButton
          variant="danger"
          :loading="deactivate.isPending.value"
          @click="toDeactivate && deactivate.mutate(toDeactivate)"
          >Desactivar</UiButton
        >
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.page {
  padding: var(--space-8);
  display: grid;
  gap: var(--space-5);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: var(--space-4);
  flex-wrap: wrap;
}
h1 {
  font-size: var(--text-4xl);
}
.sub {
  color: var(--ink-3);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: start;
}
.filters > * {
  min-width: 200px;
}
.field {
  display: grid;
  gap: var(--space-1);
  font-weight: 600;
}
.field select {
  font: inherit;
  padding: var(--space-2) var(--space-3);
  background: var(--sheet);
  color: var(--ink);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
}
.sheet {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-5);
  overflow-x: auto;
}
.tag {
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  white-space: nowrap;
}
.tag.active {
  background: var(--copy-green);
  color: var(--copy-green-ink);
}
.tag.pending {
  background: var(--copy-yellow);
  color: var(--copy-yellow-ink);
}
.tag.inactive {
  background: var(--rule);
  color: var(--ink-2);
}
.row-actions {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
  flex-wrap: wrap;
}
.form {
  display: grid;
  gap: var(--space-4);
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
.form-error {
  color: var(--copy-pink-ink);
  background: var(--copy-pink);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
}
@media (max-width: 640px) {
  .page {
    padding: var(--space-4);
  }
  .two {
    grid-template-columns: 1fr;
  }
}
</style>
