export const weaponTypes = { ranged: 'Ranged', melee: 'Melee' };
export const weaponLimits = { name: 100, dmg: 40, wr: 300 };

export function validateWeaponProfile(input) {
  const { type, atk, hit } = input ?? {};
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const dmg = typeof input?.dmg === 'string' ? input.dmg.trim() : '';
  const wr = typeof input?.wr === 'string' ? input.wr.trim() : '';

  if (typeof type !== 'string' || !Object.hasOwn(weaponTypes, type)) return { error: 'Select Ranged or Melee.' };
  if (!name || name.length > weaponLimits.name) return { error: 'Enter a weapon name from 1 to 100 characters.' };
  if (!Number.isSafeInteger(atk) || atk < 0) return { error: 'Enter a whole-number ATK value of at least 0.' };
  if (!Number.isSafeInteger(hit) || hit < 1) return { error: 'Enter a whole-number HIT value of at least 1.' };
  if (dmg.length > weaponLimits.dmg || !/^\d+(?:\s*\/\s*\d+)?$/.test(dmg)) {
    return { error: 'Enter damage as a whole number or a pair such as 3/4.' };
  }
  const damageValues = dmg.split('/').map(Number);
  if (!damageValues.every(Number.isSafeInteger)) return { error: 'Enter smaller damage values.' };
  if ((input.wr != null && typeof input.wr !== 'string') || wr.length > weaponLimits.wr) {
    return { error: 'Enter Weapon Rules as text up to 300 characters.' };
  }
  return { profile: { type, name, atk, hit, dmg: damageValues.join('/'), wr } };
}
