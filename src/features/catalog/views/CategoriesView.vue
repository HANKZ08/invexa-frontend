<script setup lang="ts">
/** Categorías del catálogo. Cualquier rol las ve; solo bodeguero y administrador las crean. */
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
import { useSessionStore } from '@/stores/session'

import { fetchCategories, type Category } from '../api'

const session = useSessionStore()
const queryClient = useQueryClient()
const canWrite = computed(() => session.role === 'admin' || session.role === 'warehouse')

const categories = useQuery({ queryKey: ['categories-list'], queryFn: fetchCategories })
const columns: TableColumn[] = [
  { key: 'name', label: 'Categoría', sortable: true },
  { key: 'description', label: 'Descripción' },
  { key: 'products_count', label: 'Productos', align: 'right' },
]

const open = ref(false)
const form = reactive({ name: '', description: '' })
const errors = reactive<{ name?: string }>({})
const formError = ref('')

function openNew() {
  Object.assign(form, { name: '', description: '' })
  errors.name = undefined
  formError.value = ''
  open.value = true
}

const save = useMutation({
  mutationFn: () =>
    unwrap(
      api.POST('/api/categories/', {
        body: { name: form.name.trim(), description: form.description },
      }),
    ),
  onSuccess: (created) => {
    toast.success(`Categoría ${created.name} creada.`)
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['categories-list'] })
    open.value = false
  },
  onError: (error) => {
    if (error instanceof ApiError) {
      errors.name = error.fieldError('name')
      formError.value = errors.name ? '' : error.message
    } else {
      formError.value = 'No pudimos guardar la categoría.'
    }
  },
})

function submit() {
  errors.name = form.name.trim() ? undefined : 'Escribe el nombre de la categoría.'
  formError.value = ''
  if (errors.name) return
  save.mutate()
}

const rows = computed(
  () => (categories.data.value?.results ?? []) as unknown as Record<string, unknown>[],
)
const { page, pageSize, count, pageItems } = usePagedList(rows)
</script>

<template>
  <section class="page">
    <header class="head">
      <div>
        <h1>Categorías</h1>
        <p class="sub">Agrupan los productos del catálogo.</p>
      </div>
      <UiButton v-if="canWrite" variant="primary" @click="openNew">Nueva categoría</UiButton>
    </header>

    <article class="sheet">
      <UiTable
        caption="Categorías"
        :columns="columns"
        :rows="pageItems"
        :loading="categories.isPending.value"
        :error="categories.isError.value ? 'No se pudieron cargar las categorías.' : undefined"
        empty-text="Aún no hay categorías."
        @retry="categories.refetch()"
      >
        <template #cell-products_count="{ row }">{{
          (row as unknown as Category).products_count
        }}</template>
      </UiTable>
      <UiPagination v-model:page="page" v-model:page-size="pageSize" :count="count" />
    </article>

    <UiDialog v-model:open="open" title="Nueva categoría">
      <form novalidate class="form" @submit.prevent="submit">
        <UiField v-slot="f" label="Nombre" :error="errors.name" required>
          <UiInput
            :id="f.id"
            v-model="form.name"
            name="name"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="Descripción">
          <UiInput
            :id="f.id"
            v-model="form.description"
            name="description"
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
</style>
