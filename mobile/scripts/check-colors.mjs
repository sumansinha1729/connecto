// Fails if a colour is written directly in a screen or component instead of
// coming from the theme (src/theme) or the room topic themes (constants/roomThemes).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = ['src/theme/', 'src/constants/roomThemes.ts', 'src/constants/avatars.ts'];
const COLOR = /['"](#[0-9a-fA-F]{3,8}|rgba?\([^'"]+\))['"]/g;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.tsx?$/.test(name)) yield path;
  }
}

const problems = [];
for (const file of files('src')) {
  if (ALLOWED.some((allowed) => file.startsWith(allowed))) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const match of line.matchAll(COLOR)) problems.push(`${file}:${i + 1}  ${match[1]}`);
    });
}

if (problems.length) {
  console.error(`Colours must come from the theme (src/theme). Found ${problems.length}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('Colours: all from the theme ✓');
