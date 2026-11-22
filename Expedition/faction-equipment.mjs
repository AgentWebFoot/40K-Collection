export const factionEquipmentSlotCount = 4;
export const factionEquipmentLimits = { name: 100, description: 4000 };

export function factionEquipmentSlots(entries) {
  return Array.from({ length: factionEquipmentSlotCount }, (_, index) => entries?.[index] ?? null);
}
