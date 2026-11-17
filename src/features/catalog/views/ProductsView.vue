<script setup lang="ts">
/** Catálogo de productos: búsqueda, filtros, paginación y alta/edición según el rol. */
import { Ban, Pencil } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiDialog from '@/components/UiDialog.vue'
import UiSearch from '@/components/UiSearch.vue'
import UiPagination from '@/components/UiPagination.vue'
import UiSelect from '@/components/UiSelect.vue'
import UiTable, { type TableColumn, type TableSort } from '@/components/UiTable.vue'
import UiField from '@/components/UiField.vue'
import { toast } from '@/composables/useToast'
import { formatMoney } from '@/utils/format'
import { useSessionStore } from '@/stores/session'

import { fetchCategories, fetchProducts, fetchSuppliers, updateProduct, type Product } from '../api'
import ProductFormDialog from '../components/ProductFormDialog.vue'

const session = useSessionStore()
const queryClient = useQueryClient()
const canWrite = computed(() => session.role === 'admin' || session.role === 'warehouse')

const search = ref('')
const debounced = ref('')
const category = ref('')
const supplier = ref('')
const lowStock = ref(false)
const sort = ref<TableSort | null>({ key: 'name', direction: 'asc' })
const page = ref(1)
const pageSize = ref(25)
let timer: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    debounced.value = value.trim()
    page.value = 1
  }, 300)
})
watch([category, supplier, lowStock, sort], () => (page.value = 1))

const ordering = computed(() =>
  sort.value
    ? sort.value.direction === 'desc'
      ? `-${sort.value.key}`
      : sort.value.key
    : undefined,
)

const products = useQuery({
  queryKey: computed(() => [
    'products',
    {
      search: debounced.value,
      category: category.value,
      supplier: supplier.value,
      lowStock: lowStock.value,
      ordering: ordering.value,
      page: page.value,
      pageSize: pageSize.value,
    },
  ]),
  queryFn: () =>
    fetchProducts({
      search: debounced.value || undefined,
      category: category.value ? Number(category.value) : undefined,
      supplier: supplier.value ? Number(supplier.value) : undefined,
      low_stock: lowStock.value || undefined,
      ordering: ordering.value,
      page: page.value,
      page_size: pageSize.value,
    }),
  placeholderData: (previous) => previous,
})
const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliers })

const categoryOptions = computed(() =>
  (categories.data.value?.results ?? []).map((c) => ({ value: c.id, label: c.name })),
)
const supplierOptions = computed(() =>
  (suppliers.data.value?.results ?? []).map((s) => ({ value: s.id, label: s.name })),
)

const columns = computed<TableColumn[]>(() => [
  { key: 'sku', label: 'SKU', sortable: true },
  { key: 'name', label: 'Producto', sortable: true },
  { key: 'category_name', label: 'Categoría', hideOnMobile: true, hideOnNarrow: true },
  { key: 'sale_price', label: 'Precio', align: 'right', sortable: true },
  { key: 'stock', label: 'Stock', align: 'right', sortable: true },
  ...(canWrite.value ? [{ key: 'actions', label: '' }] : []),
])

const formOpen = ref(false)
const editing = ref<Product | null>(null)
function openNew() {
  editing.value = null
  formOpen.value = true
}
function openEdit(product: Product) {
  editing.value = product
  formOpen.value = true
}

const toDeactivate = ref<Product | null>(null)
const deactivate = useMutation({
  mutationFn: (product: Product) => updateProduct(product.id, { is_active: false }),
  onSuccess: (product) => {
    toast.success(`Producto ${product.sku} desactivado.`)
    toDeactivate.value = null
    queryClient.invalidateQueries({ queryKey: ['products'] })
  },
  onError: (error) =>
    toast.error(error instanceof ApiError ? error.message : 'No pudimos desactivar el producto.'),
})

const hasFilters = computed(
  () => !!(debounced.value || category.value || supplier.value || lowStock.value),
)
function clearFilters() {
  search.value = ''
  debounced.value = ''
  category.value = ''
  supplier.value = ''
  lowStock.value = false
}
</script>

<template>
  <section class="catalog">
    <header class="head">
      <div>
        <h1>Productos</h1>
        <p class="sub">{{ products.data.value?.count ?? 0 }} productos en el catálogo</p>
      </div>
      <UiButton v-if="canWrite" variant="primary" @click="openNew">Nuevo producto</UiButton>
    </header>

    <div class="filters">
      <UiSearch v-model="search" label="Buscar" placeholder="Nombre, SKU o código de barras" />
      <UiField v-slot="f" label="Categoría">
        <UiSelect :id="f.id" v-model="category" :options="categoryOptions" placeholder="Todas" />
      </UiField>
      <UiField v-slot="f" label="Proveedor">
        <UiSelect :id="f.id" v-model="supplier" :options="supplierOptions" placeholder="Todos" />
      </UiField>
      <label class="check">
        <input v-model="lowStock" type="checkbox" name="low-stock" />
        Solo stock bajo
      </label>
      <UiButton v-if="hasFilters" variant="ghost" size="sm" @click="clearFilters"
        >Limpiar filtros</UiButton
      >
    </div>

    <article class="sheet">
      <UiTable
        v-model:sort="sort"
        caption="Productos"
        :columns="columns"
        :rows="(products.data.value?.results ?? []) as unknown as Record<string, unknown>[]"
        :loading="products.isPending.value"
        :error="products.isError.value ? 'No se pudieron cargar los productos.' : undefined"
        empty-text="No hay productos que coincidan."
        @retry="products.refetch()"
      >
        <template #empty>
          <p class="empty">
            {{
              hasFilters
                ? 'No hay productos que coincidan con los filtros.'
                : 'Aún no hay productos.'
            }}
          </p>
          <UiButton v-if="hasFilters" size="sm" variant="ghost" @click="clearFilters"
            >Limpiar filtros</UiButton
          >
          <UiButton v-else-if="canWrite" size="sm" variant="primary" @click="openNew"
            >Nuevo producto</UiButton
          >
        </template>
        <template #cell-sku="{ value }"
          ><span class="sku">{{ value }}</span></template
        >
        <template #cell-sale_price="{ row }">{{
          formatMoney((row as unknown as Product).sale_price)
        }}</template>
        <template #cell-stock="{ row }">
          <span class="stock" :class="{ low: (row as unknown as Product).is_low_stock }">
            {{ (row as unknown as Product).stock }}
            <span v-if="(row as unknown as Product).is_low_stock" class="tag">Reponer</span>
          </span>
        </template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <UiButton size="sm" variant="ghost" @click="openEdit(row as unknown as Product)"
              ><Pencil :size="14" aria-hidden="true" /> Editar</UiButton
            >
            <UiButton
              v-if="(row as unknown as Product).is_active"
              size="sm"
              variant="ghost"
              @click="toDeactivate = row as unknown as Product"
            >
              <Ban :size="14" aria-hidden="true" /> Desactivar
            </UiButton>
          </div>
        </template>
      </UiTable>
      <UiPagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :count="products.data.value?.count ?? 0"
      />
    </article>

    <ProductFormDialog v-model:open="formOpen" :product="editing" />

    <UiDialog
      :open="!!toDeactivate"
      title="Desactivar producto"
      :description="
        toDeactivate
          ? `${toDeactivate.sku} · ${toDeactivate.name} dejará de aparecer para vender. Su historial se conserva.`
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
        >
          Desactivar
        </UiButton>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.catalog {
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
  min-width: 180px;
}
.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
  padding-bottom: var(--space-2);
}
.sheet {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-5);
}
.sku {
  font-stretch: var(--stretch-narrow);
  font-weight: 700;
  color: var(--ink-2);
  white-space: nowrap;
}
.stock.low {
  color: var(--red);
  font-weight: 700;
}
.tag {
  margin-left: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 1px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--copy-yellow);
  color: var(--copy-yellow-ink);
}
.row-actions {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}
.empty {
  color: var(--ink-3);
  margin-bottom: var(--space-3);
}
@media (max-width: 640px) {
  .catalog {
    padding: var(--space-4);
  }
}
</style>
