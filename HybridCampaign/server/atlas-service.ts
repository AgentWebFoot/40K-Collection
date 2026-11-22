import type { PlayerAtlasProjection } from '../src/features/atlas/atlas-types';
import { atlasCampaignDate, atlasLocations, atlasUrgentSignals } from './atlas-seeds';

/** Builds the sole player-facing campaign data projection. */
export const createPlayerAtlasProjection = (playerName: string): PlayerAtlasProjection => ({
  campaignDate: atlasCampaignDate,
  playerName,
  // A location is intentionally null until a future player-safe travel or
  // operation projection explicitly publishes a current assignment.
  partyLocationId: null,
  locations: atlasLocations.map(location => ({ ...location, mapPosition: { ...location.mapPosition }, consequences: [...location.consequences] })),
  urgentSignals: atlasUrgentSignals.map(signal => ({ ...signal })),
});
