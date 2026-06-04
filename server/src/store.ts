import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { agentDir } from "./config.js";

const DB_PATH = join(agentDir, "pi-web-store.json");

export interface WorkspaceRecord {
  path: string;
  name: string;
  addedAt: string;
}

export interface SessionRecord {
  key: string; // workspacePath::sessionId
  workspacePath: string;
  sessionId: string;
  title: string;
  model?: { provider: string; modelId: string } | null;
  thinking?: string | null;
  openedAt: string;
  lastActiveAt: string;
}

interface StoreData {
  version: number;
  workspaces: WorkspaceRecord[];
  sessions: SessionRecord[];
}

const DEFAULT: StoreData = { version: 1, workspaces: [], sessions: [] };

function read(): StoreData {
  try {
    if (!existsSync(DB_PATH)) return { ...DEFAULT };
    return JSON.parse(readFileSync(DB_PATH, "utf-8"));
  } catch {
    return { ...DEFAULT };
  }
}

function write(data: StoreData): void {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// ── Workspaces ────────────────────────────────────────────

export function listWorkspaces(): WorkspaceRecord[] {
  return read().workspaces;
}

export function addWorkspace(path: string, name: string): WorkspaceRecord {
  const data = read();
  const existing = data.workspaces.findIndex(w => w.path === path);
  const record: WorkspaceRecord = { path, name, addedAt: new Date().toISOString() };
  if (existing >= 0) {
    data.workspaces[existing] = record;
  } else {
    data.workspaces.unshift(record);
  }
  write(data);
  return record;
}

export function removeWorkspace(path: string): void {
  const data = read();
  data.workspaces = data.workspaces.filter(w => w.path !== path);
  write(data);
}

// ── Sessions ──────────────────────────────────────────────

export function listSessions(): SessionRecord[] {
  return read().sessions;
}

export function upsertSession(record: SessionRecord): void {
  const data = read();
  const idx = data.sessions.findIndex(s => s.key === record.key);
  if (idx >= 0) {
    data.sessions[idx] = { ...data.sessions[idx], ...record, lastActiveAt: new Date().toISOString() };
  } else {
    data.sessions.push({ ...record, lastActiveAt: new Date().toISOString() });
  }
  write(data);
}

export function removeSession(key: string): void {
  const data = read();
  data.sessions = data.sessions.filter(s => s.key !== key);
  write(data);
}

export function getSession(key: string): SessionRecord | undefined {
  return read().sessions.find(s => s.key === key);
}
