import { readFile, mkdtemp, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { componentManifest } from '@osai/command-palette';
import { breakingChanges, checkRegistration, checksum, registerRelease } from './release.js';
import type { CatalogEntry } from './release.js';

function entry(id = componentManifest.componentId, version = '1.0.0'): CatalogEntry {
  const manifest = structuredClone(componentManifest);
  manifest.componentId = id;
  manifest.version = version;
  return { componentId: id, version, manifest, payloadDigest: checksum(`${id}@${version}`) };
}

describe('contract compatibility and immutable catalog', () => {
  it('requires manifest/catalog identity and exact digest consistency', () => {
    const candidate = entry();
    expect(() => checkRegistration([], { ...candidate, version: '2.0.0' })).toThrow('must match');
    expect(() => checkRegistration([], { ...candidate, payloadDigest: 'not-a-digest' })).toThrow(
      'SHA-256',
    );
    expect(() =>
      checkRegistration([candidate], { ...candidate, payloadDigest: checksum('changed') }),
    ).toThrow('immutable');
  });

  it('classifies changed defaults and newly required browser permissions as breaking', () => {
    const previous = entry();
    const next = entry(componentManifest.componentId, '1.1.0');
    next.manifest.properties.title!.default = 'Changed behavior';
    next.manifest.capabilities.browserApis.push('ResizeObserver');
    expect(breakingChanges(previous.manifest, next.manifest)).toEqual(
      expect.arrayContaining(['/properties/title', '/capabilities/browserApis']),
    );
    expect(() => checkRegistration([previous], next)).toThrow('major');
    next.version = '2.0.0';
    next.manifest.version = '2.0.0';
    expect(checkRegistration([previous], next)).toBe('new');
  });

  it('requires a minor increase for additive APIs but permits implementation-only patches', () => {
    const previous = entry();
    const next = entry(componentManifest.componentId, '1.0.1');
    expect(checkRegistration([previous], next)).toBe('new');
    next.manifest.events.additional = { schema: { type: 'string' } };
    expect(() => checkRegistration([previous], next)).toThrow('minor');
    next.version = '1.1.0';
    next.manifest.version = '1.1.0';
    expect(checkRegistration([previous], next)).toBe('new');
  });

  it('serializes concurrent distinct registrations without lost updates', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'osai-concurrent-catalog-'));
    const path = join(directory, 'catalog.json');
    const candidates = Array.from({ length: 8 }, (_, index) => entry(`component-${index}`));
    await Promise.all(candidates.map((candidate) => registerRelease(path, candidate)));
    const actual = JSON.parse(await readFile(path, 'utf8')) as CatalogEntry[];
    expect(actual.map((value) => value.componentId).sort()).toEqual(
      candidates.map((value) => value.componentId).sort(),
    );
    expect(await readdir(directory)).toEqual(['catalog.json']);
  });

  it('one conflicting concurrent writer wins and exact concurrent retries remain idempotent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'osai-conflicting-catalog-'));
    const path = join(directory, 'catalog.json');
    const candidate = entry();
    const outcomes = await Promise.allSettled([
      registerRelease(path, candidate),
      registerRelease(path, { ...candidate, payloadDigest: checksum('other') }),
    ]);
    expect(outcomes.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    const recorded = JSON.parse(await readFile(path, 'utf8')) as CatalogEntry[];
    await Promise.all([registerRelease(path, recorded[0]!), registerRelease(path, recorded[0]!)]);
    expect(JSON.parse(await readFile(path, 'utf8'))).toHaveLength(1);
    expect(await readdir(directory)).toEqual(['catalog.json']);
  });
});
