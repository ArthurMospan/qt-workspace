import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_APP_ROOT = join(ROOT, 'src', 'app', '(app)');
const SHARED_UI_ROOT = join(ROOT, 'src', 'components', 'ui');
const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) files.push(...walk(path));
    else if (SOURCE_EXTENSIONS.includes(extname(path))) files.push(path);
  }
  return files;
}

function resolveSourceFile(candidate) {
  const normalized = normalize(candidate);
  const candidates = [
    normalized,
    ...SOURCE_EXTENSIONS.map(extension => `${normalized}${extension}`),
    ...SOURCE_EXTENSIONS.map(extension => join(normalized, `index${extension}`)),
  ];
  return candidates.find(path => existsSync(path) && statSync(path).isFile()) || null;
}

function resolveLocalImport(fromFile, specifier) {
  if (specifier.startsWith('@/')) {
    return resolveSourceFile(join(ROOT, 'src', specifier.slice(2)));
  }
  if (specifier.startsWith('.')) {
    return resolveSourceFile(resolve(dirname(fromFile), specifier));
  }
  return null;
}

function isInside(path, directory) {
  const prefix = directory.endsWith(sep) ? directory : `${directory}${sep}`;
  return path === directory || path.startsWith(prefix);
}

function localSpecifiers(source) {
  const ast = parse(source, {
    sourceType: 'unambiguous',
    plugins: [
      'jsx',
      'typescript',
      'decorators-legacy',
      'classProperties',
      'dynamicImport',
      'topLevelAwait',
    ],
  });
  const specifiers = [];
  for (const statement of ast.program.body) {
    if (
      statement.type === 'ImportDeclaration'
      || statement.type === 'ExportNamedDeclaration'
      || statement.type === 'ExportAllDeclaration'
    ) {
      if (statement.source?.value) specifiers.push(statement.source.value);
    }
  }
  return specifiers;
}

/**
 * Returns the local source graph reachable from authenticated App Router
 * routes. Public, auth, onboarding and showcase-only files are intentionally
 * absent unless an authenticated workspace route imports them.
 */
export function collectWorkspaceUiFiles({ includeSharedUi = false } = {}) {
  const roots = walk(WORKSPACE_APP_ROOT);
  const queued = [...roots];
  const seen = new Set();

  while (queued.length > 0) {
    const file = queued.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, 'utf8');
    for (const specifier of localSpecifiers(source)) {
      const imported = resolveLocalImport(file, specifier);
      if (!imported) continue;
      if (!includeSharedUi && isInside(imported, SHARED_UI_ROOT)) continue;
      if (!seen.has(imported)) queued.push(imported);
    }
  }

  return [...seen].sort();
}

export const workspacePaths = {
  root: ROOT,
  appRoot: WORKSPACE_APP_ROOT,
  sharedUiRoot: SHARED_UI_ROOT,
};
