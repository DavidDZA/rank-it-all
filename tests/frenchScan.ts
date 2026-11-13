import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from '@babel/parser';

/**
 * Recherche des textes français écrits en dur dans le code de l'appli (hors dictionnaires src/i18n/ et
 * commentaires) : chaînes, gabarits et textes JSX. Sert au test i18n.test.ts : tout texte affiché doit passer par
 * les dictionnaires, sinon il reste en français dans les autres langues.
 * (TypeScript 7 n'a plus d'API JavaScript : l'analyse du code passe par @babel/parser.)
 */

/** Lettres et signes propres au français (les textes techniques n'en ont pas). */
const FRENCH_CHARS = /[éèêëàâçùûüôîïœÉÈÊÀÂÇÙÛÔÎŒ’«»]/;
/** Mots français courants, pour les textes sans accent (« Passer », « Films vus »). */
const FRENCH_WORDS =
  /\b(le|la|les|des|du|une?|tes|ton|ta|mes|mon|ma|pour|avec|sans|dans|sur|pas|vus?|vues?|films?|titres?|classement|envie|fermer|annuler|passer|choisir|chargement|ajouter|supprimer|retour|filtres?|tous|toutes|aucune?|oui|non|ou|et|est|sont|ce|cette|plus|moins|jours?|heures?|amis?|compte|ami|chercher|rechercher|bien|bof|tri[ée]?s?|liste|soir|regarder|catalogue|mettre|jour|duels?)\b/i;

export interface Hit {
  file: string;
  line: number;
  text: string;
}

/** Textes à ignorer (techniques, ou volontairement en français). */
const IGNORED: RegExp[] = [/^sort-my-stuffs$/, /^renamed-from:/, /^Sort my stuffs$/, /^"Fredoka Variable"/, /^Rank It All$/, /^This product uses the TMDB API/];

/** Attributs JSX et propriétés dont la valeur est affichée telle quelle. */
const DISPLAYED_ATTRS = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label']);
const DISPLAYED_PROPS = new Set(['label', 'caption', 'tip', 'text', 'title', 'question', 'desc', 'name', 'placeholder', 'message', 'emptyText', 'empty', 'leftCap', 'rightCap', 'leftTip', 'rightTip']);

function looksFrench(text: string, jsx: boolean): boolean {
  const s = text.trim();
  if (!s || IGNORED.some((r) => r.test(s))) return false;
  if (FRENCH_CHARS.test(s)) return true;
  if (!/[a-zA-Z]{2}/.test(s)) return false; // emoji, ponctuation, nombres
  if (jsx) return true; // texte JSX : toujours affiché
  return FRENCH_WORDS.test(s) && /\s/.test(s);
}

type Node = { type: string; loc?: { start: { line: number } }; [key: string]: unknown };

function scanFile(path: string, root: string): Hit[] {
  const ast = parse(readFileSync(path, 'utf8'), { sourceType: 'module', plugins: ['typescript', ...(path.endsWith('x') ? (['jsx'] as const) : [])] });
  const hits: Hit[] = [];
  const add = (node: Node, text: string) =>
    hits.push({ file: relative(root, path).replace(/\\/g, '/'), line: node.loc?.start.line ?? 0, text: text.trim().replace(/\s+/g, ' ').slice(0, 90) });
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object' || typeof (node as Node).type !== 'string') return;
    const n = node as Node;
    // Messages pour le développeur (console.*), imports et types : jamais affichés.
    if (n.type === 'CallExpression') {
      const callee = n.callee as Node & { object?: Node & { name?: string } };
      if (callee.type === 'MemberExpression' && callee.object?.name === 'console') return;
    }
    if (n.type === 'ImportDeclaration' || n.type === 'ExportAllDeclaration' || n.type.startsWith('TS')) return;
    // Attributs JSX toujours affichés (info-bulle, texte d'aide, lecteur d'écran) et propriétés nommées comme un texte
    // affiché : même un seul mot sans accent (« Passer », « Toutes ») y est un texte à traduire.
    const shown = (value: unknown) => typeof value === 'string' && /[a-zA-Z]{2}/.test(value) && !/^[a-z0-9-]+$/.test(value) && !IGNORED.some((r) => r.test(value));
    if (n.type === 'JSXAttribute') {
      const name = (n.name as { name?: string }).name ?? '';
      if (name === 'className' || name === 'key' || name === 'id' || name === 'href') return; // classes CSS, clés, liens
      const value = n.value as Node | null;
      if (DISPLAYED_ATTRS.has(name) && value?.type === 'StringLiteral' && shown(value.value) && !looksFrench(value.value as string, false)) add(value, value.value as string);
    }
    if (n.type === 'ObjectProperty') {
      const key = n.key as { name?: string; value?: string };
      const value = n.value as Node;
      if (DISPLAYED_PROPS.has(key.name ?? key.value ?? '') && value.type === 'StringLiteral' && shown(value.value) && !looksFrench(value.value as string, false)) add(value, value.value as string);
    }
    if (n.type === 'StringLiteral' && looksFrench(n.value as string, false)) add(n, n.value as string);
    if (n.type === 'TemplateLiteral') {
      const text = (n.quasis as { value: { cooked: string } }[]).map((q) => q.value.cooked).join(' … ');
      if (looksFrench(text, false)) add(n, text);
    }
    if (n.type === 'JSXText' && looksFrench(n.value as string, true)) add(n, n.value as string);
    for (const [key, value] of Object.entries(n)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
      if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast.program);
  return hits;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'i18n' ? [] : files(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.d.ts') && name !== 'database.types.ts' ? [path] : [];
  });
}

/** Tous les textes français écrits en dur dans src/ (hors src/i18n/). */
export function scanFrench(root: string): Hit[] {
  return files(join(root, 'src')).flatMap((f) => scanFile(f, root));
}

// Lancé directement (npx tsx tests/frenchScan.ts [--all] [fichier]) : liste par fichier.
if (process.argv[1]?.endsWith('frenchScan.ts')) {
  const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const hits = scanFrench(process.cwd()).filter((h) => !only || h.file.includes(only));
  const byFile = new Map<string, Hit[]>();
  for (const h of hits) byFile.set(h.file, [...(byFile.get(h.file) ?? []), h]);
  for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${file} (${list.length})`);
    if (process.argv.includes('--all') || only) for (const h of list) console.log(`  ${h.line}: ${h.text}`);
  }
  console.log(`Total : ${hits.length}`);
}
