export const unitStatFields = [
  { key: 'apl', label: 'APL', min: 0, suffix: '' },
  { key: 'move', label: 'Move', min: 0, suffix: '″' },
  { key: 'save', label: 'Save', min: 1, suffix: '+' },
  { key: 'wounds', label: 'Wounds', min: 1, suffix: '' },
];

export const unitRuleLimits = { name: 100, text: 4000 };

export function getActionEffects(action) {
  if (Array.isArray(action?.effects)) {
    return action.effects.filter(effect => typeof effect === 'string' && effect.trim());
  }
  return typeof action?.description === 'string' && action.description.trim() ? [action.description] : [];
}

const trimText = value => typeof value === 'string' ? value.trim() : '';
const validRuleText = value => value.length > 0 && value.length <= unitRuleLimits.text;

export function validateUnitRule(input, isAction) {
  const name = trimText(input?.name);
  if (!name || name.length > unitRuleLimits.name) {
    return { error: `Enter a name from 1 to ${unitRuleLimits.name} characters.` };
  }
  if (!isAction) {
    const description = trimText(input.description);
    return validRuleText(description)
      ? { profile: { name, description } }
      : { error: `Enter an ability description from 1 to ${unitRuleLimits.text} characters.` };
  }

  const rawEffects = Object.hasOwn(input, 'effects') ? input.effects : [input.description];
  const effects = Array.isArray(rawEffects) ? rawEffects.map(trimText) : [];
  if (!effects.length || !effects.every(validRuleText)) {
    return { error: `Add at least one effect. Each effect must contain 1 to ${unitRuleLimits.text} characters.` };
  }
  const { ap } = input;
  const restriction = trimText(input.restriction);
  if (!Number.isSafeInteger(ap) || ap < 0) return { error: 'Enter a whole-number AP cost of at least 0.' };
  if ((input.restriction != null && typeof input.restriction !== 'string') || restriction.length > unitRuleLimits.text) {
    return { error: `Enter the restriction as text up to ${unitRuleLimits.text} characters.` };
  }
  return { profile: { name, description: effects.join('\n\n'), effects, ap, restriction } };
}

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

const weaponRank = weapon => weapon.type === 'ranged' ? 0 : weapon.type === 'melee' ? 1 : 2;

export function orderedUnitEntries(collection, entries = []) {
  return collection === 'weapons'
    ? [...entries].sort((left, right) => weaponRank(left) - weaponRank(right))
    : entries;
}

export function unitMoveTarget(collection, entries, index, direction) {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= entries.length) return -1;
  if (collection === 'weapons' && weaponRank(entries[index]) !== weaponRank(entries[target])) return -1;
  return target;
}

export const unitImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const maxUnitImageFileBytes = 20 * 1024 * 1024;
const maxSavedImageBytes = 150 * 1024;
const imageData = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function validUnitImage(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(maxSavedImageBytes / 3) * 4 + 32) return false;
  const [, type, encoded] = imageData.exec(value) ?? [];
  if (!encoded || encoded.length % 4 !== 0) return false;
  try {
    const bytes = atob(encoded);
    if (bytes.length > maxSavedImageBytes) return false;
    if (type === 'image/png') return bytes.startsWith('\x89PNG\r\n\x1a\n');
    if (type === 'image/jpeg') return bytes.startsWith('\xff\xd8\xff');
    return bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  } catch {
    return false;
  }
}

export async function prepareUnitImage(file) {
  if (!unitImageTypes.includes(file?.type) || !file.size) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > maxUnitImageFileBytes) throw new Error('Choose an image no larger than 20 MB.');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Unable to read this image. Choose another PNG, JPEG, or WebP file.');
  }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    const longestSide = Math.max(bitmap.width, bitmap.height);
    for (const target of [1024, 768, 512, 384, 256]) {
      const scale = Math.min(1, target / longestSide);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/webp', 0.8);
      if (validUnitImage(image)) return image;
    }
    throw new Error('Unable to resize the image for preview storage. Try a smaller file.');
  } finally {
    bitmap.close();
  }
}
