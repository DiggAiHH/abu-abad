import { mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src', 'database');
const outDir = path.join(projectRoot, 'dist', 'database');

async function main() {
  await mkdir(outDir, { recursive: true });

  const entries = await readdir(srcDir);
  for (const entry of entries) {
    const full = path.join(srcDir, entry);
    const s = await stat(full);
    if (!s.isFile()) continue;
    if (!entry.endsWith('.sql')) continue;

    await copyFile(full, path.join(outDir, entry));
  }

  process.stdout.write('✓ Copied SQL assets to dist/database\n');
}

main().catch((err) => {
  process.stderr.write(`❌ Failed to copy assets: ${err?.message || err}\n`);
  process.exit(1);
});
