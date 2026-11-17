<script setup lang="ts">
/** Dashboard del administrador: periodos, indicadores, ventas por día, medios de pago y exportaciones. */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'

import UiButton from '@/components/UiButton.vue'
import { toast } from '@/composables/useToast'
import { formatDate, formatMoney, formatNumber } from '@/utils/format'

import {
  downloadFile,
  exportSalesPath,
  fetchDashboard,
  periodRange,
  type DateRange,
  type Period,
} from '../api'

const period = ref<Period>('30')
const custom = ref(false)
const from = ref('')
const to = ref('')

const range = computed<DateRange>(() => {
  if (custom.value && from.value && to.value) return { date_from: from.value, date_to: to.value }
  return periodRange(period.value)
})
const rangeInvalid = computed(
  () => custom.value && !!from.value && !!to.value && from.value > to.value,
)

const dashboard = useQuery({
  queryKey: computed(() => ['dashboard', range.value.date_from, range.value.date_to]),
  queryFn: () => fetchDashboard(range.value),
  enabled: computed(() => !rangeInvalid.value),
  placeholderData: (previous) => previous,
})

const data = computed(() => dashboard.data.value)
const maxDay = computed(() =>
  Math.max(1, ...(data.value?.sales_by_day ?? []).map((d) => Number(d.revenue))),
)
const paymentTotal = computed(() =>
  (data.value?.sales_by_payment_method ?? []).reduce((sum, p) => sum + Number(p.revenue), 0),
)

function pick(value: Period) {
  custom.value = false
  period.value = value
}

const exporting = ref(false)
async function exportSales() {
  exporting.value = true
  try {
    await downloadFile(
      exportSalesPath(range.value),
      `ventas_${range.value.date_from}_${range.value.date_to}.xlsx`,
    )
  } catch {
    toast.error('No pudimos generar el Excel de ventas.')
  } finally {
    exporting.value = false
  }
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
]
</script>

<template>
  <section class="dash">
    <header class="head">
      <div>
        <h1>Dashboard</h1>
        <p class="sub">{{ formatDate(range.date_from) }} – {{ formatDate(range.date_to) }}</p>
      </div>
      <div class="controls">
        <div class="seg" role="group" aria-label="Periodo">
          <button
            v-for="p in PERIODS"
            :key="p.value"
            type="button"
            :aria-pressed="!custom && period === p.value"
            @click="pick(p.value)"
          >
            {{ p.label }}
          </button>
        </div>
        <label class="field"
          ><span>Desde</span
          ><input v-model="from" type="date" name="date-from" @focus="custom = true"
        /></label>
        <label class="field"
          ><span>Hasta</span><input v-model="to" type="date" name="date-to" @focus="custom = true"
        /></label>
        <UiButton :loading="exporting" variant="secondary" @click="exportSales"
          >Exportar ventas (Excel)</UiButton
        >
      </div>
    </header>

    <p v-if="rangeInvalid" class="form-error" role="alert">
      La fecha de inicio no puede ser posterior a la de fin.
    </p>
    <p v-else-if="dashboard.isError.value" class="form-error" role="alert">
      No se pudo cargar el dashboard.
      <UiButton size="sm" variant="ghost" @click="dashboard.refetch()">Reintentar</UiButton>
    </p>

    <template v-if="data">
      <section class="talones" aria-label="Indicadores">
        <article class="talon">
          <p class="stub"><span class="serial">01</span> Ingresos</p>
          <p class="figure">{{ formatMoney(data.summary.revenue) }}</p>
          <p class="note">
            {{ data.summary.sales_count }} ventas · IGV {{ formatMoney(data.summary.tax) }}
          </p>
        </article>
        <article class="talon">
          <p class="stub"><span class="serial">02</span> Margen bruto</p>
          <p class="figure">{{ formatMoney(data.summary.gross_profit) }}</p>
          <p class="note">Ingresos menos costo</p>
        </article>
        <article class="talon">
          <p class="stub"><span class="serial">03</span> Ticket promedio</p>
          <p class="figure">{{ formatMoney(data.summary.average_ticket) }}</p>
          <p class="note">{{ formatNumber(data.summary.units_sold) }} unidades</p>
        </article>
        <article class="talon" :class="{ alert: data.inventory.low_stock_count > 0 }">
          <p class="stub"><span class="serial">04</span> Stock bajo</p>
          <p class="figure">{{ data.inventory.low_stock_count }}</p>
          <p class="note"><RouterLink to="/inventario">Revisar en Inventario</RouterLink></p>
        </article>
      </section>

      <section class="grid">
        <article class="sheet">
          <h2>Ventas por día</h2>
          <div
            class="bars"
            role="img"
            :aria-label="`Ventas por día: ${data.sales_by_day.length} días con ventas`"
          >
            <div
              v-for="d in data.sales_by_day"
              :key="d.day"
              class="bar-col"
              :title="`${formatDate(d.day)}: ${formatMoney(d.revenue)}`"
            >
              <span
                class="bar"
                :style="{ height: `${(Number(d.revenue) / maxDay) * 100}%` }"
              ></span>
              <span class="day">{{ d.day.slice(8) }}</span>
            </div>
          </div>
          <p v-if="!data.sales_by_day.length" class="sub">No hay ventas entre estas fechas.</p>
        </article>

        <article class="sheet">
          <h2>Por medio de pago</h2>
          <ul class="methods">
            <li v-for="p in data.sales_by_payment_method" :key="p.payment_method">
              <span>{{ p.payment_method_display }}</span>
              <span class="track"
                ><span
                  class="fill"
                  :style="{ width: `${(Number(p.revenue) / (paymentTotal || 1)) * 100}%` }"
                ></span
              ></span>
              <strong class="num">{{ formatMoney(p.revenue) }}</strong>
            </li>
          </ul>
        </article>

        <article class="sheet wide">
          <h2>Lo más vendido</h2>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th class="r">Unid.</th>
                <th class="r">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in data.top_products" :key="p.product_id">
                <td>
                  <span class="sku">{{ p.product_sku }}</span>
                </td>
                <td>{{ p.product_name }}</td>
                <td class="r num">{{ p.units_sold }}</td>
                <td class="r num">{{ formatMoney(p.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>
    </template>
  </section>
</template>

<style scoped>
.dash {
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
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: end;
}
h1 {
  font-size: var(--text-4xl);
}
h2 {
  font-size: var(--text-xl);
  margin-bottom: var(--space-3);
}
.sub {
  color: var(--ink-3);
}
.seg {
  display: flex;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  padding: 2px;
}
.seg button {
  all: unset;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
  border-radius: 4px;
  color: var(--ink-2);
}
.seg button[aria-pressed='true'] {
  background: var(--blue);
  color: var(--on-blue);
}
.seg button:focus-visible {
  box-shadow: var(--focus-ring);
}
.field {
  display: grid;
  gap: var(--space-1);
  font-weight: 600;
  font-size: var(--text-sm);
}
.field input {
  font: inherit;
  padding: var(--space-2) var(--space-3);
  background: var(--sheet);
  color: var(--ink);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
}
.talones {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}
.talon {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-4) var(--space-5);
}
.talon.alert {
  background: var(--copy-yellow);
}
.stub {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  font-weight: 600;
  color: var(--ink-2);
}
.serial {
  font-stretch: var(--stretch-narrow);
  font-weight: 800;
  color: var(--red);
}
.figure {
  font-stretch: var(--stretch-narrow);
  font-weight: 800;
  font-size: var(--text-3xl);
  color: var(--blue);
  font-variant-numeric: tabular-nums;
}
.talon.alert .figure {
  color: var(--red);
}
.note {
  color: var(--ink-3);
  font-size: var(--text-sm);
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: var(--space-4);
}
.sheet {
  background: var(--sheet);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sheet);
  padding: var(--space-5);
  min-width: 0;
  overflow-x: auto;
}
.wide {
  grid-column: 1 / -1;
}
.bars {
  display: flex;
  gap: var(--space-2);
  align-items: stretch;
  height: 200px;
}
.bar-col {
  flex: 1;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: var(--space-1);
  min-width: 0;
}
.bar {
  align-self: end;
  background: var(--series-1);
  border-radius: 2px 2px 0 0;
  min-height: 2px;
}
.day {
  text-align: center;
  font-size: var(--text-xs);
  color: var(--ink-3);
  border-top: 2px solid var(--ink);
  padding-top: var(--space-1);
  white-space: nowrap;
}
.methods {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}
.methods li {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  gap: var(--space-3);
  align-items: center;
}
.track {
  height: 10px;
  background: var(--rule);
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  background: var(--blue);
}
.num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}
.r {
  text-align: right;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  text-align: left;
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--ink-3);
  border-bottom: 2px solid var(--ink);
  padding: 0 var(--space-2) var(--space-2);
}
td {
  padding: var(--space-2);
  border-bottom: 1px dashed var(--rule);
}
.sku {
  font-stretch: var(--stretch-narrow);
  font-weight: 700;
  color: var(--ink-2);
  white-space: nowrap;
}
.form-error {
  color: var(--copy-pink-ink);
  background: var(--copy-pink);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
}
@media (max-width: 1100px) {
  .talones {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .dash {
    padding: var(--space-4);
  }
  .talones {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
