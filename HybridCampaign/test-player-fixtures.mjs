/**
 * Deliberately obvious local-preview identities. These are never part of a
 * campaign export or a hosted account system; they only make player routes
 * and faction-specific workflows easy to review while developing locally.
 */
export const campaignTestPlayers = Object.freeze([
  { id: 'test-adeptus-astartes', accountName: '[Test] Astartes Player', characterName: 'Test Astartes', recipientId: 'adeptus-astartes', supportingFactionName: 'Test Astartes Cohort' },
  { id: 'test-adeptus-mechanicus', accountName: '[Test] Mechanicus Player', characterName: 'Test Mechanicus', recipientId: 'adeptus-mechanicus', supportingFactionName: 'Test Mechanicus Cohort' },
  { id: 'test-agents-imperium', accountName: '[Test] Imperium Agent', characterName: 'Test Imperium Agent', recipientId: 'agents-imperium', supportingFactionName: 'Test Inquisitorial Cell' },
  { id: 'test-astra-militarum', accountName: '[Test] Astra Player', characterName: 'Test Astra', recipientId: 'astra-militarum', supportingFactionName: 'Test Tavrellis Regiment' },
  { id: 'test-grey-knights', accountName: '[Test] Grey Knight', characterName: 'Test Grey Knight', recipientId: 'grey-knights', supportingFactionName: 'Test Grey Knights Strike Force' },
]);
