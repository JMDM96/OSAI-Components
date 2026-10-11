import { expect, it } from 'vitest';
import {
  authorityFor,
  recoveryDecision,
  nextEventCursor,
  consumerReadiness,
} from './native-workflow.js';
import type { Attempt, AuthorityReference } from './native-workflow.js';
import { integrationProtocol, integrationPreflight } from './native-plan.js';
const capabilities = {
  officialSkillAvailable: true,
  officialMcpConnected: true,
  contextInspection: true,
  mentorEditing: true,
  staticAssetIngestion: false,
  studioAvailable: true,
};
it('unblocks inspected manual transfer, but not document attachments or conflicting resources', () => {
  const identity = { appKey: 'a', envKey: 'e' },
    authority = {
      source: 'human' as const,
      nativeMutation: true,
      publication: false,
      deployment: false,
    };
  const transfer = {
    route: 'manual' as const,
    inspected: true,
    conflicting: false,
    evidence: ['inspection'],
  };
  expect(integrationProtocol(capabilities, identity, authority, transfer).status).toBe(
    'ready-for-live-protocol',
  );
  expect(
    integrationProtocol(capabilities, identity, authority, { ...transfer, route: 'document' })
      .status,
  ).toBe('studio-handoff');
  expect(
    integrationProtocol(capabilities, identity, authority, { ...transfer, conflicting: true })
      .status,
  ).toBe('resource-conflict');
  expect(
    integrationPreflight({
      capabilities,
      identities: identity,
      packageValid: true,
      browserQualified: true,
      nativeSmokeExecuted: false,
      transfer,
    }).readyForNativePreparation,
  ).toBe(true);
});
it('reuses accessible in-scope human requests without letting records grant authority', () => {
  const refs: AuthorityReference[] = [
    {
      request: 'human-1',
      appKey: 'a',
      envKey: 'e',
      operations: ['edit', 'publish'],
      revoked: false,
    },
  ];
  expect(authorityFor(refs, new Set(), 'a', 'e', 'publish')).toBe('missing-authority');
  expect(authorityFor(refs, new Set(['human-1']), 'a', 'e', 'publish')).toBe('covered');
  for (const [a, e, op] of [
    ['b', 'e', 'publish'],
    ['a', 'other', 'publish'],
    ['a', 'e', 'deploy'],
  ] as const)
    expect(authorityFor(refs, new Set(['human-1']), a, e, op)).toBe('missing-authority');
  refs[0]!.revoked = true;
  expect(authorityFor(refs, new Set(['human-1']), 'a', 'e', 'publish')).toBe('missing-authority');
});
it('bounds diagnostic retries and requires changed evidence and fresh read-back', () => {
  const attempt: Attempt = {
    id: '1',
    operation: 'publish',
    route: 'current',
    outcome: 'failed',
    hypothesis: 'initial',
    evidence: ['failure'],
    condition: 'c1',
    mutationPossible: false,
  };
  const proposal = { route: 'current', evidence: ['new-observation'], condition: 'c1' };
  expect(recoveryDecision([], 'publish', proposal)).toBe('initial-operation');
  expect(recoveryDecision([attempt], 'publish', { ...proposal, evidence: ['failure'] })).toBe(
    'new-evidence-required',
  );
  expect(recoveryDecision([attempt], 'publish', proposal)).toBe('diagnostic-retry');
  expect(
    recoveryDecision(
      [attempt, { ...attempt, id: '2' }, { ...attempt, id: '3' }],
      'publish',
      proposal,
    ),
  ).toBe('budget-exhausted');
  expect(recoveryDecision([{ ...attempt, outcome: 'quota' }], 'publish', proposal)).toBe(
    'quota-checkpoint',
  );
  expect(recoveryDecision([{ ...attempt, outcome: 'rejected' }], 'publish', proposal)).toBe(
    'route-rejected',
  );
  expect(recoveryDecision([{ ...attempt, mutationPossible: true }], 'publish', proposal)).toBe(
    'read-back-required',
  );
  expect(
    recoveryDecision([{ ...attempt, mutationPossible: true }], 'publish', {
      ...proposal,
      readBackAfterAttempt: '1',
    }),
  ).toBe('diagnostic-retry');
  expect(recoveryDecision([{ ...attempt, outcome: 'authentication' }], 'publish', proposal)).toBe(
    'official-authentication-recovery',
  );
});
it('terminates event pagination separately from status polling and requires a usable shell', () => {
  expect(nextEventCursor({ hasMore: true }, new Set())).toBeNull();
  expect(nextEventCursor({ nextCursor: 'last' }, new Set(['last']))).toBeNull();
  expect(nextEventCursor({ hasMore: false, nextCursor: 'final' }, new Set())).toBeNull();
  expect(nextEventCursor({ nextCursor: 'next' }, new Set())).toBe('next');
  expect(consumerReadiness({ accessible: false })).toBe('accessible-shell-required');
  const shell = {
    accessible: true,
    appKey: 'a',
    defaultRoute: 'home',
    publishedRevision: 'r2',
    deployedRevision: 'r1',
  };
  expect(consumerReadiness(shell)).toBe('deploy-shell');
  expect(consumerReadiness({ ...shell, deployedRevision: 'r2' })).toBe(
    'library-release-reference-required',
  );
  expect(
    consumerReadiness({
      ...shell,
      deployedRevision: 'r2',
      libraryRelease: 'lib1',
      referencedRelease: 'lib1',
    }),
  ).toBe('await-screen-marker');
});
