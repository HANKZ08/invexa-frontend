<script setup lang="ts">
/** Une el layout con la sesión real. Las rutas hijas ya pasaron la guarda de sesión y rol. */
import { computed } from 'vue'
import { RouterView, useRouter } from 'vue-router'

import { LogOut } from 'lucide-vue-next'

import UiButton from '@/components/UiButton.vue'
import { useSessionStore } from '@/stores/session'
import { useShopStore } from '@/stores/shop'

import AppLayout from './AppLayout.vue'
import type { Role } from './nav'

const session = useSessionStore()
const shop = useShopStore()
const router = useRouter()

const role = computed<Role>(() => session.role ?? 'cashier')
const userName = computed(() => session.user?.fullName ?? '')
const avatarUrl = computed(() => session.user?.avatarUrl ?? null)

function signOut() {
  session.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <AppLayout
    :role="role"
    :user-name="userName"
    :shop-name="shop.name"
    :avatar-url="avatarUrl"
    :logo-url="shop.logoUrl"
    :icon-url="shop.iconUrl"
  >
    <template #session-actions>
      <UiButton size="sm" variant="ghost" class="signout" @click="signOut"
        ><LogOut :size="16" aria-hidden="true" /><span class="signout-label">Salir</span></UiButton
      >
    </template>
    <RouterView />
  </AppLayout>
</template>

<style scoped>
.signout {
  justify-self: start;
  color: var(--on-shell);
}
</style>
