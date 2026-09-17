export type AtlasLocation = {
  id: string;
  title: string;
  mapLabel: string;
  mapPosition: { x: number; y: number };
  detailStatus: 'dossier' | 'map-only';
  publicDescription: string;
  authorityAccess: string;
  consequences: string[];
};

export type AtlasSignal = {
  id: string;
  title: string;
  detail: string;
  severity: 'notice' | 'warning' | 'critical';
};

/** The entire browser contract for the read-only player command deck. */
export type PlayerAtlasProjection = {
  campaignDate: string;
  playerName: string;
  partyLocationId: string | null;
  locations: AtlasLocation[];
  urgentSignals: AtlasSignal[];
};
