<script setup lang="ts">
/** Clientes: búsqueda, alta y edición. Un DNI (8) o RUC (11) válido es obligatorio. */
import { Pencil } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiDialog from '@/components/UiDialog.vue'
import UiSearch from '@/components/UiSearch.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiPagination from '@/components/UiPagination.vue'
import UiTable, { type TableColumn } from '@/components/UiTable.vue'
import { toast } from '@/composables/useToast'

import { fetchCustomers, isDocumentValid, saveCustomer, type CustomerRow } from '../api'

const queryClient = useQueryClient()
const search = ref('')
const debounced = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    debounced.value = value.trim()
    page.value = 1
  }, 300)
})

const page = ref(1)
const pageSize = ref(25)
const customers = useQuery({
  queryKey: computed(() => ['customers', debounced.value, page.value, pageSize.value]),
  queryFn: () => fetchCustomers(debounced.value, page.value, pageSize.value),
  placeholderData: (previous) => previous,
})

const columns: TableColumn[] = [
  { key: 'name', label: 'Nombre', sortable: false },
  { key: 'document_id', label: 'Documento' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Correo' },
  { key: 'actions', label: '' },
]
const rows = computed(
  () => (customers.data.value?.results ?? []) as unknown as Record<string, unknown>[],
)

watch(pageSize, () => (page.value = 1))

const open = ref(false)
const editing = ref<CustomerRow | null>(null)
const form = reactive({ name: '', document_id: '', email: '', phone: '' })
const errors = reactive<Record<string, string | undefined>>({})
const formError = ref('')

function openNew() {
  editing.value = null
  Object.assign(form, { name: '', document_id: '', email: '', phone: '' })
  for (const key of Object.keys(errors)) errors[key] = undefined
  formError.value = ''
  open.value = true
}
function openEdit(customer: CustomerRow) {
  editing.value = customer
  Object.assign(form, {
    name: customer.name,
    document_id: customer.document_id,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
  })
  for (const key of Object.keys(errors)) errors[key] = undefined
  formError.value = ''
  open.value = true
}

const save = useMutation({
  mutationFn: () =>
    saveCustomer(
      {
        name: form.name.trim(),
        document_id: form.document_id.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      },
      editing.value?.id,
    ),
  onSuccess: (saved) => {
    toast.success(`Cliente ${saved.name} guardado.`)
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    open.value = false
  },
  onError: (error) => {
    if (error instanceof ApiError) {
      errors.document_id = error.fieldError('document_id')
      errors.email = error.fieldError('email')
      formError.value = errors.document_id || errors.email ? '' : error.message
    } else {
      formError.value = 'No pudimos guardar el cliente.'
    }
  },
})

function submit() {
  errors.name = form.name.trim() ? undefined : 'Escribe el nombre del cliente.'
  errors.document_id = isDocumentValid(form.document_id)
    ? undefined
    : 'El DNI debe tener 8 dígitos o el RUC 11.'
  errors.email =
    !form.email || /^\S+@\S+\.\S+$/.test(form.email) ? undefined : 'Escribe un correo válido.'
  formError.value = ''
  if (errors.name || errors.document_id || errors.email) return
  save.mutate()
}
</script>

<template>
  <section class="page">
    <header class="head">
      <div>
        <h1>Clientes</h1>
        <p class="sub">Clientes frecuentes para la caja y las facturas.</p>
      </div>
      <UiButton variant="primary" @click="openNew">Nuevo cliente</UiButton>
    </header>

    <UiSearch v-model="search" label="Buscar" placeholder="Nombre, DNI, RUC o correo" />

    <article class="sheet">
      <UiTable
        caption="Clientes"
        :columns="columns"
        :rows="rows"
        :loading="customers.isPending.value"
        :error="customers.isError.value ? 'No se pudieron cargar los clientes.' : undefined"
        empty-text="Aún no hay clientes."
        @retry="customers.refetch()"
      >
        <template #cell-actions="{ row }">
          <UiButton size="sm" variant="ghost" @click="openEdit(row as unknown as CustomerRow)"
            ><Pencil :size="14" aria-hidden="true" /> Editar</UiButton
          >
        </template>
      </UiTable>
    </article>

    <UiDialog v-model:open="open" :title="editing ? 'Editar cliente' : 'Nuevo cliente'">
      <form novalidate class="form" @submit.prevent="submit">
        <UiField v-slot="f" label="Nombre o razón social" :error="errors.name" required>
          <UiInput
            :id="f.id"
            v-model="form.name"
            name="name"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
          <UiPagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :count="customers.data.value?.count ?? 0"
          />
        </UiField>
        <UiField
          v-slot="f"
          label="DNI o RUC"
          :error="errors.document_id"
          required
          hint="8 dígitos (DNI) o 11 (RUC)."
        >
          <UiInput
            :id="f.id"
            v-model="form.document_id"
            name="document_id"
            inputmode="numeric"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <div class="two">
          <UiField v-slot="f" label="Teléfono">
            <UiInput
              :id="f.id"
              v-model="form.phone"
              name="phone"
              inputmode="tel"
              :aria-describedby="f.describedBy"
            />
          </UiField>
          <UiField v-slot="f" label="Correo" :error="errors.email">
            <UiInput
              :id="f.id"
              v-model="form.email"
              name="email"
              type="email"
              :invalid="f.invalid"
              :aria-describedby="f.describedBy"
            />
          </UiField>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="actions">
          <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
          <UiButton type="submit" variant="primary" :loading="save.isPending.value"
            >Guardar</UiButton
          >
        </div>
      </form>
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
.sheet {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-5);
  overflow-x: auto;
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
  .two {
    grid-template-columns: 1fr;
  }
  .page {
    padding: var(--space-4);
  }
}
</style>
