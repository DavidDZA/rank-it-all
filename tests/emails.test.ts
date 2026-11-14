import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGS } from '../src/i18n';
import { emailLanguageOutdated } from '../src/lib/cloud';

/**
 * E-mails du compte (supabase/emails/, à recopier dans Supabase) : rendus dans chaque langue par un petit
 * interpréteur des seules instructions de gabarit Go qu'ils utilisent (commentaires, variables, if / else if / else,
 * eq, printf "%v", suppression des blancs « {{- -}} »). Une instruction inconnue fait échouer le test.
 */

type Data = { ConfirmationURL: string; Data: Record<string, unknown> };

function render(template: string, data: Data): string {
  const vars = new Map<string, string>();
  const value = (expr: string): string => {
    const e = expr.trim();
    if (/^"(?:[^"\\]|\\.)*"$/.test(e)) return JSON.parse(e) as string;
    if (e === '.ConfirmationURL') return data.ConfirmationURL;
    const printed = e.match(/^(?:printf "%v"|print) \.Data\.(\w+)$/);
    if (printed) return String(data.Data[printed[1]] ?? '<nil>');
    if (/^\$\w+$/.test(e)) {
      if (!vars.has(e)) throw new Error(`variable inconnue ${e}`);
      return vars.get(e)!;
    }
    throw new Error(`expression non prise en charge : ${e}`);
  };
  const test = (cond: string): boolean => {
    const m = cond.trim().match(/^eq (\$\w+) ("[^"]*")$/);
    if (!m) throw new Error(`condition non prise en charge : ${cond}`);
    return value(m[1]) === value(m[2]);
  };

  // Découpage en textes et instructions, avec la suppression des blancs de part et d'autre.
  const parts: ({ text: string } | { action: string })[] = [];
  const re = /\{\{(-?)\s*([\s\S]*?)\s*(-?)\}\}/g;
  let last = 0;
  let trimNext = false;
  for (const m of template.matchAll(re)) {
    let text = template.slice(last, m.index);
    if (trimNext) text = text.replace(/^\s+/, '');
    if (m[1]) text = text.replace(/\s+$/, '');
    parts.push({ text }, { action: m[2] });
    trimNext = !!m[3];
    last = m.index! + m[0].length;
  }
  parts.push({ text: trimNext ? template.slice(last).replace(/^\s+/, '') : template.slice(last) });

  // Exécution : pile des « if » (branche active, branche déjà prise).
  const stack: { active: boolean; taken: boolean; outer: boolean }[] = [];
  const on = () => stack.every((s) => s.active);
  let out = '';
  for (const p of parts) {
    if ('text' in p) {
      if (on()) out += p.text;
      continue;
    }
    const a = p.action;
    if (a.startsWith('/*')) continue;
    let m: RegExpMatchArray | null;
    if ((m = a.match(/^if (.+)$/))) {
      const outer = on();
      const ok = outer && test(m[1]);
      stack.push({ active: ok, taken: ok, outer });
    } else if ((m = a.match(/^else if (.+)$/))) {
      const top = stack.at(-1)!;
      const ok = top.outer && !top.taken && test(m[1]);
      top.active = ok;
      top.taken ||= ok;
    } else if (a === 'else') {
      const top = stack.at(-1)!;
      top.active = top.outer && !top.taken;
      top.taken = true;
    } else if (a === 'end') {
      if (!stack.pop()) throw new Error('« end » sans « if »');
    } else if ((m = a.match(/^(\$\w+)\s*(:?=)\s*(.+)$/))) {
      if (m[2] === '=' && !vars.has(m[1])) throw new Error(`affectation de ${m[1]} avant sa déclaration`);
      if (on()) vars.set(m[1], value(m[3]));
    } else if (on()) out += value(a);
  }
  if (stack.length) throw new Error('« if » sans « end »');
  return out;
}

const body = readFileSync('supabase/emails/mot-de-passe-oublie.html', 'utf8');
const subject = readFileSync('supabase/emails/mot-de-passe-oublie.sujet.txt', 'utf8').trim();
const URL = 'https://exemple.supabase.co/auth/v1/verify?token=abc&type=recovery';
const mail = (lang?: string) => {
  const data = { ConfirmationURL: URL, Data: lang === undefined ? { pseudo: 'Moi' } : { pseudo: 'Moi', lang } };
  return { body: render(body, data), subject: render(subject, data) };
};
const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('e-mail « mot de passe oublié » (supabase/emails/)', () => {
  it('existe dans chaque langue de l’appli, avec son propre texte et le lien', () => {
    const texts = new Set<string>();
    const subjects = new Set<string>();
    for (const lang of LANGS) {
      const m = mail(lang);
      expect(m.body).toContain(`lang="${lang === 'pt' ? 'pt-BR' : lang}"`);
      expect(m.body.split(URL).length - 1).toBe(3); // bouton, lien de secours (adresse et texte)
      expect(m.subject).toMatch(/^Rank It All ?: \S/);
      expect(m.subject).not.toContain('\n');
      texts.add(visibleText(m.body).replace(URL, ''));
      subjects.add(m.subject);
    }
    expect(texts.size).toBe(LANGS.length);
    expect(subjects.size).toBe(LANGS.length);
  });

  it('textes attendus en français et en anglais', () => {
    expect(visibleText(mail('fr').body)).toContain('Choisir un nouveau mot de passe');
    expect(mail('fr').subject).toBe('Rank It All : nouveau mot de passe');
    expect(visibleText(mail('en').body)).toContain('Choose a new password');
    expect(mail('en').subject).toBe('Rank It All: new password');
  });

  it('sujet sur une ligne et dans la limite de Supabase (255 caractères, gabarit compris)', () => {
    // Refusé au-delà (« Failed to validate template: subject: Too big », 14/11/2026). Compté en octets : plus sûr.
    expect(subject).not.toContain('\n');
    expect(Buffer.byteLength(subject)).toBeLessThanOrEqual(255);
  });

  it('compte sans langue (d’avant le 14/11/2026) : français', () => {
    expect(mail(undefined)).toEqual(mail('fr'));
  });

  it('chaque langue redéfinit tous les textes (aucun texte resté en français)', () => {
    const declared = [...body.matchAll(/\{\{-? (\$\w+) :=/g)].map((m) => m[1]).filter((v) => v !== '$l');
    const branches = body.split(/\{\{-? (?:if|else if|end)\b/).slice(1, -1);
    expect(branches).toHaveLength(LANGS.length - 1);
    for (const branch of branches) for (const v of declared) expect(branch).toContain(`${v} = "`);
  });
});

describe('langue des e-mails enregistrée dans le compte', () => {
  // tests/setup.ts règle l'appareil en français.
  it('mise à jour seulement si le compte n’a pas la langue de l’appareil', () => {
    expect(emailLanguageOutdated({ lang: 'fr' })).toBe(false);
    expect(emailLanguageOutdated({ lang: 'en' })).toBe(true);
    expect(emailLanguageOutdated({ pseudo: 'Moi' })).toBe(true);
    expect(emailLanguageOutdated(undefined)).toBe(true);
  });
});
