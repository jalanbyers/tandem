/**
 * Session + persistent memory implementing shared/memory.js.
 * JSON file storage (gitignored). Consent rules enforced here, not just in
 * the prompt: derived/behavioral memories are stored as pending-consent and
 * are NOT surfaced to the agent until granted. Deletes are immediate and
 * audit-logged.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMORY_TYPES } from '../../shared/memory.js';

// DC_MEMORY_STORE lets the eval runner point at a throwaway store
const STORE_PATH = process.env.DC_MEMORY_STORE
  || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'memory-store.json');

function load() {
  if (!existsSync(STORE_PATH)) return { memories: [], auditLog: [], nextId: 1 };
  try { return JSON.parse(readFileSync(STORE_PATH, 'utf8')); }
  catch { return { memories: [], auditLog: [], nextId: 1 }; }
}

function save(db) {
  writeFileSync(STORE_PATH, JSON.stringify(db, null, 2));
}

function audit(db, op, detail) {
  db.auditLog.push({ op, detail, at: new Date().toISOString() });
}

export function listMemories() {
  return load().memories;
}

/** Memories the agent may rely on: active only — pending-consent is excluded. */
export function usableMemories() {
  return load().memories.filter(m => m.status === 'active');
}

/**
 * Write a memory. Enforces shared/memory.js consent rules:
 * types with consentRequired start as 'pending-consent'.
 * Returns the stored record (including whether consent is needed).
 */
export function addMemory(type, text) {
  const spec = MEMORY_TYPES[type];
  if (!spec) throw new Error(`unknown memory type: ${type}`);
  const db = load();
  const mem = {
    id: db.nextId++,
    type,
    text,
    decay: spec.decayLabel,
    status: spec.consentRequired ? 'pending-consent' : 'active',
    at: new Date().toISOString(),
  };
  db.memories.push(mem);
  audit(db, 'write', { id: mem.id, type, status: mem.status });
  save(db);
  return mem;
}

export function editMemory(id, text) {
  const db = load();
  const m = db.memories.find(x => x.id === id);
  if (!m) return null;
  m.text = text;
  audit(db, 'edit', { id });
  save(db);
  return m;
}

/** Immediate hard delete + audit entry — per shared/memory.js MEMORY_RULES.userControl. */
export function deleteMemory(id) {
  const db = load();
  const idx = db.memories.findIndex(x => x.id === id);
  if (idx === -1) return false;
  audit(db, 'delete', { id, type: db.memories[idx].type });
  db.memories.splice(idx, 1);
  save(db);
  return true;
}

export function consentMemory(id, grant) {
  const db = load();
  const m = db.memories.find(x => x.id === id);
  if (!m) return null;
  if (grant) { m.status = 'active'; audit(db, 'consent-grant', { id }); }
  else {
    audit(db, 'consent-decline', { id });
    db.memories.splice(db.memories.indexOf(m), 1); // declined inference is not kept
  }
  save(db);
  return grant ? m : null;
}

export function auditLog() {
  return load().auditLog;
}
