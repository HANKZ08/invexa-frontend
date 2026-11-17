import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig((configEnv) =>
  mergeConfig(viteConfig(configEnv), {
    test: {
      environment: 'jsdom',
      // Origen del frontend; evita que un test llame por error al backend real en :3000.
      environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        exclude: [
          'src/**/*.spec.ts',
          'src/**/__tests__/**',
          'src/api/schema.d.ts',
          'src/main.ts',
          // Página de muestra del sistema visual (solo desarrollo)
          'src/views/DesignPreviewView.vue',
          'src/views/preview/**',
        ],
      },
    },
  }),
)
