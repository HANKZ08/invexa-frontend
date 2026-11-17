<script setup lang="ts">
async function exportInventory() {
  try {
    await downloadFile(INVENTORY_EXPORT_PATH, 'inventario.xlsx')
  } catch {
    toast.error('No pudimos generar el Excel de inventario.')
  }
}

/** Kardex de movimientos y stock bajo. Solo bodeguero y administrador. */
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'

import UiButton from '@/components/UiButton.vue'
import UiDialog from '@/components/UiDialog.vue'
import UiSearch from '@/components/UiSearch.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiPagination from '@/components/UiPagination.vue'
import UiTable, { type TableColumn } from '@/components/UiTable.vue'
import { fetchProducts } from '@/features/catalog/api'
import { downloadFile, INVENTORY_EXPORT_PATH } from '@/features/reports/api'
import { toast } from '@/composables/useToast'
import { formatDateTime, formatNumber } from '@/utils/format'

import { fetchLowStock, fetchMovements, type MovementType, type StockMovement } from '../api'
import MovementDialog, { type StockProduct } from '../components/MovementDialog.vue'

type Tab = 'kardex' | 'low'
const tab = ref<Tab>('kardex')

// --- Kardex -----------------------------------------------------------------
const movementType = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const search = ref('')
const debounced = ref('')
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
watch([movementType, dateFrom, dateTo], () => (page.value = 1))

const movements = useQuery({
  queryKey: computed(() => [
    'stock-movements',
    {
      movementType: movementType.value,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      search: debounced.value,
      page: page.value,
      pageSize: pageSize.value,
    },
  ]),
  queryFn: () =>
    fetchMovements({
      movement_type: movementType.value || undefined,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      search: debounced.value || undefined,
      page: page.value,
      page_size: pageSize.value,
    }),
  placeholderData: (previous) => previous,
})

const hasFilters = computed(
  () => !!(movementType.value || dateFrom.value || dateTo.value || debounced.value),
)
function clearFilters() {
  movementType.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  search.value = ''
  debounced.value = ''
}

const kardexColumns: TableColumn[] = [
  { key: 'created_at', label: 'Fecha' },
  { key: 'product_sku', label: 'Producto' },
  { key: 'movement_type_display', label: 'Tipo' },
  { key: 'quantity', label: 'Cantidad', align: 'right' },
  { key: 'stock', label: 'Stock', align: 'right' },
  { key: 'user_name', label: 'Usuario' },
  { key: 'note', label: 'Nota' },
]

// --- Registrar: elegir producto primero --------------------------------------
const pickerOpen = ref(false)
const pickerSearch = ref('')
const pickerProducts = useQuery({
  queryKey: computed(() => ['stock-picker', pickerSearch.value]),
  queryFn: () => fetchProducts({ search: pickerSearch.value || undefined }),
  enabled: computed(() => pickerOpen.value),
})

const selected = ref<StockProduct | null>(null)
const formOpen = ref(false)
const initialType = ref<MovementType>('in')
function startMovement(product: StockProduct, type: MovementType = 'in') {
  selected.value = product
  initialType.value = type
  pickerOpen.value = false
  formOpen.value = true
}

// --- Stock bajo -------------------------------------------------------------
const lowStock = useQuery({
  queryKey: ['low-stock'],
  queryFn: fetchLowStock,
  enabled: computed(() => tab.value === 'low'),
})
const lowColumns: TableColumn[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Producto' },
  { key: 'stock', label: 'Stock', align: 'right' },
  { key: 'min_stock', label: 'Mínimo', align: 'right' },
  { key: 'actions', label: '' },
]
const lowRows = computed(() => (lowStock.data.value ?? []) as unknown as Record<string, unknown>[])

function asMovement(row: Record<string, unknown>): StockMovement {
  return row as unknown as StockMovement
}
</script>

<template>
  <section class="stock">
    <header class="head">
      <div>
        <h1>Inventario</h1>
        <p class="sub">Cada cambio de stock queda registrado: quién, cuándo y por qué.</p>
      </div>
      <div class="head-actions">
        <div class="tabs" role="tablist" aria-label="Vista">
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'kardex'"
            @click="tab = 'kardex'"
          >
            Kardex
          </button>
          <button type="button" role="tab" :aria-selected="tab === 'low'" @click="tab = 'low'">
            Stock bajo
          </button>
        </div>
        <UiButton variant="primary" @click="pickerOpen = true">Registrar movimiento</UiButton>
        <UiButton variant="secondary" @click="exportInventory"
          >Exportar inventario (Excel)</UiButton
        >
      </div>
    </header>

    <template v-if="tab === 'kardex'">
      <div class="filters">
        <UiSearch v-model="search" label="Buscar" placeholder="Producto o nota" />
        <label class="field">
          <span>Tipo</span>
          <select v-model="movementType" name="movement-type">
            <option value="">Todos</option>
            <option value="in">Entrada</option>
            <option value="out">Salida</option>
            <option value="adjustment">Conteo físico</option>
            <option value="sale">Venta</option>
            <option value="sale_cancellation">Anulación de venta</option>
          </select>
        </label>
        <label class="field">
          <span>Desde</span>
          <input v-model="dateFrom" type="date" name="date-from" />
        </label>
        <label class="field">
          <span>Hasta</span>
          <input v-model="dateTo" type="date" name="date-to" />
        </label>
        <UiButton v-if="hasFilters" variant="ghost" size="sm" @click="clearFilters"
          >Limpiar filtros</UiButton
        >
      </div>

      <article class="sheet">
        <UiTable
          caption="Kardex de movimientos"
          :columns="kardexColumns"
          :rows="(movements.data.value?.results ?? []) as unknown as Record<string, unknown>[]"
          :loading="movements.isPending.value"
          :error="movements.isError.value ? 'No se pudo cargar el kardex.' : undefined"
          empty-text="Aún no hay movimientos."
          @retry="movements.refetch()"
        >
          <template #empty>
            <p class="empty">
              {{ hasFilters ? 'No hay movimientos con estos filtros.' : 'Aún no hay movimientos.' }}
            </p>
            <UiButton v-if="hasFilters" size="sm" variant="ghost" @click="clearFilters"
              >Limpiar filtros</UiButton
            >
          </template>
          <template #cell-created_at="{ row }">{{
            formatDateTime(asMovement(row).created_at)
          }}</template>
          <template #cell-product_sku="{ row }">
            <span class="sku">{{ asMovement(row).product_sku }}</span>
            {{ asMovement(row).product_name }}
          </template>
          <template #cell-quantity="{ row }">
            <span class="num" :class="asMovement(row).quantity < 0 ? 'neg' : 'pos'">
              {{ asMovement(row).quantity > 0 ? '+' : ''
              }}{{ formatNumber(asMovement(row).quantity) }}
            </span>
          </template>
          <template #cell-stock="{ row }">
            <span class="num"
              >{{ asMovement(row).stock_before }} → {{ asMovement(row).stock_after }}</span
            >
          </template>
        </UiTable>
        <UiPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :count="movements.data.value?.count ?? 0"
        />
      </article>
    </template>

    <template v-else>
      <article class="sheet">
        <UiTable
          caption="Productos con stock bajo"
          :columns="lowColumns"
          :rows="lowRows"
          :loading="lowStock.isPending.value"
          :error="lowStock.isError.value ? 'No se pudo cargar el stock bajo.' : undefined"
          empty-text="Ningún producto está bajo su mínimo."
          @retry="lowStock.refetch()"
        >
          <template #cell-stock="{ row }"
            ><span class="num low">{{ (row as unknown as StockProduct).stock }}</span></template
          >
          <template #cell-actions="{ row }">
            <UiButton
              size="sm"
              variant="secondary"
              @click="
                startMovement(
                  {
                    id: (row as unknown as { id: number }).id,
                    sku: (row as unknown as { sku: string }).sku,
                    name: (row as unknown as { name: string }).name,
                    stock: (row as unknown as StockProduct).stock,
                  },
                  'in',
                )
              "
            >
              Registrar entrada
            </UiButton>
          </template>
        </UiTable>
      </article>
    </template>

    <UiDialog
      v-model:open="pickerOpen"
      title="Elige el producto"
      description="Busca por nombre, SKU o código de barras."
    >
      <UiField v-slot="f" label="Producto">
        <UiInput
          :id="f.id"
          v-model="pickerSearch"
          type="search"
          name="picker"
          autocomplete="off"
          :aria-describedby="f.describedBy"
        />
      </UiField>
      <ul class="picker" aria-label="Resultados">
        <li v-for="p in pickerProducts.data.value?.results ?? []" :key="p.id">
          <button
            type="button"
            @click="startMovement({ id: p.id, sku: p.sku, name: p.name, stock: p.stock })"
          >
            <span class="sku">{{ p.sku }}</span> {{ p.name }}
            <span class="num">· stock {{ p.stock }}</span>
          </button>
        </li>
      </ul>
    </UiDialog>

    <MovementDialog v-model:open="formOpen" :product="selected" :initial-type="initialType" />
  </section>
</template>

<style scoped>
.stock {
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
.head-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}
h1 {
  font-size: var(--text-4xl);
}
.sub {
  color: var(--ink-3);
}
.tabs {
  display: flex;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  padding: 2px;
}
.tabs button {
  all: unset;
  cursor: pointer;
  padding: var(--space-2) var(--space-4);
  font-weight: 600;
  border-radius: 4px;
  color: var(--ink-2);
}
.tabs button[aria-selected='true'] {
  background: var(--blue);
  color: var(--on-blue);
}
.tabs button:focus-visible {
  box-shadow: var(--focus-ring);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: start;
}
.filters > * {
  min-width: 160px;
}
.field {
  display: grid;
  gap: var(--space-1);
  font-weight: 600;
}
.field select,
.field input {
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
}
.sku {
  font-stretch: var(--stretch-narrow);
  font-weight: 700;
  color: var(--ink-2);
  white-space: nowrap;
}
.num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}
.pos {
  color: var(--copy-green-ink);
}
.neg,
.low {
  color: var(--red);
}
.empty {
  color: var(--ink-3);
  margin-bottom: var(--space-3);
}
.picker {
  list-style: none;
  padding: 0;
  margin: var(--space-4) 0 0;
  display: grid;
  gap: var(--space-2);
  max-height: 320px;
  overflow-y: auto;
}
.picker button {
  all: unset;
  cursor: pointer;
  display: block;
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--radius-md);
}
.picker button:hover,
.picker button:focus-visible {
  background: var(--blue-soft);
  box-shadow: var(--focus-ring);
}
@media (max-width: 640px) {
  .stock {
    padding: var(--space-4);
  }
}
</style>
