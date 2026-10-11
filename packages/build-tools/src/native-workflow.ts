export interface AuthorityReference {
  request: string;
  appKey: string;
  envKey: string;
  operations: ('edit' | 'publish' | 'deploy')[];
  revoked: boolean;
}
/** trustedRequests is supplied by the live caller after reading accessible human requests. A record cannot fill it in. */
export function authorityFor(
  refs: AuthorityReference[],
  trustedRequests: ReadonlySet<string>,
  appKey: string,
  envKey: string,
  operation: 'edit' | 'publish' | 'deploy',
) {
  return refs.some(
    (ref) =>
      trustedRequests.has(ref.request) &&
      !ref.revoked &&
      ref.appKey === appKey &&
      ref.envKey === envKey &&
      ref.operations.includes(operation),
  )
    ? 'covered'
    : 'missing-authority';
}
export interface Attempt {
  id: string;
  operation: string;
  route: string;
  outcome: 'success' | 'failed' | 'quota' | 'authentication' | 'rejected';
  hypothesis: string;
  evidence: string[];
  condition: string;
  mutationPossible: boolean;
}
export function recoveryDecision(
  attempts: Attempt[],
  operation: string,
  proposal: { route: string; evidence: string[]; condition: string; readBackAfterAttempt?: string },
) {
  const history = attempts.filter((a) => a.operation === operation),
    last = history.at(-1);
  const inspected = proposal.readBackAfterAttempt
    ? history.findIndex((a) => a.id === proposal.readBackAfterAttempt)
    : -1;
  if (history.some((a, i) => a.mutationPossible && i > inspected)) return 'read-back-required';
  if (last?.outcome === 'authentication') return 'official-authentication-recovery';
  if (history.length >= 3) return 'budget-exhausted';
  if (last?.outcome === 'quota' && last.condition === proposal.condition) return 'quota-checkpoint';
  if (
    history.some(
      (a) =>
        a.route === proposal.route &&
        a.outcome === 'rejected' &&
        a.condition === proposal.condition,
    )
  )
    return 'route-rejected';
  if (
    history.length &&
    !proposal.evidence.some((e) => !history.some((a) => a.evidence.includes(e)))
  )
    return 'new-evidence-required';
  return history.length ? 'diagnostic-retry' : 'initial-operation';
}
export function nextEventCursor(
  page: { hasMore?: boolean; nextCursor?: string | null },
  used: ReadonlySet<string>,
) {
  return page.hasMore === false || !page.nextCursor?.trim() || used.has(page.nextCursor)
    ? null
    : page.nextCursor;
}
export interface ShellObservation {
  accessible: boolean;
  appKey?: string;
  defaultRoute?: string;
  publishedRevision?: string;
  deployedRevision?: string;
  libraryRelease?: string;
  referencedRelease?: string;
  expectedRevision?: string;
  screenMarker?: boolean;
}
export function consumerReadiness(shell: ShellObservation) {
  if (!shell.accessible || !shell.appKey) return 'accessible-shell-required';
  if (!shell.defaultRoute || !shell.publishedRevision) return 'publish-minimal-shell';
  if (shell.deployedRevision !== shell.publishedRevision) return 'deploy-shell';
  if (!shell.libraryRelease || shell.referencedRelease !== shell.libraryRelease)
    return 'library-release-reference-required';
  if (shell.expectedRevision && shell.deployedRevision !== shell.expectedRevision)
    return 'await-expected-deployment';
  return shell.screenMarker ? 'ready' : 'await-screen-marker';
}
