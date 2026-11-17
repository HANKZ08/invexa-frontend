<script setup lang="ts">
/** Deudores: clientes con saldo pendiente, sus ventas pendientes y los abonos. */
import { Eye } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { api, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import UiButton from '@/components/UiButton.vue'
import UiPagination from '@/components/UiPagination.vue'
import UiField from '@/components/UiField.vue'
import UiInput from '@/components/UiInput.vue'
import UiSelect from '@/components/UiSelect.vue'
import UiTable, { type TableColumn } from '@/components/UiTable.vue'
import { PAYMENT_METHODS, isCash, type PaymentMethod } from '@/features/pos/payments'
import { fetchSales, type SaleListItem } from '@/features/sales/api'
import { usePagedList } from '@/composables/usePagedList'
import { toast } from '@/composables/useToast'
import { formatDateTime, formatMoney } from '@/utils/format'

interface Debtor {
  id: number
  name: string
  document_id: string
  debt: string
  pending_sales: number
}

const queryClient = useQueryClient()
const selected = ref<Debtor | null>(null)
const selectedSale = ref<SaleListItem | null>(null)

const debtors = useQuery({
  queryKey: ['debtors'],
  queryFn: () =>
    unwrap(
      api.GET('/api/customers/', {
        params: { query: { has_debt: true, page_size: 100 } as never },
      }),
    ) as Promise<{
      results: Debtor[]
    }>,
})

const pendingSales = useQuery({
  queryKey: computed(() => ['debtor-sales', selected.value?.id]),
  queryFn: () => fetchSales({ status: 'pending', search: selected.value?.document_id }),
  enabled: computed(() => selected.value !== null),
})

const columns: TableColumn[] = [
  { key: 'name', label: 'Cliente' },
  { key: 'document_id', label: 'Documento' },
  { key: 'pending_sales', label: 'Ventas', align: 'right' },
  { key: 'debt', label: 'Debe', align: 'right' },
  { key: 'actions', label: '' },
]
// Filtros de la lista: búsqueda por nombre o documento, orden y deuda mínima.
const search = ref('')
const sortBy = ref<'debt' | 'name' | 'sales'>('debt')
const minDebt = ref('')
const SORT_OPTIONS = [
  { value: 'debt', label: 'Mayor deuda' },
  { value: 'sales', label: 'Más ventas pendientes' },
  { value: 'name', label: 'Nombre (A–Z)' },
]

const allDebtors = computed(() => debtors.data.value?.results ?? [])
const filteredDebtors = computed(() => {
  const term = search.value.trim().toLowerCase()
  const floor = Number(minDebt.value) || 0
  const list = allDebtors.value.filter(
    (d) =>
      (!term || d.name.toLowerCase().includes(term) || d.document_id.includes(term)) &&
      Number(d.debt) >= floor,
  )
  return [...list].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, 'es')
    if (sortBy.value === 'sales') return b.pending_sales - a.pending_sales
    return Number(b.debt) - Number(a.debt)
  })
})
const { page, pageSize, count, pageItems } = usePagedList(filteredDebtors)
watch([search, sortBy, minDebt], () => (page.value = 1))

const rows = computed(() => pageItems.value as unknown as Record<string, unknown>[])
const salesRows = computed(
  () => (pendingSales.data.value?.results ?? []) as unknown as Record<string, unknown>[],
)
const asDebtor = (row: Record<string, unknown>) => row as unknown as Debtor
const asSale = (row: Record<string, unknown>) => row as unknown as SaleListItem

// --- Abono -------------------------------------------------------------------
const abonoMethod = ref<PaymentMethod>('cash')
const abonoAmount = ref('')
const abonoRef = ref('')
const abonoError = ref('')
const abonoOptions = PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))

function openAbono(sale: SaleListItem) {
  selectedSale.value = sale
  abonoMethod.value = 'cash'
  abonoAmount.value = ''
  abonoRef.value = ''
  abonoError.value = ''
}

const payAbono = useMutation({
  mutationFn: () =>
    unwrap(
      api.POST('/api/sales/{id}/pay-debt/', {
        params: { path: { id: selectedSale.value!.id } },
        body: {
          payments: [
            {
              method: abonoMethod.value,
              amount: String(Number(abonoAmount.value)),
              reference: abonoRef.value.trim(),
            },
          ],
        } as never,
      }),
    ),
  onSuccess: (raw) => {
    const sale = raw as unknown as SaleListItem
    toast.success(
      sale.status === 'completed'
        ? `Venta ${sale.number} pagada por completo.`
        : `Abono registrado. Saldo de ${sale.number}: ${formatMoney(sale.balance)}.`,
    )
    selectedSale.value = null
    queryClient.invalidateQueries({ queryKey: ['debtors'] })
    queryClient.invalidateQueries({ queryKey: ['debtor-sales'] })
    queryClient.invalidateQueries({ queryKey: ['sales'] })
  },
  onError: (error) => {
    abonoError.value = error instanceof ApiError ? error.message : 'No pudimos registrar el abono.'
  },
})

function submitAbono() {
  abonoError.value = ''
  const amount = Number(abonoAmount.value)
  if (!abonoAmount.value || Number.isNaN(amount) || amount <= 0) {
    abonoError.value = 'Escribe un monto mayor a cero.'
    return
  }
  if (!isCash(abonoMethod.value) && !abonoRef.value.trim()) {
    abonoError.value = 'Escribe el número de operación del abono digital.'
    return
  }
  payAbono.mutate()
}
</script>

<template>
  <section class="page">
    <header class="head">
      <div>
        <h1>Deudores</h1>
        <p class="sub">Clientes que deben dinero por ventas pendientes.</p>
      </div>
    </header>

    <div class="layout" :class="{ 'layout--detail': selected }">
      <article class="sheet">
        <div class="filters">
          <UiField v-slot="f" label="Buscar" hint="Nombre o documento">
            <UiInput
              :id="f.id"
              v-model="search"
              type="search"
              name="search"
              autocomplete="off"
              :aria-describedby="f.describedBy"
            />
          </UiField>
          <UiField v-slot="f" label="Ordenar por">
            <UiSelect :id="f.id" v-model="sortBy" :options="SORT_OPTIONS" />
          </UiField>
          <UiField v-slot="f" label="Deuda mínima (S/)">
            <UiInput
              :id="f.id"
              v-model="minDebt"
              type="number"
              inputmode="decimal"
              min="0"
              name="min-debt"
              :aria-describedby="f.describedBy"
            />
          </UiField>
        </div>
        <UiTable
          caption="Clientes con deuda"
          :columns="columns"
          :rows="rows"
          :loading="debtors.isPending.value"
          :error="debtors.isError.value ? 'No se pudieron cargar los deudores.' : undefined"
          empty-text="Ningún cliente debe dinero."
          @retry="debtors.refetch()"
        >
          <template #cell-debt="{ row }"
            ><span class="num strong">{{ formatMoney(asDebtor(row).debt) }}</span></template
          >
          <template #cell-actions="{ row }">
            <UiButton size="sm" variant="secondary" @click="selected = asDebtor(row)"
              ><Eye :size="14" aria-hidden="true" /> Ver ventas</UiButton
            >
          </template>
        </UiTable>
        <UiPagination v-model:page="page" v-model:page-size="pageSize" :count="count" />
      </article>

      <aside v-if="selected" class="sheet detail" aria-label="Ventas pendientes">
        <header class="detail-head">
          <h2>{{ selected.name }}</h2>
          <button type="button" class="close" aria-label="Cerrar" @click="selected = null">
            ×
          </button>
        </header>
        <p class="sub">{{ selected.document_id }} · debe {{ formatMoney(selected.debt) }}</p>

        <p v-if="pendingSales.isPending.value">Cargando ventas…</p>
        <p v-else-if="!salesRows.length" class="sub">No tiene ventas pendientes.</p>
        <ul v-else class="sales">
          <li v-for="row in salesRows" :key="asSale(row).id">
            <div>
              <span class="serial">{{ asSale(row).number }}</span>
              <span class="sub">{{ formatDateTime(asSale(row).created_at) }}</span>
            </div>
            <div class="money">
              <span
                >Saldo <strong class="num">{{ formatMoney(asSale(row).balance) }}</strong> de
                {{ formatMoney(asSale(row).total) }}</span
              >
              <UiButton size="sm" variant="primary" @click="openAbono(asSale(row))"
                >Registrar abono</UiButton
              >
            </div>
          </li>
        </ul>

        <form v-if="selectedSale" novalidate data-abono class="abono" @submit.prevent="submitAbono">
          <h3>Abono a {{ selectedSale.number }}</h3>
          <UiField v-slot="f" label="Medio">
            <UiSelect
              :id="f.id"
              v-model="abonoMethod"
              name="abono-method"
              :options="abonoOptions"
            />
          </UiField>
          <UiField v-slot="f" label="Monto (S/)">
            <UiInput
              :id="f.id"
              v-model="abonoAmount"
              name="abono-amount"
              inputmode="decimal"
              :aria-describedby="f.describedBy"
            />
          </UiField>
          <UiField v-if="!isCash(abonoMethod)" v-slot="f" label="Número de operación">
            <UiInput
              :id="f.id"
              v-model="abonoRef"
              name="abono-ref"
              :aria-describedby="f.describedBy"
            />
          </UiField>
          <p v-if="abonoError" class="form-error" role="alert">{{ abonoError }}</p>
          <div class="actions">
            <UiButton variant="ghost" @click="selectedSale = null">Cancelar</UiButton>
            <UiButton type="submit" variant="primary" :loading="payAbono.isPending.value"
              >Registrar abono</UiButton
            >
          </div>
        </form>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: start;
  margin-bottom: var(--space-4);
}
.filters > * {
  min-width: 180px;
  flex: 1 1 180px;
}

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
h2 {
  font-size: var(--text-xl);
}
h3 {
  font-size: var(--text-lg);
  margin-bottom: var(--space-2);
}
.sub {
  color: var(--ink-3);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}
.layout--detail {
  grid-template-columns: minmax(0, 1fr) minmax(300px, 400px);
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
  gap: var(--space-2);
}
.close {
  all: unset;
  cursor: pointer;
  font-size: var(--text-2xl);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
}
.close:focus-visible {
  box-shadow: var(--focus-ring);
}
.num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}
.strong {
  color: var(--red);
}
.serial {
  font-stretch: var(--stretch-narrow);
  font-weight: 800;
  color: var(--red);
  margin-right: var(--space-2);
}
.sales {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}
.sales li {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed var(--rule);
  border-radius: var(--radius-md);
}
.money {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.abono {
  display: grid;
  gap: var(--space-3);
  border-top: 2px solid var(--ink);
  padding-top: var(--space-4);
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
  .page {
    padding: var(--space-4);
  }
}
</style>
