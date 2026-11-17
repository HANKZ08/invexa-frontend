<script setup lang="ts">
/** Pantalla pendiente: indica en qué tarea del plan se construye. */
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section class="placeholder">
    <h1>{{ route.meta.title }}</h1>
    <article class="sheet">
      <div class="stub">
        <span class="serial">Pendiente</span>
        <span>{{ route.meta.task }}</span>
      </div>
      <div class="perforation" aria-hidden="true"></div>
      <p>Esta pantalla todavía no está construida. Se arma en {{ route.meta.task }} del plan.</p>
    </article>
  </section>
</template>

<style scoped>
.placeholder {
  padding: var(--space-8);
  display: grid;
  gap: var(--space-6);
  max-width: 720px;
}
h1 {
  font-size: var(--text-4xl);
}
.sheet {
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
.perforation {
  margin: 0 calc(var(--space-5) * -1) var(--space-4);
}
p {
  color: var(--ink-2);
}
@media (max-width: 640px) {
  .placeholder {
    padding: var(--space-4);
  }
}
</style>
