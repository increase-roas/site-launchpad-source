/**
 * Capabilities that are built and designed but switched off for this phase.
 *
 * Campaign building is one of them. Everything that shows a campaign, counts
 * campaign work, or routes into one reads this flag rather than deciding for
 * itself, so a client is never held open by a step nobody is allowed to finish.
 *
 * Typed as `boolean` on purpose: the surfaces below branch both ways, and a
 * literal type would narrow the enabled path away.
 */
export const CAMPAIGNS_DEFERRED: boolean = true;
