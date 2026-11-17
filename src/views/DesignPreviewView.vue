<script setup lang="ts">
// Muestra del sistema visual "Talonario de factura" con datos de seed_demo.
// Solo en desarrollo (/muestra). Las pantallas reales se construyen en sus tareas.
import { computed, ref } from 'vue'

import { formatMoney } from '@/utils/format'
import ComponentsSection from './preview/ComponentsSection.vue'

type Theme = 'system' | 'light' | 'dark'

const theme = ref<Theme>('system')

function setTheme(value: Theme) {
  theme.value = value
  if (value === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = value
}

const kpis = [
  {
    serial: '01',
    label: 'Ingresos',
    value: formatMoney('6455.90'),
    note: '80 ventas · IGV S/ 984.80',
  },
  {
    serial: '02',
    label: 'Margen bruto',
    value: formatMoney('2212.42'),
    note: '34 % de los ingresos',
  },
  {
    serial: '03',
    label: 'Ticket promedio',
    value: formatMoney('80.70'),
    note: '429 unidades vendidas',
  },
  { serial: '04', label: 'Stock bajo', value: '3', note: 'Inventario S/ 11,402.28', alert: true },
]

const days = [
  ['1', 272.82],
  ['3', 511.18],
  ['4', 119.18],
  ['5', 76.58],
  ['6', 50.74],
  ['7', 445.92],
  ['8', 564.99],
  ['9', 198.12],
  ['11', 36.11],
  ['12', 222.67],
  ['13', 130.15],
  ['14', 209.33],
  ['15', 96.64],
  ['16', 243.67],
] as const
const maxDay = Math.max(...days.map(([, v]) => v))

const sales = [
  { number: 'V-000080', customer: 'Constructora Andina S.A.C.', total: '243.67', state: 'ok' },
  { number: 'V-000079', customer: 'Consumidor final', total: '96.64', state: 'ok' },
  { number: 'V-000078', customer: 'Juan Pérez Mamani', total: '58.20', state: 'cancelled' },
  { number: 'V-000077', customer: 'Taller Mecánico Los Olivos', total: '130.15', state: 'ok' },
  { number: 'V-000076', customer: 'Consumidor final', total: '36.11', state: 'ok' },
]

const top = [
  { sku: 'PIN-001', name: 'Pintura látex blanco 1 gal', units: 28, total: '1397.20' },
  { sku: 'ELE-002', name: 'Cable THW 12 AWG negro (metro)', units: 27, total: '75.60' },
  { sku: 'PIN-003', name: 'Rodillo antigota 9 in', units: 26, total: '455.00' },
  { sku: 'HER-003', name: 'Destornillador estrella PH2 x 6 in', units: 24, total: '180.00' },
]

const lowStock = [
  { sku: 'ELE-003', name: 'Interruptor simple empotrable', stock: 9, min: 15 },
  { sku: 'HER-004', name: 'Alicate universal 8 in', stock: 12, min: 15 },
  { sku: 'TOR-004', name: 'Tuerca hexagonal 3/8 in galvanizada', stock: 14, min: 15 },
]

const period = ref('30')
const totalLabel = computed(() =>
  period.value === '30' ? 'Últimos 30 días' : `Últimos ${period.value} días`,
)
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand-block">
        <span class="brand">Invexa</span>
        <span class="shop">Ferretería El Tornillo</span>
      </div>
      <nav aria-label="Principal">
        <p class="group">Negocio</p>
        <a href="#" aria-current="page">Dashboard</a>
        <a href="#">Usuarios</a>
        <p class="group">Venta</p>
        <a href="#">Caja</a>
        <a href="#">Ventas</a>
        <a href="#">Clientes</a>
        <p class="group">Almacén</p>
        <a href="#">Inventario</a>
        <a href="#">Productos</a>
        <a href="#">Proveedores</a>
      </nav>
      <div class="who">
        <p class="user">Carmen Salazar<span>Administradora</span></p>
        <div class="theme" role="group" aria-label="Tema">
          <button
            v-for="t in ['system', 'light', 'dark'] as const"
            :key="t"
            type="button"
            :aria-pressed="theme === t"
            @click="setTheme(t)"
          >
            {{ t === 'system' ? 'Auto' : t === 'light' ? 'Claro' : 'Oscuro' }}
          </button>
        </div>
      </div>
    </aside>

    <main class="page">
      <div class="head">
        <div>
          <h1>Resumen del negocio</h1>
          <p class="sub">{{ totalLabel }} · 1 al 16 de noviembre de 2026</p>
        </div>
        <div class="actions">
          <div class="segmented" role="radiogroup" aria-label="Periodo">
            <button
              v-for="p in ['1', '7', '30']"
              :key="p"
              type="button"
              role="radio"
              :aria-checked="period === p"
              @click="period = p"
            >
              {{ p === '1' ? 'Hoy' : `${p} días` }}
            </button>
          </div>
          <button type="button" class="btn">Exportar Excel</button>
        </div>
      </div>

      <section class="talones" aria-label="Indicadores">
        <article v-for="k in kpis" :key="k.serial" class="talon" :class="{ alert: k.alert }">
          <div class="stub">
            <span class="serial">N.° {{ k.serial }}</span
            ><span>{{ k.label }}</span>
          </div>
          <div class="perforation" aria-hidden="true"></div>
          <p class="figure value">{{ k.value }}</p>
          <p class="note">{{ k.note }}</p>
        </article>
      </section>

      <section class="grid">
        <article class="sheet chart">
          <h2>Ventas por día <small>S/ por día</small></h2>
          <div
            class="bars"
            role="img"
            aria-label="Ventas por día del 1 al 16 de noviembre; máximo S/ 564.99 el 8 de noviembre"
          >
            <div v-for="[d, v] in days" :key="d" class="bar-col">
              <span
                class="bar"
                :class="{ today: d === '16' }"
                :style="{ height: `${(v / maxDay) * 100}%` }"
              ></span>
              <span class="day">{{ d }}</span>
            </div>
          </div>
        </article>

        <article class="sheet">
          <h2>Últimas ventas <small>numeradas</small></h2>
          <table>
            <thead>
              <tr>
                <th>N.°</th>
                <th>Cliente</th>
                <th class="r">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in sales"
                :key="s.number"
                :class="{ cancelled: s.state === 'cancelled' }"
              >
                <td class="serial">{{ s.number }}</td>
                <td>
                  {{ s.customer }}
                  <span v-if="s.state === 'cancelled'" class="tag pink">Anulada</span>
                </td>
                <td class="r num">{{ formatMoney(s.total) }}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article class="sheet">
          <h2>Lo más vendido <small>por unidades</small></h2>
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
              <tr v-for="p in top" :key="p.sku">
                <td class="sku">{{ p.sku }}</td>
                <td>{{ p.name }}</td>
                <td class="r num">{{ p.units }}</td>
                <td class="r num">{{ formatMoney(p.total) }}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article class="sheet">
          <h2>Stock bajo <small>reponer</small></h2>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th class="r">Stock</th>
                <th class="r">Mín.</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in lowStock" :key="p.sku" class="pending">
                <td>
                  <span class="sku">{{ p.sku }}</span> {{ p.name }}
                </td>
                <td class="r num strong">{{ p.stock }}</td>
                <td class="r num">{{ p.min }}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>
      <ComponentsSection />
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
}

/* Sidebar en azul tinta; la sección activa es una lengüeta de papel que se une a la página */
.sidebar {
  position: sticky;
  top: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6) 0 var(--space-5) var(--space-5);
  background: var(--shell);
  color: var(--on-shell);
  overflow-y: auto;
}
.brand-block {
  display: grid;
  padding-right: var(--space-5);
}
.brand {
  font-stretch: var(--stretch-narrow);
  font-weight: 800;
  font-size: var(--text-3xl);
  letter-spacing: 0.02em;
  line-height: 1;
}
.shop {
  font-size: var(--text-md);
  opacity: 0.8;
  margin-top: var(--space-1);
}
.sidebar nav {
  display: grid;
  gap: 2px;
}
.group {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  padding: var(--space-4) var(--space-3) var(--space-1);
}
.group:first-child {
  padding-top: 0;
}
.sidebar nav a {
  color: var(--on-shell);
  opacity: 0.88;
  text-decoration: none;
  font-weight: 600;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}
.sidebar nav a:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--on-shell) 12%, transparent);
}
.sidebar nav a[aria-current='page'] {
  background: var(--ground);
  color: var(--blue);
  opacity: 1;
}
.sidebar nav a:focus-visible {
  outline-color: var(--on-shell);
  outline-offset: -2px;
}
.who {
  margin-top: auto;
  display: grid;
  gap: var(--space-3);
  padding-right: var(--space-5);
  font-size: var(--text-md);
}
.user {
  display: grid;
  font-weight: 700;
}
.user span {
  font-weight: 500;
  opacity: 0.8;
  font-size: var(--text-sm);
}
.theme {
  display: flex;
  justify-self: start;
  border: 1px solid color-mix(in srgb, var(--on-shell) 40%, transparent);
  border-radius: var(--radius-pill);
}
.theme button {
  all: unset;
  cursor: pointer;
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-pill);
}
.theme button[aria-pressed='true'] {
  background: var(--on-shell);
  color: var(--shell);
}
.theme button:focus-visible {
  box-shadow: 0 0 0 2px var(--on-shell);
}

.page {
  max-width: 1440px;
  margin: 0 auto;
  padding: var(--space-8);
  display: grid;
  gap: var(--space-6);
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
  margin-top: var(--space-1);
}
.actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}
.segmented {
  display: flex;
  background: var(--sheet);
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  padding: 2px;
}
.segmented button {
  all: unset;
  cursor: pointer;
  white-space: nowrap;
  padding: var(--space-2) var(--space-4);
  font-weight: 600;
  font-size: var(--text-md);
  border-radius: 4px;
  color: var(--ink-2);
}
.segmented button[aria-checked='true'] {
  background: var(--blue);
  color: var(--on-blue);
}
.segmented button:focus-visible,
.btn:focus-visible {
  box-shadow: var(--focus-ring);
}
.btn {
  all: unset;
  cursor: pointer;
  white-space: nowrap;
  padding: var(--space-2) var(--space-4);
  font-weight: 700;
  font-size: var(--text-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--blue);
  color: var(--blue);
  background: var(--sheet);
}
.btn:hover {
  background: var(--blue-soft);
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
  padding: var(--space-4) var(--space-5) var(--space-5);
}
.stub {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  color: var(--ink-2);
  font-size: var(--text-md);
  padding-bottom: var(--space-3);
}
.talon .perforation {
  margin: 0 calc(var(--space-5) * -1) var(--space-4);
}
.value {
  font-size: var(--text-4xl);
  color: var(--blue);
}
.talon.alert {
  background: var(--copy-yellow);
}
.talon.alert .value {
  color: var(--red);
}
.talon.alert .perforation::before,
.talon.alert .perforation::after {
  background: var(--ground);
}
.note {
  color: var(--ink-3);
  font-size: var(--text-md);
  margin-top: var(--space-1);
}
.talon.alert .note,
.talon.alert .stub {
  color: var(--copy-yellow-ink);
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
}
h2 {
  font-size: var(--text-xl);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-4);
}
h2 small {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-3);
  font-stretch: var(--stretch-normal);
}
.bars {
  display: flex;
  gap: var(--space-2);
  align-items: stretch;
  height: 220px;
}
.bar-col {
  flex: 1;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: var(--space-1);
}
.bar-col .bar {
  align-self: end;
  background: var(--series-1);
  border-radius: 2px 2px 0 0;
  min-height: 2px;
}
.bar-col .bar.today {
  background: var(--red);
}
.day {
  text-align: center;
  font-size: var(--text-xs);
  color: var(--ink-3);
  border-top: 2px solid var(--ink);
  padding-top: var(--space-1);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-md);
}
th {
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-3);
  padding: 0 var(--space-2) var(--space-2);
  border-bottom: 2px solid var(--ink);
}
td {
  padding: var(--space-2);
  border-bottom: 1px dashed var(--rule);
}
.r {
  text-align: right;
}
.num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.strong {
  color: var(--red);
}
.sku {
  font-stretch: var(--stretch-narrow);
  font-weight: 700;
  color: var(--ink-2);
  letter-spacing: 0.02em;
}
tr.cancelled td {
  background: var(--copy-pink);
  color: var(--copy-pink-ink);
}
tr.cancelled .r {
  text-decoration: line-through;
}
tr.pending td {
  background: color-mix(in srgb, var(--copy-yellow) 55%, transparent);
}
.tag {
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 1px var(--space-2);
  border-radius: var(--radius-pill);
  margin-left: var(--space-2);
}
.tag.pink {
  background: var(--sheet);
  color: var(--copy-pink-ink);
  border: 1px solid currentColor;
}

@media (max-width: 1100px) {
  .talones {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* En pantallas angostas la sidebar se vuelve una cabecera con la navegación desplazable */
@media (max-width: 900px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
  }
  .sidebar {
    position: static;
    height: auto;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) 0;
  }
  .brand {
    font-size: var(--text-2xl);
  }
  .shop,
  .group,
  .user {
    display: none;
  }
  .who {
    grid-row: 1;
    grid-column: 2;
    margin: 0;
    padding: 0;
    align-self: center;
  }
  .sidebar nav {
    grid-column: 1 / -1;
    display: flex;
    overflow-x: auto;
  }
  .sidebar nav a {
    white-space: nowrap;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    padding: var(--space-3) var(--space-4);
  }
}
@media (max-width: 640px) {
  .page {
    padding: var(--space-4);
  }
  h1 {
    font-size: var(--text-3xl);
  }
  .talones {
    grid-template-columns: minmax(0, 1fr);
  }
  .value {
    font-size: var(--text-3xl);
  }
}
</style>
