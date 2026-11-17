# Invexa · frontend

Interfaz del sistema de inventario y punto de venta **Invexa**, para una ferretería en Perú. Permite vender en caja con teclado y lector de código de barras, controlar el stock con un kardex, gestionar deudas y ver reportes.

Es la mitad web del proyecto. La API vive en [`../invexa-backend`](../invexa-backend).

## Stack

- Vue 3 + TypeScript (`<script setup>`), Vite
- Vue Router, Pinia, TanStack Query
- Cliente de API generado desde el esquema OpenAPI del backend (`openapi-fetch`)
- Vitest + Vue Test Utils + MSW para las pruebas
- oxlint, ESLint, Prettier y vue-tsc

## Requisitos

- Node.js 24 o superior
- El backend corriendo en `http://localhost:3000` (ver su README)

## Puesta en marcha

```bash
npm ci
npm run dev
```

La app queda en `http://localhost:5173`. Vite reenvía `/api` al backend.

### Variables de entorno

Copia `.env.example` a `.env` si necesitas cambiar algo:

| Variable                | Para qué sirve                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `VITE_API_PROXY_TARGET` | Dónde vive el backend para el proxy de desarrollo (por defecto `http://localhost:3000`). |
| `VITE_API_URL`          | URL pública de la API cuando no se usa el proxy. Vacía en desarrollo.                    |

### Acceso desde otra computadora de la red

`npm run dev` escucha en todas las interfaces. Desde otro equipo usa la IP de esta máquina en el puerto 5173. El firewall de Windows puede bloquear el puerto.

## Scripts

| Comando                | Qué hace                                                                |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo.                                                 |
| `npm run build`        | Revisa tipos y genera el build de producción en `dist/`.                |
| `npm run preview`      | Sirve el build para revisarlo.                                          |
| `npm run test`         | Pruebas con cobertura.                                                  |
| `npm run typecheck`    | Revisa tipos con vue-tsc.                                               |
| `npm run lint`         | oxlint y ESLint, sin advertencias permitidas.                           |
| `npm run format`       | Revisa el formato con Prettier.                                         |
| `npm run format:write` | Corrige el formato.                                                     |
| `npm run api:types`    | Regenera `src/api/schema.d.ts` desde el backend (debe estar corriendo). |

## Estructura

```
src/
  api/          cliente de API y tipos generados del esquema OpenAPI
  app/          router, navegación por rol, layout y guardas de sesión
  components/   componentes base (Ui*) con los tokens de diseño
  composables/  utilidades reutilizables (notificaciones, paginación, tema)
  features/     una carpeta por área: auth, catalog, stock, pos, sales,
                debts, reports, users, shop
  stores/       sesión y configuración de la tienda (Pinia)
  styles/       tokens de color, tipografía y espaciado
```

Las especificaciones de cada área están en `SPEC*.md`. El diseño visual está en `DESIGN.md`.

## Roles

El backend decide los permisos; el frontend solo oculta lo que cada rol no puede usar.

- **Administrador:** todo, incluido Configuración de la tienda, usuarios y reportes.
- **Cajero:** caja, ventas, clientes, deudores y productos.
- **Bodeguero:** inventario, productos, categorías y proveedores.

## Pruebas y calidad

Cada cambio pasa por el mismo flujo que corre en GitHub Actions (`.github/workflows/ci.yml`): instalación limpia, lint, formato, tipos, pruebas con cobertura, build y revisión de dependencias.

## Autor y derechos de autor

Hank

Copyright (c) 2026 Hank. Todos los derechos reservados. Ver [LICENSE](LICENSE).
