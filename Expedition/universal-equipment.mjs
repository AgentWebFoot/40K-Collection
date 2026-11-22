export const universalEquipment = [
  'Ammo Cache',
  'Portable Barricade',
  'Razor Wire',
  'Comms Device',
  'Mines',
  'Light Barricade',
  'Utility Grenades',
  'Heavy Barricade',
  'Ladders',
  'Explosive Grenades',
  'Breaching Charge',
].map(name => ({
  id: name.toLowerCase().replaceAll(' ', '-'),
  name,
  description: '',
}));
