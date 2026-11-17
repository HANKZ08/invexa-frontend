import './styles/base.css'

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

import App from './App.vue'
import router, { setDocumentTitle } from './app/router'
import { useSessionStore } from './stores/session'
import { useShopStore } from './stores/shop'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un error de red no debe reintentarse en silencio varias veces: la pantalla muestra "Reintentar".
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
app.use(VueQueryPlugin, { queryClient })

// Nombre, logos y favicon de la tienda: no bloquean el arranque.
const shop = useShopStore(pinia)
shop.load()
// Si el administrador cambia el nombre, la pestaña se actualiza sin esperar a otra navegación.
watch(
  () => shop.name,
  () => setDocumentTitle(router.currentRoute.value.meta.title as string | undefined),
)

// La sesión se restaura antes de instalar el router: así la primera navegación ya ve al usuario
// y no manda a /login a quien recargó la página.
useSessionStore(pinia)
  .restore()
  .finally(() => {
    app.use(router)
    app.mount('#app')
  })
