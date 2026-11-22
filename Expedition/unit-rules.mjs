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
