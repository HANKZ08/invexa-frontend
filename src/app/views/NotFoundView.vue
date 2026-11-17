<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="not-found">
    <p class="serial">N.° 404</p>
    <h1>Esta página no existe</h1>
    <p>Revisa la dirección o vuelve al inicio.</p>
    <RouterLink to="/" class="home">Ir al inicio</RouterLink>
  </main>
</template>

<style scoped>
.not-found {
  min-height: 100dvh;
  display: grid;
  place-content: center;
  justify-items: start;
  gap: var(--space-3);
  padding: var(--space-8);
}
h1 {
  font-size: var(--text-4xl);
}
.serial {
  font-size: var(--text-xl);
}
.home {
  margin-top: var(--space-3);
  font-weight: 700;
}
</style>
