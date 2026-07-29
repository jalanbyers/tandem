/**
 * Minimal retrieval over data/docs/*.md with structured citations.
 * Returns {docId, title, snippet, score} passages; the UI renders the
 * docId/title as tappable 📎 chips and the server uses snippets to ground
 * numeric claims (faithfulness check).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'docs');

function loadCorpus() {
  const chunks = [];
  for (const file of readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'))) {
    const docId = basename(file, '.md');
    const text = readFileSync(join(DOCS_DIR, file), 'utf8');
    const title = (text.match(/^#\s+(.+)$/m) || [, docId])[1];
    // paragraph-level chunks (tables kept whole)
    for (const para of text.split(/\n\n+/)) {
      const clean = para.trim();
      if (clean && !clean.startsWith('#')) chunks.push({ docId, title, text: clean });
    }
  }
  return chunks;
}

const CORPUS = loadCorpus();

const tokenize = s => (s.toLowerCase().match(/[a-z0-9$%.]+/g) || []).filter(w => w.length > 2);

/** Keyword-overlap retrieval. Good enough for a 4-doc corpus; swap for embeddings at scale. */
export function retrieve(query, k = 4) {
  const qTokens = new Set(tokenize(query));
  return CORPUS
    .map(c => {
      const tTokens = tokenize(c.text);
      const overlap = tTokens.filter(t => qTokens.has(t)).length;
      return { docId: c.docId, title: c.title, snippet: c.text, score: overlap / Math.sqrt(tTokens.length + 1) };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function listDocs() {
  return [...new Set(CORPUS.map(c => c.docId))];
}

export function getDoc(docId) {
  return CORPUS.filter(c => c.docId === docId);
}
