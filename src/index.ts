// Library exports for programmatic use
export { scan } from './scanner.js';
export { getRegistry, resolveModel, isKnownModelString } from './registry.js';
export { migrate } from './migrator.js';
export type { ModelEntry, Registry, Match, ScanReport, MigrationChange, MigrationReport, ModelStatus } from './types.js';
