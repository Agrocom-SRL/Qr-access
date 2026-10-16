/**
 * Fronteras del backend (ADR 0003). Un módulo nuevo en src/modules/<modulo>/
 * queda cubierto por patrón, sin tocar este archivo.
 */
module.exports = {
  forbidden: [
    {
      name: 'sin-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'entre-modulos-solo-contratos-y-eventos',
      comment:
        'Un módulo solo importa contracts.ts o events.ts de otro módulo, nunca su repositorio, acciones, dominio ni SQL.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/(contracts|events)\\.ts$'],
      },
    },
    {
      name: 'plataforma-no-depende-de-modulos',
      comment: 'Lo transversal (platform/, plugins/) no conoce a los módulos.',
      severity: 'error',
      from: { path: '^src/(platform|plugins)/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'dominio-puro',
      comment: 'domain/ no toca base, red ni Fastify: se prueba con casos escritos a mano.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: [
          '^src/platform/db/',
          '^src/plugins/',
          '^src/modules/[^/]+/(repository|routes)\\.ts$',
        ],
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'domain-sin-paquetes-de-infraestructura',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: 'node_modules/(mysql2|fastify)' },
    },
    {
      name: 'solo-app-registra-rutas',
      comment:
        'Las rutas de un módulo las registra app.ts, desde el registro modulos.ts, y nadie más (ADR 0019).',
      severity: 'error',
      from: { pathNot: '^src/(app|modulos)\\.ts$' },
      to: { path: '^src/modules/[^/]+/routes\\.ts$' },
    },
    {
      name: 'sin-huerfanos',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '^src/server\\.ts$'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
