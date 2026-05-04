/**
 * Hex-layer enforcement for the BE and FE workspaces.
 *
 * Both packages share the same import-direction rule:
 *   domain      → nothing inside this package
 *   application → domain only
 *   adapters    → application + domain (and @todolist/shared)
 *   main / index / composition root → anything (it is the wiring)
 *
 * Plus a defensive ban on importing the persistence-boundary "unsafe"
 * symbols outside `domain/task/`. ADR-0022 documented this as a Session-7
 * follow-up; ADR-0032 wires it.
 *
 * Limited to the two source packages — `packages/shared/` is a leaf
 * contract module with no internal layers, and `packages/e2e/` is a
 * black-box test workspace.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make the dependency graph un-reasonable.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'A module that nothing imports is either dead code or test scaffolding that escaped a folder rename.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(?:cjs|mjs|js|cts|mts|ts)$',
          '\\.(?:test|spec|test-support)\\.(?:[jt]sx?|mjs|cjs)$',
          '(^|/)(?:tsconfig|biome|vite|playwright|nginx)\\.[^/]+$',
          'packages/[^/]+/src/(?:index|main)\\.(?:[jt]sx?|mjs|cjs)$',
          'packages/[^/]+/src/(?:index|main)\\.tsx$',
          'packages/frontend/src/styles\\.css$',
          'packages/frontend/src/theme\\.css$',
          // Ports + value-object companions are consumed via type-only
          // imports that the analyzer does not always trace.
          'packages/backend/src/application/ports/',
          'packages/backend/src/domain/task/task-status\\.ts$',
        ],
      },
      to: {},
    },

    /* ---------- Hex-layer rules: BE ---------- */
    {
      name: 'be-domain-purity',
      severity: 'error',
      comment:
        'BE domain/ must depend on nothing inside the package. Pure logic only — no use cases, no adapters.',
      from: { path: '^packages/backend/src/domain/' },
      to: {
        path: '^packages/backend/src/(?:application|adapters)/',
      },
    },
    {
      name: 'be-application-no-adapters',
      severity: 'error',
      comment:
        'BE application/ may depend on domain/ but never on a concrete adapter. Define a port; main wires it.',
      from: { path: '^packages/backend/src/application/' },
      to: { path: '^packages/backend/src/adapters/' },
    },
    {
      name: 'be-adapters-no-cross-package-deps',
      severity: 'error',
      comment:
        'BE adapters/ may depend on application/ ports + domain/ types + @todolist/shared. Nothing else inside src/.',
      from: { path: '^packages/backend/src/adapters/' },
      to: {
        path: '^packages/backend/src/',
        pathNot: '^packages/backend/src/(?:application|domain|adapters)/',
      },
    },

    /* ---------- Hex-layer rules: FE ---------- */
    {
      name: 'fe-domain-purity',
      severity: 'error',
      comment:
        'FE domain/ must depend on nothing inside the package. Pure types and helpers only.',
      from: { path: '^packages/frontend/src/domain/' },
      to: {
        path: '^packages/frontend/src/(?:application|adapters|ui)/',
      },
    },
    {
      name: 'fe-application-no-adapters-or-ui',
      severity: 'error',
      comment:
        'FE application/ may depend on domain/ only. No api adapters, no React components.',
      from: { path: '^packages/frontend/src/application/' },
      to: { path: '^packages/frontend/src/(?:adapters|ui)/' },
    },
    {
      name: 'fe-adapters-no-ui',
      severity: 'error',
      comment: 'FE adapters/ may depend on application/ + domain/ + @todolist/shared. Never on ui/.',
      from: { path: '^packages/frontend/src/adapters/' },
      to: { path: '^packages/frontend/src/ui/' },
    },

    /* ---------- Persistence boundary defensive ban ---------- */
    {
      name: 'no-unsafe-domain-escape-hatches',
      severity: 'error',
      comment:
        'Symbols prefixed with __unsafe live behind the persistence trust boundary (ADR-0022). They must only be imported by domain/task/.',
      from: { pathNot: '^packages/backend/src/domain/task/' },
      to: { path: '__unsafe[A-Z]' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        'node_modules',
        'dist',
        'build',
        'coverage',
        '\\.dependency-cruiser\\.cjs$',
        // Tests can reach across layers freely; the rules above apply to the
        // production graph that the bundler / runtime actually walks.
        '\\.(?:test|spec)\\.(?:[jt]sx?|mjs|cjs)$',
        'test-helpers\\.tsx?$',
        'task\\.test-support\\.ts$',
        'packages/backend/test/',
        'packages/e2e/',
      ],
    },
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['main', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    },
    progress: { type: 'none' },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
