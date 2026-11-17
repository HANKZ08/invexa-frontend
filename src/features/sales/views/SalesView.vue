<script setup lang="ts">
/** Historial de ventas: filtros, detalle, factura y anulación (solo administrador). */
import { FileText } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
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
import { openInvoice } from '@/features/pos/api'
import { useSessionStore } from '@/stores/session'
import { formatDateTime, formatMoney } from '@/utils/format'

import { cancelSale, fetchSale, fetchSales, type SaleListItem } from '../api'

const session = useSessionStore()
const queryClient = useQueryClient()
const isAdmin = computed(() => session.role === 'admin')

const search = ref('')
const debounced = ref('')
const status = ref('')
const method = ref('')
const dateFrom = ref('')
const dateTo = ref('')
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
watch([status, method, dateFrom, dateTo], () => (page.value = 1))

const sales = useQuery({
  queryKey: computed(() => [
    'sales',
    {
      debounced: debounced.value,
      status: status.value,
      method: method.value,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      page: page.value,
      pageSize: pageSize.value,
    },
  ]),
  queryFn: () =>
    fetchSales({
      search: debounced.value || undefined,
      status: status.value || undefined,
      payment_method: method.value || undefined,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      page: page.value,
      page_size: pageSize.value,
    }),
  placeholderData: (previous) => previous,
})

const hasFilters = computed(
  () => !!(debounced.value || status.value || method.value || dateFrom.value || dateTo.value),
)
function clearFilters() {
  search.value = ''
  debounced.value = ''
  status.value = ''
  method.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}

const columns: TableColumn[] = [
  { key: 'number', label: 'N.°' },
  { key: 'created_at', label: 'Fecha' },
  { key: 'customer_name', label: 'Cliente' },
  { key: 'payment_method_display', label: 'Pago' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status_display', label: 'Estado' },
  { key: 'actions', label: '' },
]

const rows = computed(
  () => (sales.data.value?.results ?? []) as unknown as Record<string, unknown>[],
)
const asSale = (row: Record<string, unknown>) => row as unknown as SaleListItem

// --- Detalle -----------------------------------------------------------------
const selectedId = ref<number | null>(null)
const detail = useQuery({
  queryKey: computed(() => ['sale', selectedId.value]),
  queryFn: () => fetchSale(selectedId.value!),
  enabled: computed(() => selectedId.value !== null),
})

// --- Anular ------------------------------------------------------------------
const cancelTarget = ref<SaleListItem | null>(null)
const reason = ref('')
const reasonError = ref('')
const formError = ref('')

function openCancel(sale: SaleListItem) {
  cancelTarget.value = sale
  reason.value = ''
  reasonError.value = ''
  formError.value = ''
}

const cancel = useMutation({
  mutationFn: () => cancelSale(cancelTarget.value!.id, reason.value.trim()),
  onSuccess: (sale) => {
    toast.success(`Venta ${sale.number} anulada. Se devolvió el stock.`)
    cancelTarget.value = null
    queryClient.invalidateQueries({ queryKey: ['sales'] })
    queryClient.invalidateQueries({ queryKey: ['sale'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
  },
  onError: (error) => {
    formError.value = error instanceof ApiError ? error.message : 'No pudimos anular la venta.'
  },
})

function submitCancel() {
  reasonError.value = reason.value.trim() ? '' : 'Escribe el motivo de la anulación.'
  formError.value = ''
  if (reasonError.value) return
  cancel.mutate()
}

async function verFactura(id: number) {
  try {
    await openInvoice(id)
  } catch {
    toast.error('No pudimos abrir la factura.')
  }
}
</script>

<template>
  <section class="sales">
    <header class="head">
      <div>
        <h1>Ventas</h1>
        <p class="sub">{{ isAdmin ? 'Todas las ventas de la tienda.' : 'Tus ventas.' }}</p>
      </div>
    </header>

    <div class="filters">
      <UiSearch v-model="search" label="Buscar" placeholder="Número, cliente o documento" />
      <label class="field"
        ><span>Estado</span>
        <select v-model="status" name="status">
          <option value="">Todas</option>
          <option value="completed">Completadas</option>
          <option value="pending">Pendientes (deuda)</option>
          <option value="cancelled">Anuladas</option>
        </select>
      </label>
      <label class="field"
        ><span>Pago</span>
        <select v-model="method" name="payment-method">
          <option value="">Todos</option>
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
          <option value="transfer">Transferencia</option>
        </select>
      </label>
      <label class="field"
        ><span>Desde</span><input v-model="dateFrom" type="date" name="date-from"
      /></label>
      <label class="field"
        ><span>Hasta</span><input v-model="dateTo" type="date" name="date-to"
      /></label>
      <UiButton v-if="hasFilters" variant="ghost" size="sm" @click="clearFilters"
        >Limpiar filtros</UiButton
      >
    </div>

    <div class="layout" :class="{ 'layout--detail': selectedId }">
      <article class="sheet">
        <UiTable
          caption="Ventas"
          :columns="columns"
          :rows="rows"
          :loading="sales.isPending.value"
          :error="sales.isError.value ? 'No se pudieron cargar las ventas.' : undefined"
          empty-text="Aún no hay ventas."
          @retry="sales.refetch()"
        >
          <template #empty>
            <p class="empty">
              {{ hasFilters ? 'No hay ventas con estos filtros.' : 'Aún no hay ventas.' }}
            </p>
            <UiButton v-if="hasFilters" size="sm" variant="ghost" @click="clearFilters"
              >Limpiar filtros</UiButton
            >
          </template>
          <template #cell-number="{ row }">
            <button
              type="button"
              class="link serial"
              :aria-pressed="selectedId === asSale(row).id"
              @click="selectedId = asSale(row).id"
            >
              {{ asSale(row).number }}
            </button>
          </template>
          <template #cell-created_at="{ row }">{{
            formatDateTime(asSale(row).created_at)
          }}</template>
          <template #cell-customer_name="{ row }">{{
            asSale(row).customer_name ?? 'Consumidor final'
          }}</template>
          <template #cell-total="{ row }"
            ><span class="num">{{ formatMoney(asSale(row).total) }}</span></template
          >
          <template #cell-status_display="{ row }">
            <span
              class="tag"
              :class="{
                pink: asSale(row).status === 'cancelled',
                amber: asSale(row).status === 'pending',
                green: asSale(row).status === 'completed',
              }"
              >{{ asSale(row).status_display }}</span
            >
          </template>
          <template #cell-actions="{ row }">
            <div class="row-actions">
              <UiButton size="sm" variant="ghost" @click="verFactura(asSale(row).id)"
                ><FileText :size="14" aria-hidden="true" /> Factura</UiButton
              >
              <UiButton
                v-if="isAdmin"
                size="sm"
                variant="danger"
                :disabled="asSale(row).status === 'cancelled'"
                @click="openCancel(asSale(row))"
              >
                Anular
              </UiButton>
            </div>
          </template>
        </UiTable>
        <UiPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :count="sales.data.value?.count ?? 0"
        />
      </article>

      <aside v-if="selectedId" class="sheet detail" aria-label="Detalle de la venta">
        <p v-if="detail.isPending.value">Cargando…</p>
        <template v-else-if="detail.data.value">
          <header class="detail-head">
            <p class="serial">{{ detail.data.value.number }}</p>
            <button
              type="button"
              class="close"
              aria-label="Cerrar detalle"
              @click="selectedId = null"
            >
              ×
            </button>
          </header>
          <p>
            {{ formatDateTime(detail.data.value.created_at) }} ·
            {{ detail.data.value.cashier_name }}
          </p>
          <p>Cliente: {{ detail.data.value.customer_name ?? 'Consumidor final' }}</p>
          <table>
            <tbody>
              <tr v-for="item in detail.data.value.items" :key="item.id">
                <td>
                  <span class="sku">{{ item.product_sku }}</span> {{ item.product_name }}
                </td>
                <td class="r num">{{ item.quantity }} × {{ formatMoney(item.unit_price) }}</td>
              </tr>
            </tbody>
          </table>
          <dl class="totals">
            <div>
              <dt>Subtotal</dt>
              <dd class="num">{{ formatMoney(detail.data.value.subtotal) }}</dd>
            </div>
            <div>
              <dt>Descuento</dt>
              <dd class="num">{{ formatMoney(detail.data.value.discount) }}</dd>
            </div>
            <div>
              <dt>IGV</dt>
              <dd class="num">{{ formatMoney(detail.data.value.tax) }}</dd>
            </div>
            <div class="grand">
              <dt>Total</dt>
              <dd class="num">{{ formatMoney(detail.data.value.total) }}</dd>
            </div>
            <div v-for="p in detail.data.value.payments" :key="p.id">
              <dt>
                {{ p.method_display
                }}<span v-if="p.reference" class="ref"> · {{ p.reference }}</span>
              </dt>
              <dd class="num">{{ formatMoney(p.amount) }}</dd>
            </div>
            <div>
              <dt>Recibido</dt>
              <dd class="num">{{ formatMoney(detail.data.value.amount_paid) }}</dd>
            </div>
            <div>
              <dt>Cambio</dt>
              <dd class="num">{{ formatMoney(detail.data.value.change) }}</dd>
            </div>
          </dl>
          <p v-if="detail.data.value.status === 'pending'" class="pending-note">
            Pendiente. Saldo por cobrar:
            <strong class="num">{{ formatMoney(detail.data.value.balance) }}</strong>
          </p>
          <ul v-if="detail.data.value.debt_payments.length" class="abonos" aria-label="Abonos">
            <li v-for="a in detail.data.value.debt_payments" :key="a.id">
              Abono {{ a.method_display }} <strong class="num">{{ formatMoney(a.amount) }}</strong>
              <span v-if="a.reference" class="ref"> · {{ a.reference }}</span>
            </li>
          </ul>
          <p v-if="detail.data.value.status === 'cancelled'" class="cancelled-note">
            Anulada: {{ detail.data.value.cancellation_reason }}
          </p>
          <UiButton variant="secondary" block @click="verFactura(detail.data.value.id)"
            >Ver factura PDF</UiButton
          >
        </template>
      </aside>
    </div>

    <UiDialog
      :open="!!cancelTarget"
      title="Anular venta"
      :description="
        cancelTarget
          ? `${cancelTarget.number} · se devolverá el stock de cada producto. No se puede deshacer.`
          : ''
      "
      @update:open="
        (v: boolean) => {
          if (!v) cancelTarget = null
        }
      "
    >
      <form novalidate data-cancel class="form" @submit.prevent="submitCancel">
        <UiField v-slot="f" label="Motivo" :error="reasonError" required>
          <UiInput
            :id="f.id"
            v-model="reason"
            name="reason"
            :invalid="f.invalid"
            :aria-describedby="f.describedBy"
          />
        </UiField>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="actions">
          <UiButton variant="ghost" @click="cancelTarget = null">Volver</UiButton>
          <UiButton type="submit" variant="danger" :loading="cancel.isPending.value"
            >Anular venta</UiButton
          >
        </div>
      </form>
    </UiDialog>
  </section>
</template>

<style scoped>
.sales {
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
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}
.layout--detail {
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
}
.sheet {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-5);
  min-width: 0;
  overflow-x: auto;
}
.detail {
  display: grid;
  gap: var(--space-3);
  align-content: start;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.serial {
  font-size: var(--text-2xl);
  font-stretch: var(--stretch-narrow);
  font-weight: 800;
  color: var(--red);
}
.close {
  all: unset;
  cursor: pointer;
  font-size: var(--text-2xl);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
}
.link {
  all: unset;
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.link:focus-visible,
.close:focus-visible {
  box-shadow: var(--focus-ring);
}
.link[aria-pressed='true'] {
  text-decoration: underline;
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
.r {
  text-align: right;
}
.tag {
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
}
.tag.green {
  background: var(--copy-green);
  color: var(--copy-green-ink);
}
.tag.amber {
  background: var(--copy-yellow);
  color: var(--copy-yellow-ink);
}
.tag.pink {
  background: var(--copy-pink);
  color: var(--copy-pink-ink);
}
.row-actions {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}
.totals {
  display: grid;
  gap: var(--space-1);
  margin: 0;
}
.totals div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}
.totals dt {
  color: var(--ink-2);
}
.totals dd {
  margin: 0;
}
.totals .grand {
  border-top: 2px solid var(--ink);
  padding-top: var(--space-2);
  font-weight: 800;
  font-size: var(--text-lg);
}
.pending-note {
  color: var(--copy-yellow-ink);
  background: var(--copy-yellow);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-weight: 600;
}
.abonos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-1);
  font-size: var(--text-sm);
}
.ref {
  font-size: var(--text-xs);
  color: var(--ink-3);
}
.cancelled-note {
  color: var(--copy-pink-ink);
  background: var(--copy-pink);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-weight: 600;
}
.empty {
  color: var(--ink-3);
  margin-bottom: var(--space-3);
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
@media (max-width: 1100px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .sales {
    padding: var(--space-4);
  }
}
</style>
