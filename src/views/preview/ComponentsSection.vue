<script setup lang="ts">
// Sección de /muestra (solo desarrollo): componentes base en sus estados.
import { computed, ref } from 'vue'

import UiButton from '@/components/UiButton.vue'
import UiDialog from '@/components/UiDialog.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiPagination from '@/components/UiPagination.vue'
import UiSelect from '@/components/UiSelect.vue'
import UiTable, { type TableColumn, type TableSort } from '@/components/UiTable.vue'
import UiToastHost from '@/components/UiToastHost.vue'
import { toast } from '@/composables/useToast'
import { formatMoney } from '@/utils/format'

const sku = ref('PIN-001')
const price = ref('12.50')
const cost = ref('32.00')
const method = ref('cash')
const methods = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
]
const priceError = computed(() =>
  Number(price.value) < Number(cost.value) ? 'El precio de venta no puede ser menor al costo.' : '',
)

const columns: TableColumn[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Producto', sortable: true },
  { key: 'sale_price', label: 'Precio', align: 'right', sortable: true },
  { key: 'stock', label: 'Stock', align: 'right', sortable: true },
]
const products = [
  { id: 1, sku: 'PIN-001', name: 'Pintura látex blanco 1 gal', sale_price: 49.9, stock: 41 },
  { id: 2, sku: 'ELE-003', name: 'Interruptor simple empotrable', sale_price: 9.5, stock: 9 },
  {
    id: 3,
    sku: 'HER-001',
    name: 'Martillo de uña 16 oz mango de fibra',
    sale_price: 29.9,
    stock: 33,
  },
  {
    id: 4,
    sku: 'TOR-004',
    name: 'Tuerca hexagonal 3/8 in galvanizada',
    sale_price: 0.3,
    stock: 14,
  },
]
const sort = ref<TableSort | null>({ key: 'stock', direction: 'asc' })
const sorted = computed(() => {
  const s = sort.value
  if (!s) return products
  const factor = s.direction === 'asc' ? 1 : -1
  return [...products].sort((a, b) => {
    const x = a[s.key as keyof typeof a]
    const y = b[s.key as keyof typeof b]
    return (x > y ? 1 : x < y ? -1 : 0) * factor
  })
})
const tableState = ref<'data' | 'loading' | 'empty' | 'error'>('data')
const page = ref(1)
const dialogOpen = ref(false)
</script>

<template>
  <section class="components" aria-labelledby="components-title">
    <h2 id="components-title">Componentes base</h2>

    <div class="row">
      <article class="sheet">
        <h3>Botones</h3>
        <div class="buttons">
          <UiButton variant="primary">Cobrar S/ 59.00</UiButton>
          <UiButton>Exportar Excel</UiButton>
          <UiButton variant="ghost">Cancelar</UiButton>
          <UiButton variant="danger">Anular venta</UiButton>
          <UiButton variant="primary" loading>Guardando</UiButton>
          <UiButton disabled>Sin stock</UiButton>
        </div>
      </article>

      <article class="sheet form">
        <h3>Formulario</h3>
        <UiField v-slot="f" label="SKU" hint="Código interno, por ejemplo PIN-001." required>
          <UiInput :id="f.id" v-model="sku" :aria-describedby="f.describedBy" />
        </UiField>
        <UiField v-slot="f" label="Precio de venta" :error="priceError" required>
          <UiInput
            :id="f.id"
            v-model="price"
            prefix="S/"
            inputmode="decimal"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <UiField v-slot="f" label="Método de pago">
          <UiSelect :id="f.id" v-model="method" :options="methods" />
        </UiField>
      </article>
    </div>

    <article class="sheet">
      <div class="table-head">
        <h3>Tabla</h3>
        <div class="buttons">
          <UiButton
            v-for="s in ['data', 'loading', 'empty', 'error'] as const"
            :key="s"
            size="sm"
            :variant="tableState === s ? 'primary' : 'secondary'"
            @click="tableState = s"
          >
            {{ { data: 'Datos', loading: 'Cargando', empty: 'Vacía', error: 'Error' }[s] }}
          </UiButton>
        </div>
      </div>
      <UiTable
        v-model:sort="sort"
        caption="Productos"
        :columns="columns"
        :rows="tableState === 'data' ? sorted : []"
        :loading="tableState === 'loading'"
        :error="tableState === 'error' ? 'No se pudieron cargar los productos.' : undefined"
        empty-text="No hay productos que coincidan con la búsqueda."
        @retry="tableState = 'data'"
      >
        <template #cell-sku="{ value }"
          ><span class="sku">{{ value }}</span></template
        >
        <template #cell-sale_price="{ value }">{{ formatMoney(value as number) }}</template>
        <template #cell-stock="{ row }">
          <span :class="{ low: (row.stock as number) < 15 }">{{ row.stock }}</span>
        </template>
      </UiTable>
      <UiPagination v-model:page="page" :count="80" />
    </article>

    <article class="sheet">
      <h3>Diálogo y avisos</h3>
      <div class="buttons">
        <UiButton variant="danger" @click="dialogOpen = true">Anular V-000080</UiButton>
        <UiButton @click="toast.success('Venta V-000081 registrada.')">Aviso de éxito</UiButton>
        <UiButton @click="toast.info('Exportando inventario…')">Aviso informativo</UiButton>
        <UiButton @click="toast.error('No se pudo conectar con el servidor. Revisa tu conexión.')"
          >Aviso de error</UiButton
        >
      </div>
    </article>

    <UiDialog
      v-model:open="dialogOpen"
      title="Anular venta V-000080"
      description="Se devolverá el stock de cada producto. Esta acción no se puede deshacer."
    >
      <UiField v-slot="f" label="Motivo" required>
        <UiInput :id="f.id" placeholder="Ej.: el cliente devolvió la mercadería" />
      </UiField>
      <template #footer>
        <UiButton variant="ghost" @click="dialogOpen = false">Volver</UiButton>
        <UiButton variant="danger" @click="dialogOpen = false">Anular venta</UiButton>
      </template>
    </UiDialog>
    <UiToastHost />
  </section>
</template>

<style scoped>
.components {
  display: grid;
  gap: var(--space-4);
}
.components > h2 {
  font-size: var(--text-3xl);
  margin-top: var(--space-8);
}
.row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.sheet {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-5);
}
h3 {
  font-size: var(--text-xl);
  margin-bottom: var(--space-4);
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.form {
  display: grid;
  gap: var(--space-4);
}
.form h3 {
  margin-bottom: 0;
}
.table-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.sku {
  font-stretch: var(--stretch-narrow);
  font-weight: 700;
  color: var(--ink-2);
}
.low {
  color: var(--red);
  font-weight: 700;
}
@media (max-width: 900px) {
  .row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
