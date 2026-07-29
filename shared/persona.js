/**
 * Loader for persona.md copy blocks. persona.md is the source of truth;
 * this module only knows how to extract its `<!-- copy:NAME -->` blocks.
 * Browser consumers fetch the markdown; Node consumers read it from disk —
 * both pass the raw text to parsePersona().
 */

export function parsePersona(mdText) {
  const blocks = {};
  const re = /<!--\s*copy:([\w-]+)\s*-->([\s\S]*?)<!--\s*\/copy\s*-->/g;
  let m;
  while ((m = re.exec(mdText)) !== null) {
    blocks[m[1]] = m[2].trim().replace(/\n/g, ' ');
  }
  return blocks;
}

/** Browser helper: fetch + parse relative to the site root. */
export async function loadPersona(url = '/shared/persona.md') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`persona.md fetch failed: ${res.status}`);
  return parsePersona(await res.text());
}
