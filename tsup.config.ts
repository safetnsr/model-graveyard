import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  entry: ['src/cli.ts'],
  outDir: 'dist',
  format: 'esm',
  target: 'node20',
  splitting: false,
  clean: true,
  dts: false,
  sourcemap: false,
  async onSuccess() {
    // Prepend shebang to ESM output so it can be used as a CLI binary
    const outFile = 'dist/cli.js';
    const content = readFileSync(outFile, 'utf8');
    if (!content.startsWith('#!')) {
      writeFileSync(outFile, `#!/usr/bin/env node\n${content}`, 'utf8');
    }
    // Make executable
    const { chmodSync } = await import('fs');
    chmodSync(outFile, 0o755);
    console.log('Added shebang + chmod +x to dist/cli.js');
  },
});
