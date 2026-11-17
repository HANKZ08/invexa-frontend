<script setup lang="ts">
/** Estructura de la app: sidebar en azul tinta con la navegación del rol y el área de trabajo. */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import UiToastHost from '@/components/UiToastHost.vue'
import { useTheme, type Theme } from '@/composables/useTheme'

import { navFor, ROLE_LABELS, type Role } from './nav'

const props = defineProps<{
  role: Role
  userName: string
  shopName: string
  avatarUrl?: string | null
  logoUrl?: string | null
  iconUrl?: string | null
}>()
const initials = computed(
  () =>
    props.userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?',
)

// Logos de la tienda; si no hay propios, se usan los de instalación en public/.
// Van como texto para que Vite no los reescriba como módulos.
// Sin ícono propio, el menú contraído muestra la inicial de Invexa.
const brandInitial = 'I'

const groups = computed(() => navFor(props.role))

// Menú contraído (solo íconos) en escritorio; la preferencia queda en este navegador.
const COLLAPSED_KEY = 'invexa.sidebar'
const collapsed = ref(readCollapsed())
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'compact'
  } catch {
    return false
  }
}
function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed.value ? 'compact' : 'expanded')
  } catch {
    // Sin almacenamiento: la preferencia dura solo esta sesión.
  }
}
const { theme, setTheme } = useTheme()
const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]
</script>

<template>
  <div class="layout" :class="{ 'layout--compact': collapsed }">
    <a class="skip" href="#contenido">Saltar al contenido</a>
    <aside class="sidebar">
      <div class="brand-block">
        <img v-if="logoUrl" class="brand-logo" :src="logoUrl" :alt="shopName" />
        <span v-else class="brand">Invexa</span>
        <img v-if="iconUrl" class="brand-icon" :src="iconUrl" alt="" aria-hidden="true" />
        <span v-else class="brand-mark" aria-hidden="true">{{ brandInitial }}</span>
        <span class="shop">{{ shopName }}</span>
        <div class="theme" role="group" aria-label="Tema">
          <button
            v-for="t in THEMES"
            :key="t.value"
            type="button"
            :aria-pressed="theme === t.value"
            @click="setTheme(t.value)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <nav aria-label="Principal">
        <template v-for="group in groups" :key="group.label">
          <p class="group">{{ group.label }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="link"
            :title="collapsed ? item.label : undefined"
          >
            <component :is="item.icon" class="icon" :size="18" aria-hidden="true" />
            <span class="label">{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>

      <div class="who">
        <RouterLink to="/cuenta" class="user">
          <span class="avatar"
            ><img v-if="avatarUrl" :src="avatarUrl" alt="" /><span v-else>{{
              initials
            }}</span></span
          ><span class="name">{{ userName }}</span
          ><span class="role">{{ ROLE_LABELS[role] }}</span>
        </RouterLink>
        <slot name="session-actions" />
      </div>
    </aside>

    <button
      type="button"
      class="collapse"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? 'Expandir menú' : 'Contraer menú'"
      :title="collapsed ? 'Expandir menú' : 'Contraer menú'"
      @click="toggleCollapsed"
    >
      {{ collapsed ? '›' : '‹' }}
    </button>
    <main id="contenido" class="content" tabindex="-1">
      <slot />
    </main>
    <UiToastHost />
  </div>
</template>

<style scoped>
.layout {
  position: relative;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
}
.skip {
  position: absolute;
  left: var(--space-4);
  top: -100px;
  z-index: 60;
  padding: var(--space-2) var(--space-4);
  background: var(--sheet);
  color: var(--blue);
  border-radius: var(--radius-md);
  font-weight: 700;
}
.skip:focus {
  top: var(--space-4);
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
  gap: var(--space-3);
  padding-right: var(--space-5);
}
.brand {
  font-stretch: var(--stretch-narrow);
  font-weight: 800;
  font-size: var(--text-3xl);
  letter-spacing: 0.02em;
  line-height: 1;
}
.brand-logo {
  width: 190px;
  height: auto;
}
.brand-mark {
  display: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--on-shell);
  color: var(--shell);
  font-weight: 800;
  font-size: var(--text-2xl);
}
.brand-icon {
  display: none;
  width: 44px;
  height: 44px;
}
.shop {
  font-size: var(--text-md);
  opacity: 0.85;
  margin-top: var(--space-1);
}
nav {
  display: grid;
  gap: 2px;
}
.group {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
  padding: var(--space-4) var(--space-3) var(--space-1);
}
.group:first-child {
  padding-top: 0;
}
.link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--on-shell);
  opacity: 0.9;
  text-decoration: none;
  font-weight: 600;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}
.link:hover {
  opacity: 1;
  color: var(--on-shell);
  background: color-mix(in srgb, var(--on-shell) 12%, transparent);
}
.link.router-link-active {
  background: var(--ground);
  color: var(--blue);
  opacity: 1;
}
.link:focus-visible,
.user:focus-visible {
  outline-color: var(--on-shell);
  outline-offset: -2px;
}
.icon {
  flex: none;
}
.who {
  margin-top: 0;
  display: grid;
  gap: var(--space-3);
  padding-right: var(--space-5);
  font-size: var(--text-md);
}
.user {
  display: grid;
  font-weight: 700;
  color: var(--on-shell);
  text-decoration: none;
  border-radius: var(--radius-sm);
}
.user:hover {
  color: var(--on-shell);
  text-decoration: underline;
}
.user .role {
  font-weight: 500;
  opacity: 0.85;
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
.content {
  min-width: 0;
  outline: none;
}

/* En pantallas angostas la sidebar se vuelve cabecera con navegación desplazable */
@media (max-width: 900px) {
  .layout--compact {
    grid-template-columns: minmax(0, 1fr);
  }
  .collapse {
    display: none;
  }
  .layout--compact .label,
  .layout--compact .user,
  .layout--compact .theme {
    display: revert;
  }
  .layout--compact .name,
  .layout--compact .role {
    display: none;
  }
  .who {
    min-width: max-content;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .who > .user {
    display: none;
  }
  .layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }
  .sidebar {
    position: static;
    height: auto;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) 0;
  }
  .brand-logo {
    width: 150px;
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
  nav {
    grid-column: 1 / -1;
    display: flex;
    overflow-x: auto;
  }
  .link {
    white-space: nowrap;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    padding: var(--space-3) var(--space-4);
  }
}

@media (min-width: 901px) {
  /* Botón de contraer: pastilla centrada en vertical, sobre el borde de la sidebar */
  .collapse {
    all: unset;
    cursor: pointer;
    position: fixed;
    top: 50dvh;
    left: calc(248px - 12px);
    transform: translateY(-50%);
    z-index: 10;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--shell);
    color: var(--on-shell);
    border: 2px solid var(--ground);
    font-size: var(--text-lg);
    font-weight: 700;
    transition: left var(--duration-base) var(--ease-out);
  }
  .collapse:hover {
    background: var(--blue);
  }
  .collapse:focus-visible {
    box-shadow: 0 0 0 2px var(--blue);
  }
  .brand-block {
    position: relative;
  }
  .layout {
    transition: grid-template-columns var(--duration-base) var(--ease-out);
  }
  .layout--compact {
    grid-template-columns: 76px minmax(0, 1fr);
  }
  .layout--compact .sidebar {
    padding-left: var(--space-3);
    padding-right: var(--space-3);
  }
  .layout--compact .brand-block {
    padding-right: 0;
    align-items: center;
  }
  .layout--compact .brand,
  .layout--compact .brand-logo {
    display: none;
  }
  .layout--compact .brand-icon {
    display: block;
  }
  .layout--compact .brand-mark {
    display: grid;
  }
  .layout--compact .shop,
  .layout--compact .group,
  .layout--compact .label,
  .layout--compact .name,
  .layout--compact .role,
  .layout--compact .theme {
    display: none;
  }
  .layout--compact .collapse {
    left: calc(76px - 12px);
  }
  /* Solo ícono en el botón Salir: no desborda ni genera scroll */
  .layout--compact :deep(.signout-label) {
    display: none;
  }
  .layout--compact :deep(.signout) {
    justify-self: center;
    min-width: 0;
  }
  .layout--compact .link {
    justify-content: center;
    padding: var(--space-3);
    border-radius: var(--radius-md);
  }
  .layout--compact .who {
    padding-right: 0;
    justify-items: center;
  }
  .layout--compact .user {
    justify-items: center;
  }
  .layout--compact nav {
    gap: 4px;
  }
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-grid;
  place-items: center;
  background: var(--on-shell);
  color: var(--shell);
  font-size: var(--text-sm);
  font-weight: 800;
  margin-bottom: var(--space-1);
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.user {
  display: grid;
  justify-items: start;
}
nav {
  margin-block: auto;
}
</style>
