<script setup lang="ts">
/** Proveedores: solo bodeguero y administrador. El RUC se valida en el campo (11 dígitos). */
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { api, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiDialog from '@/components/UiDialog.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiPagination from '@/components/UiPagination.vue'
import { usePagedList } from '@/composables/usePagedList'
import UiTable, { type TableColumn } from '@/components/UiTable.vue'
import { toast } from '@/composables/useToast'

import { fetchSuppliers } from '../api'

const queryClient = useQueryClient()
const suppliers = useQuery({ queryKey: ['suppliers-list'], queryFn: fetchSuppliers })
const columns: TableColumn[] = [
  { key: 'name', label: 'Proveedor', sortable: true },
  { key: 'tax_id', label: 'RUC' },
  { key: 'contact_name', label: 'Contacto' },
  { key: 'phone', label: 'Teléfono' },
]

const open = ref(false)
const form = reactive({ name: '', tax_id: '', contact_name: '', email: '', phone: '', address: '' })
const errors = reactive<Record<string, string | undefined>>({})
const formError = ref('')

function openNew() {
  Object.assign(form, { name: '', tax_id: '', contact_name: '', email: '', phone: '', address: '' })
  for (const key of Object.keys(errors)) errors[key] = undefined
  formError.value = ''
  open.value = true
}

const save = useMutation({
  mutationFn: () =>
    unwrap(
      api.POST('/api/suppliers/', {
        body: { ...form, name: form.name.trim(), tax_id: form.tax_id.trim() },
      }),
    ),
  onSuccess: (created) => {
    toast.success(`Proveedor ${created.name} guardado.`)
    queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    queryClient.invalidateQueries({ queryKey: ['suppliers-list'] })
    open.value = false
  },
  onError: (error) => {
    if (error instanceof ApiError) {
      for (const field of ['name', 'tax_id', 'email']) errors[field] = error.fieldError(field)
      formError.value = Object.values(errors).some(Boolean) ? '' : error.message
    } else {
      formError.value = 'No pudimos guardar el proveedor.'
    }
  },
})

// Proveedores se pagina en memoria sobre la lista cargada.
const supplierRows = computed(
  () => (suppliers.data.value?.results ?? []) as unknown as Record<string, unknown>[],
)
const { page, pageSize, count, pageItems } = usePagedList(supplierRows)

function submit() {
  errors.name = form.name.trim() ? undefined : 'Escribe el nombre del proveedor.'
  errors.tax_id = /^\d{11}$/.test(form.tax_id.trim()) ? undefined : 'El RUC debe tener 11 dígitos.'
  errors.email =
    !form.email || /^\S+@\S+\.\S+$/.test(form.email) ? undefined : 'Escribe un correo válido.'
  formError.value = ''
  if (Object.values(errors).some(Boolean)) return
  save.mutate()
}
</script>

<template>
  <section class="page">
    <header class="head">
      <div>
        <h1>Proveedores</h1>
        <p class="sub">Quién abastece la ferretería.</p>
      </div>
      <UiButton variant="primary" @click="openNew">Nuevo proveedor</UiButton>
    </header>

    <article class="sheet">
      <UiTable
        caption="Proveedores"
        :columns="columns"
        :rows="pageItems"
        :loading="suppliers.isPending.value"
        :error="suppliers.isError.value ? 'No se pudieron cargar los proveedores.' : undefined"
        empty-text="Aún no hay proveedores."
        @retry="suppliers.refetch()"
      />
      <UiPagination v-model:page="page" v-model:page-size="pageSize" :count="count" />
    </article>

    <UiDialog v-model:open="open" title="Nuevo proveedor">
      <form novalidate class="form" @submit.prevent="submit">
        <UiField v-slot="f" label="Razón social" :error="errors.name" required>
          <UiInput
            :id="f.id"
            v-model="form.name"
            name="name"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="RUC" :error="errors.tax_id" required hint="11 dígitos.">
          <UiInput
            :id="f.id"
            v-model="form.tax_id"
            name="tax_id"
            inputmode="numeric"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <div class="two">
          <UiField v-slot="f" label="Contacto">
            <UiInput
              :id="f.id"
              v-model="form.contact_name"
              name="contact_name"
              :aria-describedby="f.describedBy"
            />
          </UiField>
          <UiField v-slot="f" label="Teléfono">
            <UiInput
              :id="f.id"
              v-model="form.phone"
              name="phone"
              inputmode="tel"
              :aria-describedby="f.describedBy"
            />
          </UiField>
        </div>
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
}
</style>
