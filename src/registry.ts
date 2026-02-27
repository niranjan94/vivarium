import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from './utils/logger.js';
import { computePorts, isPortInUse } from './ports.js';
import type { PortMap } from './ports.js';

const REGISTRY_DIR = path.join(os.homedir(), '.local', 'share', 'vivarium');
const MAX_INDEX = 100;

/** Persisted state for a vivarium-managed project. */
export interface VivariumState {
  index: number;
  projectName: string;
  composeName: string;
  projectRoot: string;
  ports: Record<string, number>;
}

/** Get the registry directory for a project (e.g. ~/.local/share/vivarium/vulneron/). */
export function projectDir(projectName: string): string {
  return path.join(REGISTRY_DIR, projectName);
}

/** Read state.json for a project, or null if it doesn't exist. */
export function readState(projectName: string): VivariumState | null {
  const statePath = path.join(projectDir(projectName), 'state.json');
  if (!fs.existsSync(statePath)) return null;
  return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

/** Write state.json for a project, creating the directory if needed. */
export function writeState(state: VivariumState) {
  const dir = projectDir(state.projectName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2));
}

/** Remove a project's entire registry directory. */
export function removeProject(projectName: string) {
  const dir = projectDir(projectName);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

/** Scan all project directories and return their states. */
export function listClaimed(): VivariumState[] {
  if (!fs.existsSync(REGISTRY_DIR)) return [];

  const entries = fs.readdirSync(REGISTRY_DIR, { withFileTypes: true });
  const states: VivariumState[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const statePath = path.join(REGISTRY_DIR, entry.name, 'state.json');
    if (!fs.existsSync(statePath)) continue;
    try {
      states.push(JSON.parse(fs.readFileSync(statePath, 'utf-8')));
    } catch {
      // Corrupted state file — skip it
    }
  }

  return states;
}

/** Check if a project already has a claim (state.json exists). */
export function findExistingClaim(projectName: string): VivariumState | null {
  return readState(projectName);
}

/**
 * Check whether any of the candidate ports collide with ports
 * already claimed by other projects.
 */
function hasPortCollision(candidatePorts: PortMap, claimedStates: VivariumState[]): boolean {
  const candidateValues = new Set(Object.values(candidatePorts));
  for (const state of claimedStates) {
    for (const port of Object.values(state.ports)) {
      if (candidateValues.has(port)) return true;
    }
  }
  return false;
}

/**
 * Auto-assign the lowest available index.
 * An index is available if: no other project claims it, its ports don't collide
 * with any claimed project's ports, and the postgres port is not in use.
 */
export function autoAssignIndex(projectName: string): number {
  // Check if already claimed
  const existing = findExistingClaim(projectName);
  if (existing) {
    log.dim(`Reusing existing claim: index ${existing.index}`);
    return existing.index;
  }

  const claimed = listClaimed();
  const takenIndices = new Set(claimed.map((s) => s.index));

  // Find lowest free index
  for (let i = 0; i < MAX_INDEX; i++) {
    if (takenIndices.has(i)) continue;

    const ports = computePorts(i);

    // Runtime collision safety net: ensure no port overlaps with existing claims
    if (hasPortCollision(ports, claimed)) {
      log.dim(`Index ${i} has port collisions with another project, skipping`);
      continue;
    }

    if (isPortInUse(ports.postgres)) {
      log.dim(`Index ${i} has no claim but postgres port ${ports.postgres} is in use, skipping`);
      continue;
    }

    log.step(`Claimed index ${i}`);
    return i;
  }

  log.error(`No available index (0–${MAX_INDEX - 1}). Free up a slot or teardown another project.`);
  process.exit(1);
}
