import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { TextDecoder } from 'node:util';

const textExtensions = new Set([
  '.css',
  '.html',
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const mojibakeMarkers = ['\u00c3', '\u00c2', '\u00e2\u20ac', '\ufffd'];
const decoder = new TextDecoder('utf-8', { fatal: true });
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split(/\r?\n/u)
  .filter(Boolean)
  .filter((file) => textExtensions.has(file.slice(file.lastIndexOf('.'))));

const failures = [];

for (const file of files) {
  try {
    const content = decoder.decode(readFileSync(file));
    if (mojibakeMarkers.some((marker) => content.includes(marker))) {
      failures.push(`${file}: posible texto con codificación defectuosa`);
    }
  } catch {
    failures.push(`${file}: no es UTF-8 válido`);
  }
}

if (failures.length > 0) {
  throw new Error(`La comprobación UTF-8 falló:\n${failures.join('\n')}`);
}

console.log(`UTF-8 verificado en ${files.length} archivos de texto.`);
