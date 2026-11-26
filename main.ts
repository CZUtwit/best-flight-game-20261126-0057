// Cloudrunner — hand-in program (Node 22, standard library only).
// It takes this repository's game/ and screenshots/ and lays them out in
// /output exactly as the grader expects, then writes /output/dossier.json,
// the summary the judge reads, using the vendored make.fun library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory holding this file.
const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game first: every static file the browser loads, untouched.
mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });

// Then the screenshots, if the maker has taken them.
const shotDir = join(outDir, 'screenshots');
mkdirSync(shotDir, { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), shotDir, { recursive: true });
}

// The dossier is built from what is actually in /output, with the same
// caps the gate enforces, so what the judge reads is what was handed in.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
