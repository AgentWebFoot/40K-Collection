function formatGroupTitle(title) {
  return title;
}

function uniqueSortedValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function getWeaponDamageScore(weapon) {
  const dice = String(weapon?.damage?.dice || "");
  const match = dice.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return 0;
  return Number(match[1]) * (Number(match[2]) + 1) / 2 + Number(match[3] || 0);
}
function getPropertyFilterLabel(property) {
  const value = String(property || "");
  if (value.startsWith("Versatile")) return "Versatile";
  if (value.startsWith("Range")) return "Range";
  if (value.startsWith("Explosive")) return "Explosive";
  if (value.startsWith("Radius")) return "Radius";
  if (value.startsWith("Reach")) return "Reach";
  return value;
}

function getAbilityMeta(ability) {
  return [
    "actionCost" in ability ? `Action ${ability.actionCost}` : null,
    "enduranceCost" in ability ? `Endurance ${ability.enduranceCost}` : null,
    ability.type ? ability.type : null
  ].filter(Boolean).join(" | ");
}
function normalizeCompendiumImageUrl(sourceText) {
  const trimmedSource = String(sourceText || "").trim();
  const fileName = trimmedSource.startsWith(COMPENDIUM_IMAGE_URL_PREFIX) ? decodeURIComponent(trimmedSource.slice(COMPENDIUM_IMAGE_URL_PREFIX.length)) : decodeURIComponent(trimmedSource);
  if (!fileName || /[\/?#]/.test(fileName)) {
    return "";
  }
  if (!/^[a-z0-9][a-z0-9-]{0,79}\.(png|jpg|webp)$/i.test(fileName)) {
    return "";
  }
  return `${COMPENDIUM_IMAGE_URL_PREFIX}${fileName.toLowerCase()}`;
}
function isSelectionAbility(ability) {
  return ability?.type === "Selection";
}
function isSelectionCategory(ability) {
  return ability?.type === "Selection-category";
}

const PAGE_PARAMS = new URLSearchParams(window.location.search);
const COMPENDIUM_NAV_STATE_KEY = "pyrrhicWarCompendiumNavState";
const COMPENDIUM_FAVORITES_STORAGE_PREFIX = "pyrrhicWarCompendiumFavorites";
const CUSTOM_SECTION_PREFIX = "custom:";
const FAVORITES_SECTION_KEY = "favorites";
const LORE_IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const LORE_IMAGE_UPLOAD_TARGET_BYTES = 900 * 1024;
const LORE_IMAGE_UPLOAD_MAX_DIMENSION = 1600;
const COMPENDIUM_IMAGE_URL_PREFIX = "/games/PyrrhicWar/compendium/images/";
const REORDER_HOLD_DELAY_MS = 350;
const REORDER_TARGET_PADDING_PX = 18;
const BUILT_IN_TAB_ORDER = ["lore", "grid"];
const FAVORITE_BLOCK_TYPE_LABELS = {
  paragraph: "Paragraph",
  heading: "Heading",
  table: "Table",
  image: "Image",
  "class-ability": "Ability",
  grid: "Grid"
};
const BUILT_IN_TAB_DEFAULTS = {
  lore: {
    label: "Lore",
    visible: true
  },
  grid: {
    label: "Grid",
    visible: true
  }
};
const CLASS_PAGE_DEFAULTS = {
  groupLabels: {},
  classLabels: {}
};
const CLASS_PAGE_STRUCTURE_DEFAULTS = {
  groups: []
};
const EQUIPMENT_PAGE_DEFAULTS = {
  sectionLabels: {
    weapons: "Weapons",
    armorShields: "Armor / Shields",
    equipmentProperties: "Equipment Properties"
  },
  subsectionLabels: {
    armor: "Armor",
    shields: "Shields"
  }
};
function getCustomSectionKey(title) {
  return `${CUSTOM_SECTION_PREFIX}${title}`;
}
function isCustomSectionKey(value) {
  return typeof value === "string" && value.startsWith(CUSTOM_SECTION_PREFIX);
}
function getCustomSectionTitleFromKey(value) {
  return isCustomSectionKey(value) ? value.slice(CUSTOM_SECTION_PREFIX.length) : "";
}
function normalizeCustomSectionType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "grid" || normalized === "conditions") return "grid";
  return "lore";
}
function normalizeCompendiumAccentColor(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : "";
}
function adjustHexColor(color, amount) {
  const normalized = normalizeCompendiumAccentColor(color);
  if (!normalized) return "";
  const channelValues = [1, 3, 5].map(index => {
    const value = parseInt(normalized.slice(index, index + 2), 16);
    return Math.max(0, Math.min(255, value + amount));
  });
  return `#${channelValues.map(value => value.toString(16).padStart(2, "0")).join("")}`;
}
function getCompendiumButtonTextColor(color) {
  const normalized = normalizeCompendiumAccentColor(color);
  if (!normalized) return "";
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness >= 150 ? "#241312" : "#f9e6de";
}
function getCompendiumAccentButtonStyle(color, isActive = false) {
  const normalized = normalizeCompendiumAccentColor(color);
  if (!normalized) return null;
  const backgroundColor = isActive ? adjustHexColor(normalized, 28) : adjustHexColor(normalized, -8);
  return {
    background: backgroundColor,
    borderColor: adjustHexColor(normalized, -36),
    color: getCompendiumButtonTextColor(backgroundColor),
    boxShadow: isActive ? `0 0 0 1px ${adjustHexColor(normalized, -52)} inset` : "none"
  };
}
const DEFAULT_GRID_SCHEMA = [{
  key: "name",
  label: "Name",
  type: "text",
  isTitle: true
}, {
  key: "description",
  label: "Description",
  type: "textarea",
  isTitle: false
}, {
  key: "value",
  label: "Value",
  type: "text",
  isTitle: false
}, {
  key: "symbol",
  label: "Symbol",
  type: "text",
  isTitle: false
}, {
  key: "faction",
  label: "Faction",
  type: "text",
  isTitle: false
}, {
  key: "restriction",
  label: "Restriction",
  type: "text",
  isTitle: false
}];
function normalizeGridFieldType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "textarea" || normalized === "paragraph" || normalized === "number" || normalized === "select" || normalized === "multiselect" || normalized === "boolean") {
    return normalized;
  }
  return "text";
}
function normalizeGridSchema(value, fallback = DEFAULT_GRID_SCHEMA) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  const fields = source.map((field, index) => {
    const key = String(field?.key || "").trim();
    if (!key) return null;
    const type = normalizeGridFieldType(field?.type);
    const options = type === "select" || type === "multiselect" ? [...new Set((Array.isArray(field?.options) ? field.options : []).map(option => String(option || "").trim()).filter(Boolean))] : [];
    return {
      key,
      label: String(field?.label || key).trim() || key,
      type,
      isTitle: field?.isTitle === true,
      ...(options.length > 0 ? {
        options
      } : {})
    };
  }).filter(Boolean).filter((field, index, fieldsList) => fieldsList.findIndex(candidate => candidate.key === field.key) === index);
  if (fields.length === 0) {
    return fallback === value ? [] : normalizeGridSchema(fallback, fallback);
  }
  const explicitTitleIndex = fields.findIndex(field => field.isTitle === true);
  const titleIndex = explicitTitleIndex >= 0 ? explicitTitleIndex : 0;
  return fields.map((field, index) => {
    return {
      ...field,
      isTitle: index === titleIndex
    };
  });
}
function getPrimaryGridField(schema) {
  const normalizedSchema = normalizeGridSchema(schema);
  return normalizedSchema.find(field => field.isTitle) || normalizedSchema[0] || DEFAULT_GRID_SCHEMA[0];
}
function normalizeGridFieldValueForType(field, value) {
  if (field?.type === "boolean") return value === true;
  if (field?.type === "number") {
    if (value === "" || value == null) return "";
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : value;
  }
  if (field?.type === "multiselect") {
    return Array.isArray(value) ? value.map(item => String(item || "").trim()).filter(Boolean) : [];
  }
  return value == null ? "" : value;
}
function getGridEntryValue(entry, field) {
  return normalizeGridFieldValueForType(field, entry?.[field?.key]);
}
function getGridEntryDisplayName(entry, schema) {
  const titleField = getPrimaryGridField(schema);
  const candidate = getGridEntryValue(entry, titleField);
  return String(candidate || entry?.name || entry?.title || "").trim();
}
function getGridEntryUnknownFields(entry, schema) {
  const schemaKeys = new Set(normalizeGridSchema(schema).map(field => field.key));
  const reservedKeys = new Set(["type", "title", "name"]);
  return Object.fromEntries(Object.entries(entry || {}).filter(([key]) => !reservedKeys.has(key) && !schemaKeys.has(key)));
}
function serializeGridEntryForEditor(entry, schema) {
  const normalizedSchema = normalizeGridSchema(schema);
  const values = normalizedSchema.reduce((result, field) => ({
    ...result,
    [field.key]: getGridEntryValue(entry, field)
  }), {});
  return JSON.stringify({
    ...values,
    ...getGridEntryUnknownFields(entry, normalizedSchema)
  }, null, 2);
}
function serializeGridSchemaForEditor(schema) {
  return JSON.stringify(normalizeGridSchema(schema), null, 2);
}
function escapeJsonControlCharactersInStrings(source) {
  const value = String(source || "");
  let output = "";
  let isInsideString = false;
  let isEscaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (!isInsideString) {
      if (character === "\"") isInsideString = true;
      output += character;
      continue;
    }
    if (isEscaped) {
      output += character;
      isEscaped = false;
      continue;
    }
    if (character === "\\") {
      output += character;
      isEscaped = true;
      continue;
    }
    if (character === "\"") {
      output += character;
      isInsideString = false;
      continue;
    }
    if (character === "\r") {
      output += "\\n";
      if (value[index + 1] === "\n") index += 1;
      continue;
    }
    if (character === "\n") {
      output += "\\n";
      continue;
    }
    if (character === "\t") {
      output += "\\t";
      continue;
    }
    output += character;
  }
  return output;
}
function parseCompendiumJsonEditorText(source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    return JSON.parse(escapeJsonControlCharactersInStrings(source));
  }
}
function getGridFieldEmptyValue(field, fallbackTitle = "New Grid Entry") {
  if (field?.isTitle) return fallbackTitle;
  if (field?.type === "boolean") return false;
  if (field?.type === "multiselect") return [];
  return "";
}
function parseGridEditorObject(source) {
  try {
    const parsed = parseCompendiumJsonEditorText(source);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}
function parseGridSchemaEditorFields(source) {
  try {
    const parsed = parseCompendiumJsonEditorText(source);
    return normalizeGridSchema(parsed);
  } catch (_error) {
    return [];
  }
}
function getGridFieldOptionsText(field) {
  return Array.isArray(field?.options) ? field.options.join(", ") : "";
}
function normalizeGridSchemaEditorField(field, index = 0) {
  const key = String(field?.key || "").trim() || `field${index + 1}`;
  const type = normalizeGridFieldType(field?.type);
  const options = type === "select" || type === "multiselect"
    ? [...new Set(String(Array.isArray(field?.options) ? field.options.join(", ") : field?.options || "").split(",").map(option => option.trim()).filter(Boolean))]
    : [];
  return {
    key,
    label: String(field?.label || key).trim() || key,
    type,
    isTitle: field?.isTitle === true,
    ...(options.length > 0 ? {
      options
    } : {})
  };
}
function serializeGridSchemaEditorFields(fields) {
  const normalizedFields = (Array.isArray(fields) ? fields : []).map(normalizeGridSchemaEditorField).filter(field => field.key);
  return JSON.stringify(normalizedFields, null, 2);
}
function buildGridEntryFromSchemaValues(values, schema, options = {}) {
  const normalizedSchema = normalizeGridSchema(schema);
  const titleField = getPrimaryGridField(normalizedSchema);
  const schemaKeys = new Set(normalizedSchema.map(field => field.key));
  const nextValues = {
    ...(values && typeof values === "object" && !Array.isArray(values) ? values : {})
  };
  const displayName = String(nextValues?.[titleField.key] || options.fallbackTitle || "").trim();
  if (!displayName) {
    throw new Error("Grid entries need a name.");
  }
  normalizedSchema.forEach(field => {
    nextValues[field.key] = normalizeGridFieldValueForType(field, nextValues[field.key]);
  });
  if (titleField.key !== "name") {
    nextValues[titleField.key] = displayName;
  }
  const extraValues = Object.fromEntries(Object.entries(nextValues).filter(([key]) => !schemaKeys.has(key)));
  return {
    ...(options.includeType ? {
      type: "grid"
    } : {}),
    title: displayName,
    name: displayName,
    ...Object.fromEntries(normalizedSchema.map(field => [field.key, nextValues[field.key]])),
    ...extraValues
  };
}
function isGridCustomEntry(entry, fallbackType) {
  return normalizeCustomSectionType(entry?.type || fallbackType) === "grid";
}
function isNarrativeCustomSectionType(value) {
  const normalized = normalizeCustomSectionType(value);
  return normalized === "lore";
}
function normalizeBuiltInTabsConfig(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return BUILT_IN_TAB_ORDER.reduce((tabs, key) => {
    const legacyKey = key === "grid" ? "conditions" : key;
    const nextTab = source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) ? source[key] : source[legacyKey] && typeof source[legacyKey] === "object" && !Array.isArray(source[legacyKey]) ? source[legacyKey] : {};
    tabs[key] = {
      label: typeof nextTab.label === "string" && nextTab.label.trim() ? nextTab.label.trim() : BUILT_IN_TAB_DEFAULTS[key].label,
      visible: nextTab.visible !== false,
      color: normalizeCompendiumAccentColor(nextTab.color)
    };
    return tabs;
  }, {});
}
function normalizeTabOrder(value, customSections) {
  const availableKeys = [...BUILT_IN_TAB_ORDER, ...(Array.isArray(customSections) ? customSections : []).map(customSection => getCustomSectionKey(customSection.title))];
  const requestedKeys = Array.isArray(value) ? value.map(key => {
    const normalizedKey = String(key || "").trim();
    return normalizedKey === "conditions" ? "grid" : normalizedKey;
  }).filter(Boolean) : [];
  const uniqueRequested = [...new Set(requestedKeys)].filter(key => availableKeys.includes(key));
  return [...uniqueRequested, ...availableKeys.filter(key => !uniqueRequested.includes(key))];
}
function isBuiltInSectionKey(value) {
  return BUILT_IN_TAB_ORDER.includes(String(value || "").trim());
}
function buildReorderScope(...parts) {
  return parts.map(part => encodeURIComponent(String(part || ""))).join("::");
}
function moveItemById(items, sourceId, targetId, getId) {
  if (!Array.isArray(items) || sourceId === targetId) return Array.isArray(items) ? items : [];
  const sourceIndex = items.findIndex(item => getId(item) === sourceId);
  const targetIndex = items.findIndex(item => getId(item) === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items;
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}
function normalizeClassPageLabels(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sourceGroupLabels = source.groupLabels && typeof source.groupLabels === "object" && !Array.isArray(source.groupLabels) ? source.groupLabels : {};
  const sourceClassLabels = source.classLabels && typeof source.classLabels === "object" && !Array.isArray(source.classLabels) ? source.classLabels : {};
  return {
    groupLabels: Object.entries(CLASS_PAGE_DEFAULTS.groupLabels).reduce((labels, [key, defaultLabel]) => {
      labels[key] = typeof sourceGroupLabels[key] === "string" && sourceGroupLabels[key].trim() ? sourceGroupLabels[key].trim() : defaultLabel;
      return labels;
    }, {}),
    classLabels: Object.entries(CLASS_PAGE_DEFAULTS.classLabels).reduce((labels, [key, defaultLabel]) => {
      labels[key] = typeof sourceClassLabels[key] === "string" && sourceClassLabels[key].trim() ? sourceClassLabels[key].trim() : defaultLabel;
      return labels;
    }, {})
  };
}
function normalizeClassPageStructure(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sourceGroups = Array.isArray(source.groups) ? source.groups : CLASS_PAGE_STRUCTURE_DEFAULTS.groups;
  const groups = sourceGroups.map((group, index) => ({
    key: typeof group?.key === "string" && group.key.trim() ? group.key.trim() : `group-${index + 1}`,
    classes: [...new Set((Array.isArray(group?.classes) ? group.classes : []).map(className => String(className || "").trim()).filter(Boolean))]
  })).filter(group => group.key);
  return {
    groups: groups.length > 0 ? groups : CLASS_PAGE_STRUCTURE_DEFAULTS.groups
  };
}
function normalizeEquipmentPageLabels(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sourceSectionLabels = source.sectionLabels && typeof source.sectionLabels === "object" && !Array.isArray(source.sectionLabels) ? source.sectionLabels : {};
  const sourceSubsectionLabels = source.subsectionLabels && typeof source.subsectionLabels === "object" && !Array.isArray(source.subsectionLabels) ? source.subsectionLabels : {};
  return {
    sectionLabels: Object.entries(EQUIPMENT_PAGE_DEFAULTS.sectionLabels).reduce((labels, [key, defaultLabel]) => {
      labels[key] = typeof sourceSectionLabels[key] === "string" && sourceSectionLabels[key].trim() ? sourceSectionLabels[key].trim() : defaultLabel;
      return labels;
    }, {}),
    subsectionLabels: Object.entries(EQUIPMENT_PAGE_DEFAULTS.subsectionLabels).reduce((labels, [key, defaultLabel]) => {
      labels[key] = typeof sourceSubsectionLabels[key] === "string" && sourceSubsectionLabels[key].trim() ? sourceSubsectionLabels[key].trim() : defaultLabel;
      return labels;
    }, {})
  };
}
function readSavedCompendiumNavState() {
  try {
    const raw = window.localStorage.getItem(COMPENDIUM_NAV_STATE_KEY) || window.sessionStorage.getItem(COMPENDIUM_NAV_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}
function writeSavedCompendiumNavState(state) {
  try {
    window.localStorage.setItem(COMPENDIUM_NAV_STATE_KEY, JSON.stringify(state));
    window.sessionStorage.setItem(COMPENDIUM_NAV_STATE_KEY, JSON.stringify(state));
  } catch (_error) {}
}
function getCompendiumFavoritesStorageKey(userId) {
  return `${COMPENDIUM_FAVORITES_STORAGE_PREFIX}:${userId ? `user:${userId}` : "guest"}`;
}
function normalizeCompendiumFavorite(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const favoriteKey = String(value.favoriteKey || "").trim();
  const topSectionKey = String(value.topSectionKey || "").trim() === "conditions" ? "grid" : String(value.topSectionKey || "").trim();
  const topSectionLabel = String(value.topSectionLabel || "").trim();
  const sectionTitle = String(value.sectionTitle || "").trim();
  const entryTitle = String(value.entryTitle || "").trim();
  const rawBlockType = String(value.blockType || "").trim().toLowerCase();
  const blockType = rawBlockType === "condition" ? "grid" : rawBlockType;
  const blockIndex = Number(value.blockIndex);
  const blockText = String(value.blockText || "").trim();
  if (!favoriteKey || !topSectionKey || !topSectionLabel || !sectionTitle || !entryTitle || !blockText) return null;
  if (!["paragraph", "heading", "table", "image", "class-ability", "grid"].includes(blockType)) return null;
  return {
    favoriteKey,
    topSectionKey,
    topSectionLabel,
    sectionTitle,
    entryTitle,
    blockType,
    blockIndex: Number.isInteger(blockIndex) && blockIndex >= 0 ? blockIndex : 0,
    blockText,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null
  };
}
function sortCompendiumFavorites(favorites) {
  return [...favorites].sort((left, right) => {
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return left.favoriteKey.localeCompare(right.favoriteKey);
  });
}
function readSavedCompendiumFavorites(userId) {
  try {
    const raw = window.localStorage.getItem(getCompendiumFavoritesStorageKey(userId)) || window.sessionStorage.getItem(getCompendiumFavoritesStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sortCompendiumFavorites((Array.isArray(parsed) ? parsed : []).map(normalizeCompendiumFavorite).filter(Boolean));
  } catch (_error) {
    return [];
  }
}
function writeSavedCompendiumFavorites(userId, favorites) {
  try {
    const serialized = JSON.stringify(sortCompendiumFavorites((Array.isArray(favorites) ? favorites : []).map(normalizeCompendiumFavorite).filter(Boolean)));
    const storageKey = getCompendiumFavoritesStorageKey(userId);
    window.localStorage.setItem(storageKey, serialized);
    window.sessionStorage.setItem(storageKey, serialized);
  } catch (_error) {}
}
function createCompendiumFavoriteKey({
  topSectionKey,
  sectionTitle,
  entryTitle,
  blockType,
  blockIndex
}) {
  return [topSectionKey, sectionTitle, entryTitle, blockType, blockIndex].map(value => encodeURIComponent(String(value || ""))).join("::");
}
function getCompendiumFavoriteBlockTypeLabel(blockType) {
  return FAVORITE_BLOCK_TYPE_LABELS[blockType] || "Entry";
}
function buildCompendiumFavoritePath(sectionTitle, entryTitle) {
  return `${String(sectionTitle || "")}::${String(entryTitle || "")}`;
}
function parseCompendiumFavoritePath(value) {
  const rawValue = String(value || "");
  const separatorIndex = rawValue.indexOf("::");
  if (separatorIndex < 0) {
    return {
      sectionTitle: rawValue,
      entryTitle: ""
    };
  }
  return {
    sectionTitle: rawValue.slice(0, separatorIndex),
    entryTitle: rawValue.slice(separatorIndex + 2)
  };
}
function getCompendiumTopSectionLabel(topSectionKey, builtInTabs, customSections) {
  if (topSectionKey === "lore") return builtInTabs.lore?.label || BUILT_IN_TAB_DEFAULTS.lore.label;
  const customTitle = getCustomSectionTitleFromKey(topSectionKey);
  return customSections.find(customSection => customSection.title === customTitle)?.title || customTitle || topSectionKey;
}
function getDefaultApiUrl() {
  const { protocol, hostname, origin } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
  if (PAGE_PARAMS.get("apiUrl")) return PAGE_PARAMS.get("apiUrl");
  if (isLocalHost) return `${protocol}//${hostname}:5000`;
  return origin;
}
const API_URL = getDefaultApiUrl();
async function fetchPirateJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch (_error) {
    payload = {};
  }
  return {
    response,
    payload
  };
}
function getEntryKey(collection, entry) {
  if (collection === "classAbilities") {
    return {
      class: entry.class,
      rank: entry.rank,
      name: entry.name
    };
  }
  if (collection === "loreSections") {
    return {
      sectionTitle: entry.sectionTitle,
      title: entry.title
    };
  }
  if (collection === "customSections") {
    return {
      tabTitle: entry.tabTitle,
      sectionTitle: entry.sectionTitle,
      title: entry.title
    };
  }
  return {
    name: entry.name
  };
}
const LORE_SPELLCHECK_MIN_WORD_LENGTH = 3;
const LORE_SPELLCHECK_MAX_SUGGESTIONS = 12;
const LORE_SPELLCHECK_BASE_WORDS = new Set(["a", "an", "and", "are", "around", "as", "at", "away", "be", "been", "before", "below", "between", "both", "but", "by", "can", "could", "did", "do", "does", "down", "each", "even", "every", "for", "from", "had", "has", "have", "he", "her", "here", "hers", "him", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "many", "me", "more", "most", "my", "new", "no", "not", "now", "of", "off", "often", "on", "once", "one", "only", "or", "other", "our", "out", "over", "said", "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "up", "upon", "us", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "why", "will", "with", "within", "without", "would", "you", "your", "yours"]);
function normalizeLoreSpellcheckWord(word) {
  const normalizedWord = String(word || "").toLowerCase().replace(/[’']/g, "'").replace(/^'+|'+$/g, "").replace(/'s$/g, "");
  return /^[a-z][a-z']*$/.test(normalizedWord) && normalizedWord.length >= LORE_SPELLCHECK_MIN_WORD_LENGTH ? normalizedWord : "";
}
function collectLoreSpellcheckWordsFromText(text, targetSet) {
  if (!(targetSet instanceof Set)) return;
  const normalizedText = String(text || "").replace(/!\[[^\]]*\]\(([^)]+)\)/g, " ").replace(/https?:\/\/\S+/gi, " ").replace(/[<>{}\[\]()*_`~|\\/#:+="]/g, " ");
  const matches = normalizedText.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  matches.forEach(match => {
    const normalizedWord = normalizeLoreSpellcheckWord(match);
    if (normalizedWord) {
      targetSet.add(normalizedWord);
    }
  });
}
function collectLoreSpellcheckWordsFromValue(value, targetSet) {
  if (value == null) return;
  if (typeof value === "string") {
    collectLoreSpellcheckWordsFromText(value, targetSet);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectLoreSpellcheckWordsFromValue(item, targetSet));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach(item => collectLoreSpellcheckWordsFromValue(item, targetSet));
  }
}
function renderLoreSpellcheckOverlayText(text, spellcheckIssues) {
  const sourceText = String(text || "");
  if (!Array.isArray(spellcheckIssues) || spellcheckIssues.length === 0) {
    return sourceText || " ";
  }
  const elements = [];
  const pattern = /[A-Za-z][A-Za-z'’-]*/g;
  let lastIndex = 0;
  let match;
  let matchIndex = 0;
  while ((match = pattern.exec(sourceText)) !== null) {
    if (match.index > lastIndex) {
      elements.push(sourceText.slice(lastIndex, match.index));
    }
    const matchedWord = match[0];
    const normalizedWord = normalizeLoreSpellcheckWord(matchedWord);
    if (normalizedWord && misspelledWordSet.has(normalizedWord)) {
      elements.push(React.createElement("span", {
        key: `misspelled-${matchIndex}-${match.index}`,
        className: "compendiumSpellcheckUnderline"
      }, matchedWord));
    } else {
      elements.push(matchedWord);
    }
    lastIndex = pattern.lastIndex;
    matchIndex += 1;
  }
  if (lastIndex < sourceText.length) {
    elements.push(sourceText.slice(lastIndex));
  }
  return elements.length > 0 ? elements : sourceText || " ";
}
function renderLoreSpellcheckIssueOverlayText(text, spellcheckIssues) {
  const sourceText = String(text || "");
  if (!Array.isArray(spellcheckIssues) || spellcheckIssues.length === 0) {
    return sourceText || " ";
  }
  const elements = [];
  let lastIndex = 0;
  spellcheckIssues.forEach((issue, issueIndex) => {
    const start = Math.max(0, Number(issue?.start) || 0);
    const end = Math.max(start, Number(issue?.end) || start);
    if (start > lastIndex) {
      elements.push(sourceText.slice(lastIndex, start));
    }
    if (end > start) {
      elements.push(React.createElement("span", {
        key: `issue-${issueIndex}-${start}`,
        className: "compendiumSpellcheckUnderline"
      }, sourceText.slice(start, end)));
    }
    lastIndex = Math.max(lastIndex, end);
  });
  if (lastIndex < sourceText.length) {
    elements.push(sourceText.slice(lastIndex));
  }
  return elements.length > 0 ? elements : sourceText || " ";
}
function escapeLoreSpellcheckHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeLoreSpellcheckHtmlWithLineBreaks(text) {
  const sourceText = String(text || "");
  const html = escapeLoreSpellcheckHtml(sourceText).replace(/\r\n?|\n/g, "<br>");
  if (sourceText.endsWith("\n")) {
    return `${html}<br>`;
  }
  return html;
}
function renderLoreSpellcheckEditableHtml(text, spellcheckIssues) {
  const sourceText = String(text || "");
  if (!Array.isArray(spellcheckIssues) || spellcheckIssues.length === 0) {
    return escapeLoreSpellcheckHtmlWithLineBreaks(sourceText || "\n");
  }
  let html = "";
  let lastIndex = 0;
  spellcheckIssues.forEach(issue => {
    const start = Math.max(0, Number(issue?.start) || 0);
    const end = Math.max(start, Number(issue?.end) || start);
    if (start > lastIndex) {
      html += escapeLoreSpellcheckHtmlWithLineBreaks(sourceText.slice(lastIndex, start));
    }
    if (end > start) {
      html += `<span class="compendiumSpellcheckUnderline">${escapeLoreSpellcheckHtmlWithLineBreaks(sourceText.slice(start, end))}</span>`;
    }
    lastIndex = Math.max(lastIndex, end);
  });
  if (lastIndex < sourceText.length) {
    html += escapeLoreSpellcheckHtmlWithLineBreaks(sourceText.slice(lastIndex));
  }
  return html || "<br>";
}
function getEditableTextSelectionOffsets(rootElement) {
  if (!rootElement) {
    return null;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!rootElement.contains(range.startContainer) || !rootElement.contains(range.endContainer)) {
    return null;
  }
  const start = getEditableTextOffsetFromPoint(rootElement, range.startContainer, range.startOffset);
  const end = getEditableTextOffsetFromPoint(rootElement, range.endContainer, range.endOffset);
  return {
    start,
    end
  };
}
function getEditableNodeTextLength(node) {
  if (!node) return 0;
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent.length;
  }
  if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === "BR") {
    return 1;
  }
  return 0;
}
function getNodeIndexWithinParent(node) {
  if (!node?.parentNode) return 0;
  return Array.prototype.indexOf.call(node.parentNode.childNodes, node);
}
function getEditableTextOffsetFromPoint(rootElement, targetNode, targetOffset) {
  let resolvedOffset = 0;
  let found = false;
  const countNodeLength = node => {
    if (!node) return 0;
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.length;
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === "BR") {
      return 1;
    }
    let total = 0;
    node.childNodes.forEach(childNode => {
      total += countNodeLength(childNode);
    });
    return total;
  };
  const visitNode = node => {
    if (!node || found) return 0;
    if (node === targetNode) {
      found = true;
      if (node.nodeType === Node.TEXT_NODE) {
        resolvedOffset += Math.max(0, Math.min(targetOffset, node.textContent.length));
        return 0;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === "BR") {
        resolvedOffset += targetOffset > 0 ? 1 : 0;
        return 0;
      }
      for (let index = 0; index < Math.min(targetOffset, node.childNodes.length); index += 1) {
        resolvedOffset += countNodeLength(node.childNodes[index]);
      }
      return 0;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      resolvedOffset += node.textContent.length;
      return 0;
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === "BR") {
      resolvedOffset += 1;
      return 0;
    }
    node.childNodes.forEach(childNode => {
      visitNode(childNode);
    });
    return 0;
  };
  visitNode(rootElement);
  return resolvedOffset;
}
function resolveEditableTextOffset(rootElement, targetOffset) {
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ALL, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === "BR") return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    }
  });
  let currentNode = walker.nextNode();
  let currentOffset = 0;
  let lastTextNode = null;
  while (currentNode) {
    const nodeLength = getEditableNodeTextLength(currentNode);
    if (currentNode.nodeType === Node.TEXT_NODE) {
      lastTextNode = currentNode;
      if (targetOffset <= currentOffset + nodeLength) {
        return {
          node: currentNode,
          offset: Math.max(0, Math.min(targetOffset - currentOffset, nodeLength))
        };
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.nodeName === "BR") {
      if (targetOffset <= currentOffset + nodeLength) {
        const parentNode = currentNode.parentNode || rootElement;
        return {
          node: parentNode,
          offset: getNodeIndexWithinParent(currentNode) + 1
        };
      }
    }
    currentOffset += nodeLength;
    currentNode = walker.nextNode();
  }
  if (lastTextNode) {
    return {
      node: lastTextNode,
      offset: lastTextNode.textContent.length
    };
  }
  return {
    node: rootElement,
    offset: rootElement.childNodes.length
  };
}
function setEditableTextSelectionOffsets(rootElement, startOffset, endOffset) {
  if (!rootElement) return;
  const selection = window.getSelection();
  if (!selection) return;
  const resolvedStart = resolveEditableTextOffset(rootElement, Math.max(0, startOffset));
  const resolvedEnd = resolveEditableTextOffset(rootElement, Math.max(0, endOffset));
  const range = document.createRange();
  range.setStart(resolvedStart.node, resolvedStart.offset);
  range.setEnd(resolvedEnd.node, resolvedEnd.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}
function getEditableTextValue(rootElement) {
  if (!rootElement) return "";
  const rawValue = typeof rootElement.innerText === "string" ? rootElement.innerText : rootElement.textContent || "";
  return rawValue.replace(/\r\n?/g, "\n").replace(/\u00A0/g, " ");
}

function CompendiumSpellcheckEditor({
  value,
  issues,
  onChange,
  onFocus,
  onContextMenu,
  disabled = false,
  className = ""
}) {
  const editorRef = React.useRef(null);
  const lastRenderedValueRef = React.useRef("");
  const lastRenderedHtmlRef = React.useRef("");
  const pendingSelectionRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextValue = String(value || "");
    const nextHtml = renderLoreSpellcheckEditableHtml(nextValue, issues);
    if (document.activeElement === editor && nextValue === lastRenderedValueRef.current && nextHtml === lastRenderedHtmlRef.current) {
      return;
    }
    const selection = document.activeElement === editor ? getEditableTextSelectionOffsets(editor) : null;
    editor.innerHTML = nextHtml;
    lastRenderedValueRef.current = nextValue;
    lastRenderedHtmlRef.current = nextHtml;
    const nextSelection = pendingSelectionRef.current || selection;
    if (nextSelection && document.activeElement === editor) {
      setEditableTextSelectionOffsets(editor, nextSelection.start, nextSelection.end);
    }
    pendingSelectionRef.current = null;
  }, [issues, value]);
  return React.createElement("div", {
    ref: editorRef,
    className: `compendiumEditTextarea compendiumEditRichText ${className}`.trim(),
    contentEditable: !disabled,
    suppressContentEditableWarning: true,
    role: "textbox",
    "aria-multiline": "true",
    tabIndex: disabled ? -1 : 0,
    onFocus,
    onContextMenu,
    onKeyDown: event => {
      if (event.key !== "Tab" && event.key !== "Enter") return;
      event.preventDefault();
      const editor = event.currentTarget;
      const currentValue = getEditableTextValue(editor);
      const selection = getEditableTextSelectionOffsets(editor) || {
        start: currentValue.length,
        end: currentValue.length
      };
      const insertedText = event.key === "Tab" ? "\t" : "\n";
      const nextValue = currentValue.slice(0, selection.start) + insertedText + currentValue.slice(selection.end);
      const nextCaretOffset = selection.start + insertedText.length;
      pendingSelectionRef.current = {
        start: nextCaretOffset,
        end: nextCaretOffset
      };
      lastRenderedValueRef.current = nextValue;
      onChange(nextValue);
    },
    onPaste: event => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, text);
    },
    onInput: event => {
      const nextValue = getEditableTextValue(event.currentTarget);
      lastRenderedValueRef.current = nextValue;
      onChange(nextValue);
    }
  });
}

function CompendiumApp() {
  const savedNavState = React.useMemo(() => readSavedCompendiumNavState(), []);
  const pendingLoreSelectionRef = React.useRef(null);
  const [section, setSection] = React.useState(savedNavState.section === FAVORITES_SECTION_KEY || savedNavState.section === "grid" || savedNavState.section === "conditions" || savedNavState.section === "lore" || isCustomSectionKey(savedNavState.section) ? savedNavState.section === "conditions" ? "grid" : savedNavState.section : "lore");
  const [classAbilities, setClassAbilities] = React.useState([]);
  const [weapons, setWeapons] = React.useState([]);
  const [armors, setArmors] = React.useState([]);
  const [shields, setShields] = React.useState([]);
  const [equipmentProperties, setEquipmentProperties] = React.useState([]);
  const [grid, setGrid] = React.useState([]);
  const [gridSchema, setGridSchema] = React.useState(() => normalizeGridSchema(null));
  const [customSections, setCustomSections] = React.useState([]);
  const [tabOrder, setTabOrder] = React.useState(() => normalizeTabOrder(savedNavState.tabOrder, []));
  const [builtInTabs, setBuiltInTabs] = React.useState(() => normalizeBuiltInTabsConfig(null));
  const [classPageLabels, setClassPageLabels] = React.useState(() => normalizeClassPageLabels(null));
  const [classPageStructure, setClassPageStructure] = React.useState(() => normalizeClassPageStructure(null));
  const [equipmentPageLabels, setEquipmentPageLabels] = React.useState(() => normalizeEquipmentPageLabels(null));
  const [loreSections, setLoreSections] = React.useState([]);
  const [isCompendiumLoaded, setIsCompendiumLoaded] = React.useState(false);
  const [canEdit, setCanEdit] = React.useState(null);
  const [showWriterTools, setShowWriterTools] = React.useState(savedNavState.showWriterTools === true);
  const [editDialog, setEditDialog] = React.useState(null);
  const [editText, setEditText] = React.useState("");
  const [editMessage, setEditMessage] = React.useState("");
  const [activeGridParagraphFieldKey, setActiveGridParagraphFieldKey] = React.useState("");
  const [loreSpellcheckIssues, setLoreSpellcheckIssues] = React.useState([]);
  const [loreSpellcheckMenu, setLoreSpellcheckMenu] = React.useState(null);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [selectedGroupTitle, setSelectedGroupTitle] = React.useState(typeof savedNavState.selectedGroupTitle === "string" ? savedNavState.selectedGroupTitle : "");
  const [selectedClassName, setSelectedClassName] = React.useState(typeof savedNavState.selectedClassName === "string" ? savedNavState.selectedClassName : "");
  const [equipmentSection, setEquipmentSection] = React.useState(savedNavState.equipmentSection === "armorShields" || savedNavState.equipmentSection === "equipmentProperties" ? savedNavState.equipmentSection : "weapons");
  const [selectedLoreSectionTitle, setSelectedLoreSectionTitle] = React.useState(typeof savedNavState.selectedLoreSectionTitle === "string" ? savedNavState.selectedLoreSectionTitle : "");
  const [selectedLoreEntryTitle, setSelectedLoreEntryTitle] = React.useState(typeof savedNavState.selectedLoreEntryTitle === "string" ? savedNavState.selectedLoreEntryTitle : "");
  const [showWeaponFilters, setShowWeaponFilters] = React.useState(false);
  const [weaponSortBy, setWeaponSortBy] = React.useState("name");
  const [weaponTypeFilters, setWeaponTypeFilters] = React.useState([]);
  const [weaponTypeFilterMode, setWeaponTypeFilterMode] = React.useState("or");
  const [damageTypeFilter, setDamageTypeFilter] = React.useState("");
  const [evasionCostFilter, setEvasionCostFilter] = React.useState("");
  const [damageFilter, setDamageFilter] = React.useState("");
  const [propertyFilters, setPropertyFilters] = React.useState([]);
  const [propertyFilterMode, setPropertyFilterMode] = React.useState("or");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentUser, setCurrentUser] = React.useState(null);
  const [favoriteItems, setFavoriteItems] = React.useState(() => readSavedCompendiumFavorites(null));
  const [favoriteMessage, setFavoriteMessage] = React.useState("");
  const [isFavoriteListLoading, setIsFavoriteListLoading] = React.useState(false);
  const [favoritePendingKeys, setFavoritePendingKeys] = React.useState([]);
  const [highlightedFavoriteKey, setHighlightedFavoriteKey] = React.useState("");
  const [isImageManagerOpen, setIsImageManagerOpen] = React.useState(false);
  const [compendiumImages, setCompendiumImages] = React.useState([]);
  const [isCompendiumImagesLoading, setIsCompendiumImagesLoading] = React.useState(false);
  const [compendiumImageMessage, setCompendiumImageMessage] = React.useState("");
  const [pendingImageName, setPendingImageName] = React.useState("");
  const [gridSchemaDraft, setGridSchemaDraft] = React.useState(() => serializeGridSchemaForEditor(DEFAULT_GRID_SCHEMA));
  const [gridSchemaMessage, setGridSchemaMessage] = React.useState("");
  const [isGridSchemaEditorOpen, setIsGridSchemaEditorOpen] = React.useState(false);
  const [navEditDialog, setNavEditDialog] = React.useState(null);
  const [navEditTitle, setNavEditTitle] = React.useState("");
  const [navEditColor, setNavEditColor] = React.useState("#b57c36");
  const [navEditUseDefaultColor, setNavEditUseDefaultColor] = React.useState(true);
  const [navEditMessage, setNavEditMessage] = React.useState("");
  const [isSavingNavEdit, setIsSavingNavEdit] = React.useState(false);
  const [reorderState, setReorderState] = React.useState(null);
  const editToolsVisible = canEdit && showWriterTools;
  const tabOrderRef = React.useRef(tabOrder);
  const classPageStructureRef = React.useRef(classPageStructure);
  const loreSectionsRef = React.useRef(loreSections);
  const customSectionsRef = React.useRef(customSections);
  const favoriteItemsRef = React.useRef(favoriteItems);
  const editTextareaRef = React.useRef(null);
  const pendingLoreSelectionOffsetsRef = React.useRef(null);
  const loreSpellcheckRequestRef = React.useRef(0);
  const reorderHoldTimerRef = React.useRef(null);
  const reorderHoldTargetRef = React.useRef(null);
  const suppressHeldClickRef = React.useRef(false);

  React.useEffect(() => {
    fetch(`${API_URL}/pyrrhic-war/compendium/data?ts=${Date.now()}`, {
      credentials: "include"
    }).then(res => res.json()).then(data => {
      setClassAbilities(Array.isArray(data?.classAbilities) ? data.classAbilities : []);
      setWeapons(Array.isArray(data?.weapons) ? data.weapons : []);
      setArmors(Array.isArray(data?.armors) ? data.armors : []);
      setShields(Array.isArray(data?.shields) ? data.shields : []);
      setEquipmentProperties(Array.isArray(data?.equipmentProperties) ? data.equipmentProperties : []);
      setGrid(Array.isArray(data?.grid) ? data.grid : Array.isArray(data?.conditions) ? data.conditions : []);
      setGridSchema(normalizeGridSchema(data?.gridSchema));
      const nextCustomSections = Array.isArray(data?.customSections) ? data.customSections.map(tab => ({
        ...tab,
        type: normalizeCustomSectionType(tab?.type),
        sections: (Array.isArray(tab?.sections) ? tab.sections : []).map(section => ({
          ...section,
          type: normalizeCustomSectionType(section?.type || tab?.type),
          ...(normalizeCustomSectionType(section?.type || tab?.type) === "grid" ? {
            gridSchema: normalizeGridSchema(section?.gridSchema)
          } : {})
        }))
      })) : [];
      setCustomSections(nextCustomSections);
      setTabOrder(normalizeTabOrder(data?.tabOrder, nextCustomSections));
      setBuiltInTabs(normalizeBuiltInTabsConfig(data?.builtInTabs));
      setClassPageLabels(normalizeClassPageLabels(data?.classPageLabels));
      setClassPageStructure(normalizeClassPageStructure(data?.classPageStructure));
      setEquipmentPageLabels(normalizeEquipmentPageLabels(data?.equipmentPageLabels));
      setLoreSections(Array.isArray(data?.loreSections) ? data.loreSections : []);
    }).catch(() => {
      setClassAbilities([]);
      setWeapons([]);
      setArmors([]);
      setShields([]);
      setEquipmentProperties([]);
      setGrid([]);
      setGridSchema(normalizeGridSchema(null));
      setCustomSections([]);
      setTabOrder(normalizeTabOrder(null, []));
      setBuiltInTabs(normalizeBuiltInTabsConfig(null));
      setClassPageLabels(normalizeClassPageLabels(null));
      setClassPageStructure(normalizeClassPageStructure(null));
      setEquipmentPageLabels(normalizeEquipmentPageLabels(null));
      setLoreSections([]);
    }).finally(() => {
      setIsCompendiumLoaded(true);
    });
  }, []);
  React.useEffect(() => {
    fetchPirateJson("/pyrrhic-war/access", {
      method: "GET"
    }).then(({
      response,
      payload
    }) => {
      if (!response.ok) {
        setCurrentUser(null);
        setCanEdit(false);
        return;
      }
      setCurrentUser(payload.user || null);
      setCanEdit(Boolean(payload.access?.canEditCompendium));
    }).catch(() => {
      setCurrentUser(null);
      setCanEdit(false);
    });
  }, []);
  React.useEffect(() => {
    if (canEdit !== false) return;
    setShowWriterTools(false);
  }, [canEdit]);
  React.useEffect(() => {
    tabOrderRef.current = tabOrder;
  }, [tabOrder]);
  React.useEffect(() => {
    classPageStructureRef.current = classPageStructure;
  }, [classPageStructure]);
  React.useEffect(() => {
    loreSectionsRef.current = loreSections;
  }, [loreSections]);
  React.useEffect(() => {
    customSectionsRef.current = customSections;
  }, [customSections]);
  React.useEffect(() => {
    favoriteItemsRef.current = favoriteItems;
  }, [favoriteItems]);
  const commitFavoriteItems = React.useCallback((items, userId = currentUser?.id || null) => {
    const normalized = sortCompendiumFavorites((Array.isArray(items) ? items : []).map(normalizeCompendiumFavorite).filter(Boolean));
    setFavoriteItems(normalized);
    writeSavedCompendiumFavorites(userId, normalized);
    return normalized;
  }, [currentUser]);
  React.useEffect(() => {
    if (!currentUser?.id) {
      commitFavoriteItems(readSavedCompendiumFavorites(null), null);
      setIsFavoriteListLoading(false);
      return;
    }
    let isActive = true;
    setIsFavoriteListLoading(true);
    fetchPirateJson("/pyrrhic-war/favorites", {
      method: "GET"
    }).then(({
      response,
      payload
    }) => {
      if (!isActive) return;
      if (!response.ok) {
        commitFavoriteItems(readSavedCompendiumFavorites(currentUser.id), currentUser.id);
        setFavoriteMessage(payload.message || "Unable to load your synced favorites right now.");
        return;
      }
      commitFavoriteItems(Array.isArray(payload.favorites) ? payload.favorites : [], currentUser.id);
    }).catch(() => {
      if (!isActive) return;
      commitFavoriteItems(readSavedCompendiumFavorites(currentUser.id), currentUser.id);
      setFavoriteMessage("Unable to load your synced favorites right now.");
    }).finally(() => {
      if (isActive) setIsFavoriteListLoading(false);
    });
    return () => {
      isActive = false;
    };
  }, [commitFavoriteItems, currentUser]);
  React.useEffect(() => {
    if (editToolsVisible) return;
    setIsImageManagerOpen(false);
  }, [editToolsVisible]);
  React.useEffect(() => {
    if (!favoriteMessage) return;
    const timer = window.setTimeout(() => setFavoriteMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [favoriteMessage]);
  React.useEffect(() => {
    if (!compendiumImageMessage) return;
    const timer = window.setTimeout(() => setCompendiumImageMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [compendiumImageMessage]);
  const loadCompendiumImages = React.useCallback(async () => {
    setIsCompendiumImagesLoading(true);
    try {
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/compendium/images", {
        method: "GET"
      });
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load compendium images right now.");
      }
      setCompendiumImages(Array.isArray(payload.images) ? payload.images : []);
    } catch (error) {
      setCompendiumImageMessage(error instanceof Error ? error.message : "Unable to load compendium images right now.");
    } finally {
      setIsCompendiumImagesLoading(false);
    }
  }, []);
  React.useEffect(() => {
    if (!isImageManagerOpen) return;
    loadCompendiumImages();
  }, [isImageManagerOpen, loadCompendiumImages]);

  const selectedGroup = classPageStructure.groups.find(group => group.key === selectedGroupTitle) || classPageStructure.groups[0] || {
    key: "",
    classes: []
  };
  const getClassGroupLabel = React.useCallback(groupTitle => classPageLabels.groupLabels[groupTitle] || formatGroupTitle(groupTitle), [classPageLabels]);
  const getClassLabel = React.useCallback(className => classPageLabels.classLabels[className] || className, [classPageLabels]);
  const getEquipmentSectionLabel = React.useCallback(sectionKey => equipmentPageLabels.sectionLabels[sectionKey] || EQUIPMENT_PAGE_DEFAULTS.sectionLabels[sectionKey] || sectionKey, [equipmentPageLabels]);
  const getEquipmentSubsectionLabel = React.useCallback(sectionKey => equipmentPageLabels.subsectionLabels[sectionKey] || EQUIPMENT_PAGE_DEFAULTS.subsectionLabels[sectionKey] || sectionKey, [equipmentPageLabels]);
  const favoriteKeys = React.useMemo(() => new Set(favoriteItems.map(item => item.favoriteKey)), [favoriteItems]);
  const favoritePendingKeySet = React.useMemo(() => new Set(favoritePendingKeys), [favoritePendingKeys]);
  const formatFavoriteLocation = React.useCallback(favorite => {
    if (!favorite) return "";
    if (favorite.topSectionKey === "classes") {
      const parsedPath = parseCompendiumFavoritePath(favorite.sectionTitle);
      return [favorite.topSectionLabel, getClassGroupLabel(parsedPath.sectionTitle), getClassLabel(parsedPath.entryTitle), getCompendiumFavoriteBlockTypeLabel(favorite.blockType)].filter(Boolean).join(" / ");
    }
    if (favorite.topSectionKey === "equipment") {
      const equipmentLabel = favorite.sectionTitle === "armor" || favorite.sectionTitle === "shields" ? getEquipmentSubsectionLabel(favorite.sectionTitle === "armor" ? "armor" : "shields") : getEquipmentSectionLabel(favorite.sectionTitle);
      return [favorite.topSectionLabel, equipmentLabel, getCompendiumFavoriteBlockTypeLabel(favorite.blockType)].filter(Boolean).join(" / ");
    }
    if (favorite.topSectionKey === "grid") {
      return [favorite.topSectionLabel, getCompendiumFavoriteBlockTypeLabel(favorite.blockType)].filter(Boolean).join(" / ");
    }
    return [favorite.topSectionLabel, favorite.sectionTitle, getCompendiumFavoriteBlockTypeLabel(favorite.blockType)].filter(Boolean).join(" / ");
  }, [getClassGroupLabel, getClassLabel, getEquipmentSectionLabel, getEquipmentSubsectionLabel]);
  const queueFavoriteKey = React.useCallback(favoriteKey => {
    setFavoritePendingKeys(previousKeys => previousKeys.includes(favoriteKey) ? previousKeys : [...previousKeys, favoriteKey]);
  }, []);
  const dequeueFavoriteKey = React.useCallback(favoriteKey => {
    setFavoritePendingKeys(previousKeys => previousKeys.filter(key => key !== favoriteKey));
  }, []);

  React.useEffect(() => {
    if (!isCompendiumLoaded) return;
    if (!selectedGroup.classes.includes(selectedClassName)) {
      setSelectedClassName(selectedGroup.classes[0] || "");
    }
    if (selectedGroup.key && selectedGroup.key !== selectedGroupTitle) {
      setSelectedGroupTitle(selectedGroup.key);
    }
  }, [isCompendiumLoaded, selectedGroup, selectedGroupTitle, selectedClassName]);
  React.useEffect(() => {
    setTabOrder(previousOrder => normalizeTabOrder(previousOrder, customSections));
  }, [customSections]);
  const visibleBuiltInTabKeys = React.useMemo(() => BUILT_IN_TAB_ORDER.filter(key => builtInTabs[key]?.visible !== false), [builtInTabs]);
  const navItems = React.useMemo(() => {
    const visibleItems = [...visibleBuiltInTabKeys.map(key => ({
      key,
      label: builtInTabs[key]?.label || BUILT_IN_TAB_DEFAULTS[key].label,
      color: normalizeCompendiumAccentColor(builtInTabs[key]?.color)
    })), ...customSections.map(customSection => ({
      key: getCustomSectionKey(customSection.title),
      label: customSection.title,
      color: normalizeCompendiumAccentColor(customSection?.color)
    }))];
    const itemLookup = new Map(visibleItems.map(item => [item.key, item]));
    return normalizeTabOrder(tabOrder, customSections).map(key => itemLookup.get(key)).filter(Boolean);
  }, [builtInTabs, customSections, tabOrder, visibleBuiltInTabKeys]);
  React.useEffect(() => {
    if (!isCompendiumLoaded) return;
    if (section === FAVORITES_SECTION_KEY) return;
    if (navItems.some(item => item.key === section)) return;
    const fallbackSection = navItems[0]?.key || "lore";
    setSection(fallbackSection);
  }, [isCompendiumLoaded, navItems, section]);
  const activeCustomSection = React.useMemo(() => customSections.find(customSection => customSection.title === getCustomSectionTitleFromKey(section)) || null, [customSections, section]);
  const activeCustomSectionType = normalizeCustomSectionType(activeCustomSection?.type);
  const activeNarrativeCategories = React.useMemo(() => section === "lore" ? loreSections : isCustomSectionKey(section) && Array.isArray(activeCustomSection?.sections) ? activeCustomSection.sections : [], [activeCustomSection, loreSections, section]);
  const selectedLoreSection = React.useMemo(() => {
    const matchedSection = activeNarrativeCategories.find(loreSection => loreSection.title === selectedLoreSectionTitle);
    if (matchedSection) return matchedSection;
    const pendingSectionTitle = pendingLoreSelectionRef.current?.sectionTitle;
    if (pendingSectionTitle) {
      const pendingSection = activeNarrativeCategories.find(loreSection => loreSection.title === pendingSectionTitle);
      if (pendingSection) return pendingSection;
    }
    return activeNarrativeCategories[0] || null;
  }, [activeNarrativeCategories, selectedLoreSectionTitle]);
  React.useEffect(() => {
    if (section !== "lore" && !isCustomSectionKey(section)) {
      return;
    }
    if (activeNarrativeCategories.length === 0) {
      return;
    }
    const pendingSelection = pendingLoreSelectionRef.current;
    if (pendingSelection) {
      if (pendingSelection.topSectionKey && pendingSelection.topSectionKey !== section) {
        return;
      }
      const pendingSection = activeNarrativeCategories.find(sectionData => sectionData.title === pendingSelection.sectionTitle);
      if (pendingSection) {
        const pendingEntries = Array.isArray(pendingSection.entries) ? pendingSection.entries : [];
        const resolvedPendingEntryTitle = pendingEntries.some(entry => entry.title === pendingSelection.entryTitle) ? pendingSelection.entryTitle : pendingEntries[0]?.title || "";
        if (selectedLoreSectionTitle !== pendingSelection.sectionTitle) {
          setSelectedLoreSectionTitle(pendingSelection.sectionTitle);
          return;
        }
        if (selectedLoreEntryTitle !== resolvedPendingEntryTitle) {
          setSelectedLoreEntryTitle(resolvedPendingEntryTitle);
          return;
        }
        pendingLoreSelectionRef.current = null;
      }
    }
    if (!selectedLoreSection) {
      if (selectedLoreSectionTitle !== "") setSelectedLoreSectionTitle("");
      if (selectedLoreEntryTitle !== "") setSelectedLoreEntryTitle("");
      return;
    }
    if (selectedLoreSection.title !== selectedLoreSectionTitle) {
      setSelectedLoreSectionTitle(selectedLoreSection.title);
      return;
    }
    const loreEntries = Array.isArray(selectedLoreSection.entries) ? selectedLoreSection.entries : [];
    if (!loreEntries.some(entry => entry.title === selectedLoreEntryTitle)) {
      setSelectedLoreEntryTitle(loreEntries[0]?.title || "");
    }
  }, [activeNarrativeCategories, section, selectedLoreSection, selectedLoreSectionTitle, selectedLoreEntryTitle]);
  const selectedLoreEntry = React.useMemo(() => {
    if (!selectedLoreSection) return null;
    const loreEntries = Array.isArray(selectedLoreSection.entries) ? selectedLoreSection.entries : [];
    return loreEntries.find(entry => entry.title === selectedLoreEntryTitle) || loreEntries[0] || null;
  }, [selectedLoreSection, selectedLoreEntryTitle]);
  const selectedGridCategorySchema = React.useMemo(() => normalizeGridSchema(selectedLoreSection?.gridSchema), [selectedLoreSection]);
  const activeGridSchema = React.useMemo(() => section === "grid" || isCustomSectionKey(section) && activeCustomSectionType === "grid" ? normalizeGridSchema(gridSchema) : normalizeCustomSectionType(selectedLoreSection?.type || activeCustomSectionType) === "grid" ? selectedGridCategorySchema : normalizeGridSchema(null), [activeCustomSectionType, gridSchema, section, selectedGridCategorySchema, selectedLoreSection]);
  const activeGridSchemaScope = React.useMemo(() => section === "grid" || isCustomSectionKey(section) && activeCustomSectionType === "grid" ? "__built_in_grid__" : normalizeCustomSectionType(selectedLoreSection?.type || activeCustomSectionType) === "grid" ? `custom::${getCustomSectionTitleFromKey(section)}::${selectedLoreSection?.title || ""}` : "", [activeCustomSectionType, section, selectedLoreSection]);
  React.useEffect(() => {
    if (!activeGridSchemaScope) return;
    setGridSchemaDraft(serializeGridSchemaForEditor(activeGridSchema));
    setGridSchemaMessage("");
    setIsGridSchemaEditorOpen(false);
  }, [activeGridSchema, activeGridSchemaScope]);
  const loreSpellcheckDictionary = React.useMemo(() => {
    const dictionary = new Set(LORE_SPELLCHECK_BASE_WORDS);
    [classAbilities, weapons, armors, shields, equipmentProperties, grid].forEach(collection => collectLoreSpellcheckWordsFromValue(collection, dictionary));
    loreSections.forEach(sectionData => {
      collectLoreSpellcheckWordsFromValue(sectionData.title, dictionary);
      (Array.isArray(sectionData.entries) ? sectionData.entries : []).forEach(entry => {
        const isEditingCurrentEntry = editDialog?.collection === "loreSections" && editDialog?.mode !== "add" && editDialog?.key?.sectionTitle === sectionData.title && editDialog?.key?.title === entry.title;
        collectLoreSpellcheckWordsFromValue(entry.title, dictionary);
        if (!isEditingCurrentEntry) {
          collectLoreSpellcheckWordsFromValue(entry.content, dictionary);
        }
      });
    });
    customSections.forEach(tab => {
      collectLoreSpellcheckWordsFromValue(tab.title, dictionary);
      (Array.isArray(tab.sections) ? tab.sections : []).forEach(sectionData => {
        collectLoreSpellcheckWordsFromValue(sectionData.title, dictionary);
        (Array.isArray(sectionData.entries) ? sectionData.entries : []).forEach(entry => {
          const isEditingCurrentEntry = editDialog?.collection === "customSections" && editDialog?.mode !== "add" && editDialog?.key?.tabTitle === tab.title && editDialog?.key?.sectionTitle === sectionData.title && editDialog?.key?.title === entry.title;
          collectLoreSpellcheckWordsFromValue(entry.title, dictionary);
          if (!isEditingCurrentEntry) {
            collectLoreSpellcheckWordsFromValue(entry.content, dictionary);
          }
        });
      });
    });
    return dictionary;
  }, [armors, classAbilities, grid, customSections, editDialog, equipmentProperties, loreSections, shields, weapons]);
  const loreSpellcheckWordSet = React.useMemo(() => {
    if (editDialog?.collection !== "loreSections" && editDialog?.collection !== "customSections") {
      return new Set();
    }
    const misspelledWords = new Set();
    const normalizedText = String(editText || "").replace(/!\[[^\]]*\]\(([^)]+)\)/g, " ").replace(/https?:\/\/\S+/gi, " ");
    const matches = normalizedText.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    matches.forEach(match => {
      const normalizedWord = normalizeLoreSpellcheckWord(match);
      if (!normalizedWord || loreSpellcheckDictionary.has(normalizedWord)) {
        return;
      }
      misspelledWords.add(normalizedWord);
    });
    return misspelledWords;
  }, [editDialog, editText, loreSpellcheckDictionary]);
  const classGroupLookup = React.useMemo(() => {
    const lookup = new Map();
    classPageStructure.groups.forEach(group => {
      group.classes.forEach(className => {
        lookup.set(className, group.key);
      });
    });
    return lookup;
  }, [classPageStructure]);
  const narrativeLinkTargets = React.useMemo(() => {
    const normalizeTitle = value => String(value || "").trim().toLowerCase();
    const targets = [];
    const pushSectionTargets = (topSectionKey, categories) => {
      (Array.isArray(categories) ? categories : []).forEach(category => {
        const entryList = Array.isArray(category.entries) ? category.entries : [];
        targets.push({
          kind: "section",
          normalizedTitle: normalizeTitle(category.title),
          title: category.title,
          topSectionKey,
          sectionTitle: category.title,
          entryTitle: entryList[0]?.title || ""
        });
        entryList.forEach(entry => {
          targets.push({
            kind: "entry",
            normalizedTitle: normalizeTitle(entry.title),
            title: entry.title,
            topSectionKey,
            sectionTitle: category.title,
            entryTitle: entry.title
          });
        });
      });
    };
    pushSectionTargets("lore", loreSections);
    customSections.forEach(customSection => {
      if (!isNarrativeCustomSectionType(customSection.type)) return;
      pushSectionTargets(getCustomSectionKey(customSection.title), customSection.sections);
    });
    return targets;
  }, [customSections, loreSections]);
  const persistCurrentCompendiumNavState = React.useCallback((overrides = {}) => {
    writeSavedCompendiumNavState({
      section,
      equipmentSection,
      selectedGroupTitle,
      selectedClassName,
      selectedLoreSectionTitle,
      selectedLoreEntryTitle,
      showWriterTools,
      tabOrder,
      ...overrides
    });
  }, [section, equipmentSection, selectedGroupTitle, selectedClassName, selectedLoreSectionTitle, selectedLoreEntryTitle, showWriterTools, tabOrder]);
  const selectNarrativeSection = React.useCallback((topSectionKey, nextSectionTitle, preferredEntryTitle = null) => {
    const sourceCategories = topSectionKey === "lore" ? loreSections : Array.isArray(customSections.find(customSection => customSection.title === getCustomSectionTitleFromKey(topSectionKey))?.sections) ? customSections.find(customSection => customSection.title === getCustomSectionTitleFromKey(topSectionKey)).sections : [];
    const matchedSection = sourceCategories.find(sectionData => sectionData.title === nextSectionTitle);
    const sectionEntries = Array.isArray(matchedSection?.entries) ? matchedSection.entries : [];
    const resolvedEntryTitle = preferredEntryTitle && sectionEntries.some(entry => entry.title === preferredEntryTitle) ? preferredEntryTitle : sectionEntries[0]?.title || "";
    setSection(topSectionKey);
    setSelectedLoreSectionTitle(nextSectionTitle);
    setSelectedLoreEntryTitle(resolvedEntryTitle);
    persistCurrentCompendiumNavState({
      section: topSectionKey,
      selectedLoreSectionTitle: nextSectionTitle,
      selectedLoreEntryTitle: resolvedEntryTitle
    });
  }, [customSections, loreSections, persistCurrentCompendiumNavState]);
  const selectLoreSection = React.useCallback((nextSectionTitle, preferredEntryTitle = null) => selectNarrativeSection("lore", nextSectionTitle, preferredEntryTitle), [selectNarrativeSection]);
  const selectCustomSection = React.useCallback((topSectionKey, nextSectionTitle, preferredEntryTitle = null) => selectNarrativeSection(topSectionKey, nextSectionTitle, preferredEntryTitle), [selectNarrativeSection]);
  const selectLoreEntry = React.useCallback((nextEntryTitle, nextSectionTitle = null) => {
    const resolvedSectionTitle = nextSectionTitle || selectedLoreSection?.title || selectedLoreSectionTitle;
    const resolvedTopSectionKey = section === "lore" || isCustomSectionKey(section) ? section : "lore";
    setSection(resolvedTopSectionKey);
    setSelectedLoreSectionTitle(resolvedSectionTitle);
    setSelectedLoreEntryTitle(nextEntryTitle);
    persistCurrentCompendiumNavState({
      section: resolvedTopSectionKey,
      selectedLoreSectionTitle: resolvedSectionTitle,
      selectedLoreEntryTitle: nextEntryTitle
    });
  }, [persistCurrentCompendiumNavState, section, selectedLoreSection, selectedLoreSectionTitle]);
  React.useEffect(() => {
    if (!isCompendiumLoaded) return;
    persistCurrentCompendiumNavState();
  }, [isCompendiumLoaded, persistCurrentCompendiumNavState]);
  const openFavoritesSection = React.useCallback(() => {
    setSection(FAVORITES_SECTION_KEY);
    persistCurrentCompendiumNavState({
      section: FAVORITES_SECTION_KEY
    });
  }, [persistCurrentCompendiumNavState]);
  const buildFavoriteDescriptor = React.useCallback(({
    topSectionKey = section,
    sectionTitle,
    entryTitle,
    blockType,
    blockIndex,
    blockText
  }) => {
    if (!topSectionKey || !sectionTitle || !entryTitle) return null;
    return normalizeCompendiumFavorite({
      favoriteKey: createCompendiumFavoriteKey({
        topSectionKey,
        sectionTitle,
        entryTitle,
        blockType,
        blockIndex
      }),
      topSectionKey,
      topSectionLabel: getCompendiumTopSectionLabel(topSectionKey, builtInTabs, customSections),
      sectionTitle,
      entryTitle,
      blockType,
      blockIndex,
      blockText
    });
  }, [builtInTabs, customSections, section]);
  const toggleFavorite = React.useCallback(async favorite => {
    const normalizedFavorite = normalizeCompendiumFavorite(favorite);
    if (!normalizedFavorite) return;
    const favoriteKey = normalizedFavorite.favoriteKey;
    const isRemoving = favoriteKeys.has(favoriteKey);
    queueFavoriteKey(favoriteKey);
    try {
      if (!currentUser?.id) {
        const nextFavorites = isRemoving ? favoriteItemsRef.current.filter(item => item.favoriteKey !== favoriteKey) : [{
          ...normalizedFavorite,
          createdAt: normalizedFavorite.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, ...favoriteItemsRef.current.filter(item => item.favoriteKey !== favoriteKey)];
        commitFavoriteItems(nextFavorites, null);
        setFavoriteMessage(isRemoving ? "Favorite removed from this browser." : "Favorite saved in this browser.");
        return;
      }
      if (isRemoving) {
        const {
          response,
          payload
        } = await fetchPirateJson(`/pyrrhic-war/favorites/${encodeURIComponent(favoriteKey)}`, {
          method: "DELETE"
        });
        if (!response.ok) throw new Error(payload.message || "Unable to remove that favorite.");
        commitFavoriteItems(favoriteItemsRef.current.filter(item => item.favoriteKey !== favoriteKey), currentUser.id);
        setFavoriteMessage(payload.message || "Favorite removed.");
        return;
      }
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/favorites", {
        method: "POST",
        body: JSON.stringify(normalizedFavorite)
      });
      if (!response.ok) throw new Error(payload.message || "Unable to save that favorite.");
      const savedFavorite = normalizeCompendiumFavorite(payload.favorite) || {
        ...normalizedFavorite,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      commitFavoriteItems([savedFavorite, ...favoriteItemsRef.current.filter(item => item.favoriteKey !== favoriteKey)], currentUser.id);
      setFavoriteMessage(payload.message || "Favorite saved.");
    } catch (error) {
      setFavoriteMessage(error instanceof Error ? error.message : "Unable to update favorites right now.");
    } finally {
      dequeueFavoriteKey(favoriteKey);
    }
  }, [commitFavoriteItems, currentUser, dequeueFavoriteKey, favoriteKeys, queueFavoriteKey]);
  const resolveFavoriteSource = React.useCallback(favorite => {
    if (!favorite) return null;
    if (favorite.topSectionKey === "classes") {
      const parsedPath = parseCompendiumFavoritePath(favorite.sectionTitle);
      return parsedPath.sectionTitle && parsedPath.entryTitle ? {
        topSectionKey: "classes",
        classGroupTitle: parsedPath.sectionTitle,
        className: parsedPath.entryTitle
      } : null;
    }
    if (favorite.topSectionKey === "equipment") {
      return {
        topSectionKey: "equipment",
        equipmentSectionKey: favorite.sectionTitle
      };
    }
    if (favorite.topSectionKey === "grid") {
      return {
        topSectionKey: "grid"
      };
    }
    const matchesFavorite = (topSectionKey, categories) => (Array.isArray(categories) ? categories : []).reduce((match, category) => {
      if (match) return match;
      if (category.title !== favorite.sectionTitle) return null;
      const entry = (Array.isArray(category.entries) ? category.entries : []).find(candidate => candidate.title === favorite.entryTitle);
      return entry ? {
        topSectionKey,
        sectionTitle: category.title,
        entryTitle: entry.title
      } : null;
    }, null);
    const exactMatch = favorite.topSectionKey === "lore" ? matchesFavorite("lore", loreSections) : matchesFavorite(favorite.topSectionKey, customSections.find(customSection => getCustomSectionKey(customSection.title) === favorite.topSectionKey)?.sections);
    if (exactMatch) return exactMatch;
    const loreMatch = matchesFavorite("lore", loreSections);
    if (loreMatch) return loreMatch;
    for (const customSection of customSections) {
      if (!isNarrativeCustomSectionType(customSection.type)) continue;
      const customMatch = matchesFavorite(getCustomSectionKey(customSection.title), customSection.sections);
      if (customMatch) return customMatch;
    }
    return null;
  }, [customSections, loreSections]);
  const openFavoriteSource = React.useCallback(favorite => {
    const resolvedSource = resolveFavoriteSource(favorite);
    if (!resolvedSource) {
      setFavoriteMessage("That favorite's source entry could not be found.");
      return;
    }
    setHighlightedFavoriteKey(favorite.favoriteKey);
    if (resolvedSource.topSectionKey === "classes") {
      setSection("classes");
      setSelectedGroupTitle(resolvedSource.classGroupTitle);
      setSelectedClassName(resolvedSource.className);
      persistCurrentCompendiumNavState({
        section: "classes",
        selectedGroupTitle: resolvedSource.classGroupTitle,
        selectedClassName: resolvedSource.className
      });
      return;
    }
    if (resolvedSource.topSectionKey === "equipment") {
      setSection("equipment");
      setEquipmentSection(resolvedSource.equipmentSectionKey === "armor" || resolvedSource.equipmentSectionKey === "shields" ? "armorShields" : resolvedSource.equipmentSectionKey);
      persistCurrentCompendiumNavState({
        section: "equipment",
        equipmentSection: resolvedSource.equipmentSectionKey === "armor" || resolvedSource.equipmentSectionKey === "shields" ? "armorShields" : resolvedSource.equipmentSectionKey
      });
      return;
    }
    if (resolvedSource.topSectionKey === "grid") {
      setSection("grid");
      persistCurrentCompendiumNavState({
        section: "grid"
      });
      return;
    }
    selectNarrativeSection(resolvedSource.topSectionKey, resolvedSource.sectionTitle, resolvedSource.entryTitle);
  }, [persistCurrentCompendiumNavState, resolveFavoriteSource, selectNarrativeSection]);
  React.useEffect(() => {
    if (!highlightedFavoriteKey || section === FAVORITES_SECTION_KEY) return;
    const selectorKey = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(highlightedFavoriteKey) : highlightedFavoriteKey.replace(/"/g, '\\"');
    const target = document.querySelector(`[data-favorite-key="${selectorKey}"]`);
    if (!target) return;
    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, [highlightedFavoriteKey, section, selectedLoreEntryTitle, selectedLoreSectionTitle]);
  const clearPendingReorderHold = React.useCallback(() => {
    if (reorderHoldTimerRef.current) {
      window.clearTimeout(reorderHoldTimerRef.current);
      reorderHoldTimerRef.current = null;
    }
    reorderHoldTargetRef.current = null;
  }, []);
  const consumeSuppressedHeldClick = React.useCallback(() => {
    if (!suppressHeldClickRef.current) return false;
    suppressHeldClickRef.current = false;
    return true;
  }, []);
  const startReorderHold = React.useCallback((event, config) => {
    if (!editToolsVisible || !config?.id || !config?.kind || !config?.scope) return;
    if (typeof event.button === "number" && event.button !== 0) return;
    clearPendingReorderHold();
    const target = event.currentTarget;
    reorderHoldTargetRef.current = target;
    reorderHoldTimerRef.current = window.setTimeout(() => {
      suppressHeldClickRef.current = true;
      const rect = target.getBoundingClientRect();
      setReorderState({
        draggedId: config.id,
        kind: config.kind,
        scope: config.scope,
        label: target.textContent || "",
        width: rect.width,
        height: rect.height,
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      });
      if (typeof target?.setPointerCapture === "function") {
        try {
          target.setPointerCapture(event.pointerId);
        } catch (_error) {}
      }
      reorderHoldTimerRef.current = null;
    }, REORDER_HOLD_DELAY_MS);
  }, [clearPendingReorderHold, editToolsVisible]);
  const findExpandedReorderTarget = React.useCallback((clientX, clientY, activeReorderState) => {
    if (!activeReorderState) return null;
    const selector = `[data-reorder-kind="${activeReorderState.kind}"][data-reorder-scope="${activeReorderState.scope}"]`;
    const candidates = [...document.querySelectorAll(selector)].filter(element => element.getAttribute("data-reorder-id") !== activeReorderState.draggedId);
    let bestMatch = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    candidates.forEach(element => {
      const rect = element.getBoundingClientRect();
      const expandedLeft = rect.left - REORDER_TARGET_PADDING_PX;
      const expandedRight = rect.right + REORDER_TARGET_PADDING_PX;
      const expandedTop = rect.top - REORDER_TARGET_PADDING_PX;
      const expandedBottom = rect.bottom + REORDER_TARGET_PADDING_PX;
      if (clientX < expandedLeft || clientX > expandedRight || clientY < expandedTop || clientY > expandedBottom) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(clientX - centerX, clientY - centerY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = element;
      }
    });
    return bestMatch;
  }, []);
  const hasCrossedReorderThreshold = React.useCallback((draggedElement, targetElement, clientX, clientY) => {
    if (!draggedElement || !targetElement) return false;
    const draggedRect = draggedElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const draggedCenterX = draggedRect.left + draggedRect.width / 2;
    const draggedCenterY = draggedRect.top + draggedRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const horizontalDistance = Math.abs(targetCenterX - draggedCenterX);
    const verticalDistance = Math.abs(targetCenterY - draggedCenterY);
    if (horizontalDistance >= verticalDistance) {
      return targetCenterX >= draggedCenterX ? clientX >= targetCenterX : clientX <= targetCenterX;
    }
    return targetCenterY >= draggedCenterY ? clientY >= targetCenterY : clientY <= targetCenterY;
  }, []);
  const applyLocalReorder = React.useCallback((kind, scope, sourceId, targetId) => {
    if (kind === "tab") {
      setTabOrder(previousOrder => moveItemById(normalizeTabOrder(previousOrder, customSectionsRef.current), sourceId, targetId, value => value));
      return;
    }
    if (kind === "class-group") {
      setClassPageStructure(previousStructure => ({
        ...previousStructure,
        groups: moveItemById(Array.isArray(previousStructure?.groups) ? previousStructure.groups : [], sourceId, targetId, group => group.key)
      }));
      return;
    }
    if (kind === "category") {
      if (scope === "lore") {
        setLoreSections(previousSections => moveItemById(previousSections, sourceId, targetId, sectionData => sectionData.title));
        return;
      }
      const tabTitle = decodeURIComponent(scope.replace(/^custom:/, ""));
      setCustomSections(previousTabs => previousTabs.map(tab => tab.title !== tabTitle ? tab : {
        ...tab,
        sections: moveItemById(Array.isArray(tab.sections) ? tab.sections : [], sourceId, targetId, sectionData => sectionData.title)
      }));
      return;
    }
    if (kind === "entry") {
      if (scope.startsWith("lore::")) {
        const sectionTitle = decodeURIComponent(scope.slice("lore::".length));
        setLoreSections(previousSections => previousSections.map(sectionData => sectionData.title !== sectionTitle ? sectionData : {
          ...sectionData,
          entries: moveItemById(Array.isArray(sectionData.entries) ? sectionData.entries : [], sourceId, targetId, entry => entry.title)
        }));
        return;
      }
      const [encodedTabTitle, encodedSectionTitle] = scope.replace(/^custom-entry::/, "").split("::");
      const tabTitle = decodeURIComponent(encodedTabTitle || "");
      const sectionTitle = decodeURIComponent(encodedSectionTitle || "");
      setCustomSections(previousTabs => previousTabs.map(tab => tab.title !== tabTitle ? tab : {
        ...tab,
        sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title !== sectionTitle ? sectionData : {
          ...sectionData,
          entries: moveItemById(Array.isArray(sectionData.entries) ? sectionData.entries : [], sourceId, targetId, entry => entry.title)
        })
      }));
    }
  }, []);
  const persistReorder = React.useCallback(async activeReorderState => {
    if (!activeReorderState) return;
    if (activeReorderState.kind === "tab") {
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/compendium/reorder-tabs", {
        method: "POST",
        body: JSON.stringify({
          orderedKeys: normalizeTabOrder(tabOrderRef.current, customSectionsRef.current)
        })
      });
      if (!response.ok) {
        window.alert(payload.message || "Unable to rearrange those tabs.");
      }
      return;
    }
    if (activeReorderState.kind === "class-group") {
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/compendium/reorder-class-page-groups", {
        method: "POST",
        body: JSON.stringify({
          orderedKeys: (Array.isArray(classPageStructureRef.current?.groups) ? classPageStructureRef.current.groups : []).map(group => group.key)
        })
      });
      if (!response.ok) {
        window.alert(payload.message || "Unable to rearrange those classes categories.");
      }
      return;
    }
    if (activeReorderState.kind === "category") {
      if (activeReorderState.scope === "lore") {
        const {
          response,
          payload
        } = await fetchPirateJson("/pyrrhic-war/compendium/reorder-lore-sections", {
          method: "POST",
          body: JSON.stringify({
            orderedTitles: loreSectionsRef.current.map(sectionData => sectionData.title)
          })
        });
        if (!response.ok) {
          window.alert(payload.message || "Unable to rearrange those categories.");
        }
        return;
      }
      const tabTitle = decodeURIComponent(activeReorderState.scope.replace(/^custom:/, ""));
      const activeTab = customSectionsRef.current.find(tab => tab.title === tabTitle);
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/compendium/reorder-custom-section-categories", {
        method: "POST",
        body: JSON.stringify({
          tabTitle,
          orderedTitles: (Array.isArray(activeTab?.sections) ? activeTab.sections : []).map(sectionData => sectionData.title)
        })
      });
      if (!response.ok) {
        window.alert(payload.message || "Unable to rearrange those categories.");
      }
      return;
    }
    if (activeReorderState.kind === "entry") {
      if (activeReorderState.scope.startsWith("lore::")) {
        const sectionTitle = decodeURIComponent(activeReorderState.scope.slice("lore::".length));
        const activeSection = loreSectionsRef.current.find(sectionData => sectionData.title === sectionTitle);
        const {
          response,
          payload
        } = await fetchPirateJson("/pyrrhic-war/compendium/reorder-lore-entries", {
          method: "POST",
          body: JSON.stringify({
            sectionTitle,
            orderedTitles: (Array.isArray(activeSection?.entries) ? activeSection.entries : []).map(entry => entry.title)
          })
        });
        if (!response.ok) {
          window.alert(payload.message || "Unable to rearrange those subcategories.");
        }
        return;
      }
      const [encodedTabTitle, encodedSectionTitle] = activeReorderState.scope.replace(/^custom-entry::/, "").split("::");
      const tabTitle = decodeURIComponent(encodedTabTitle || "");
      const sectionTitle = decodeURIComponent(encodedSectionTitle || "");
      const activeTab = customSectionsRef.current.find(tab => tab.title === tabTitle);
      const activeSection = Array.isArray(activeTab?.sections) ? activeTab.sections.find(sectionData => sectionData.title === sectionTitle) : null;
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/compendium/reorder-custom-section-entries", {
        method: "POST",
        body: JSON.stringify({
          tabTitle,
          sectionTitle,
          orderedTitles: (Array.isArray(activeSection?.entries) ? activeSection.entries : []).map(entry => entry.title)
        })
      });
      if (!response.ok) {
        window.alert(payload.message || "Unable to rearrange those subcategories.");
      }
    }
  }, []);
  React.useEffect(() => {
    if (!reorderState) return;
    const handlePointerMove = event => {
      setReorderState(previousState => previousState ? {
        ...previousState,
        pointerX: event.clientX,
        pointerY: event.clientY
      } : previousState);
      const selector = `[data-reorder-kind="${reorderState.kind}"][data-reorder-scope="${reorderState.scope}"]`;
      const draggedElement = [...document.querySelectorAll(selector)].find(element => element.getAttribute("data-reorder-id") === reorderState.draggedId) || null;
      const hoveredButton = findExpandedReorderTarget(event.clientX, event.clientY, reorderState) || document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-reorder-id][data-reorder-kind][data-reorder-scope]");
      if (!hoveredButton) return;
      const targetId = hoveredButton.getAttribute("data-reorder-id") || "";
      const targetKind = hoveredButton.getAttribute("data-reorder-kind") || "";
      const targetScope = hoveredButton.getAttribute("data-reorder-scope") || "";
      if (!targetId || targetKind !== reorderState.kind || targetScope !== reorderState.scope || targetId === reorderState.draggedId) return;
      if (!hasCrossedReorderThreshold(draggedElement, hoveredButton, event.clientX, event.clientY)) return;
      applyLocalReorder(reorderState.kind, reorderState.scope, reorderState.draggedId, targetId);
    };
    const finishReorder = () => {
      clearPendingReorderHold();
      const activeState = reorderState;
      setReorderState(null);
      persistReorder(activeState);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishReorder);
    window.addEventListener("pointercancel", finishReorder);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishReorder);
      window.removeEventListener("pointercancel", finishReorder);
    };
  }, [applyLocalReorder, clearPendingReorderHold, findExpandedReorderTarget, hasCrossedReorderThreshold, persistReorder, reorderState]);
  const getReorderableButtonProps = React.useCallback((baseProps, reorderConfig, onActivate) => {
    const nextProps = {
      ...baseProps,
      onClick: event => {
        if (consumeSuppressedHeldClick()) {
          event.preventDefault();
          return;
        }
        onActivate();
      }
    };
    if (!editToolsVisible || !reorderConfig?.id || !reorderConfig?.kind || !reorderConfig?.scope) {
      return nextProps;
    }
    const isActiveReorderTarget = reorderState?.kind === reorderConfig.kind && reorderState?.scope === reorderConfig.scope && reorderState?.draggedId === reorderConfig.id;
    return {
      ...nextProps,
      className: `${baseProps.className ? `${baseProps.className} ` : ""}compendiumReorderTarget${isActiveReorderTarget ? " compendiumReorderPlaceholder" : ""}`,
      title: baseProps.title || "Hold to move",
      "data-reorder-id": reorderConfig.id,
      "data-reorder-kind": reorderConfig.kind,
      "data-reorder-scope": reorderConfig.scope,
      onPointerDown: event => startReorderHold(event, reorderConfig),
      onPointerUp: clearPendingReorderHold,
      onPointerCancel: clearPendingReorderHold
    };
  }, [clearPendingReorderHold, consumeSuppressedHeldClick, editToolsVisible, reorderState, startReorderHold]);
  const navigateNarrativeReference = React.useCallback(referenceText => {
    const normalizedReference = String(referenceText || "").trim().toLowerCase();
    if (!normalizedReference) return false;
    const prioritizedTargets = [];
    const pushMatch = target => {
      if (target.normalizedTitle === normalizedReference) {
        prioritizedTargets.push(target);
      }
    };
    narrativeLinkTargets.filter(target => target.topSectionKey === section).forEach(pushMatch);
    narrativeLinkTargets.filter(target => target.topSectionKey === "lore").forEach(pushMatch);
    narrativeLinkTargets.filter(target => target.topSectionKey !== section && target.topSectionKey !== "lore").forEach(pushMatch);
    const target = prioritizedTargets[0];
    if (!target) return false;
    if (target.topSectionKey === "lore") {
      if (target.kind === "entry" && target.entryTitle) {
        selectLoreEntry(target.entryTitle, target.sectionTitle);
      } else {
        selectLoreSection(target.sectionTitle, target.entryTitle || null);
      }
      return true;
    }
    if (target.kind === "entry" && target.entryTitle) {
      selectCustomSection(target.topSectionKey, target.sectionTitle, target.entryTitle);
    } else {
      selectCustomSection(target.topSectionKey, target.sectionTitle, target.entryTitle || null);
    }
    return true;
  }, [narrativeLinkTargets, section, selectCustomSection, selectLoreEntry, selectLoreSection]);
  const handleSearchResultSelect = React.useCallback(result => {
    if (!result) return;
    if (result.kind === "grid") {
      setSection("grid");
      setSearchQuery("");
      return;
    }
    if (result.kind === "customTab" || result.kind === "customSection" || result.kind === "customEntry") {
      const nextTopKey = getCustomSectionKey(result.tabTitle);
      if (!result.sectionTitle) {
        setSection(nextTopKey);
        setSearchQuery("");
        return;
      }
      selectCustomSection(nextTopKey, result.sectionTitle || "", result.entryTitle || null);
      setSearchQuery("");
      return;
    }
    if (result.kind === "loreSection") {
      selectLoreSection(result.sectionTitle);
      setSearchQuery("");
      return;
    }
    if (result.kind === "loreEntry") {
      selectLoreEntry(result.entryTitle, result.sectionTitle);
      setSearchQuery("");
    }
  }, [selectCustomSection, selectLoreEntry, selectLoreSection]);
  const searchResults = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const results = [];
    const pushResult = (result, searchText) => {
      const haystack = String(searchText || "").toLowerCase();
      const index = haystack.indexOf(query);
      if (index < 0) return;
      const title = String(result.title || "");
      const lowerTitle = title.toLowerCase();
      const score = lowerTitle === query ? 0 : lowerTitle.startsWith(query) ? 1 : index + 2;
      results.push({
        ...result,
        score
      });
    };
    if (builtInTabs.grid?.visible !== false) {
      grid.forEach(grid => {
        const entryTitle = getGridEntryDisplayName(grid, gridSchema);
        pushResult({
          kind: "grid",
          title: entryTitle,
          meta: "Grid"
        }, Object.values(JSON.parse(serializeGridEntryForEditor(grid, gridSchema))).flat().join(" "));
      });
    }
    if (builtInTabs.lore?.visible !== false) {
      loreSections.forEach(loreSection => {
        pushResult({
          kind: "loreSection",
          title: loreSection.title,
          meta: "Lore Category",
          sectionTitle: loreSection.title
        }, loreSection.title);
        (Array.isArray(loreSection.entries) ? loreSection.entries : []).forEach(entry => {
          pushResult({
            kind: "loreEntry",
            title: entry.title,
            meta: loreSection.title,
            sectionTitle: loreSection.title,
            entryTitle: entry.title
          }, `${entry.title} ${entry.content || ""}`);
        });
      });
    }
    customSections.forEach(customSection => {
      const customType = normalizeCustomSectionType(customSection.type);
      const firstSectionTitle = Array.isArray(customSection.sections) ? customSection.sections[0]?.title || "" : "";
      pushResult({
        kind: "customTab",
        title: customSection.title,
        meta: customType === "grid" ? "Grid Tab" : "Normal Tab",
        tabTitle: customSection.title,
        sectionTitle: customType === "grid" ? "" : firstSectionTitle
      }, customSection.title);
      if (customType === "grid") return;
      (Array.isArray(customSection.sections) ? customSection.sections : []).forEach(sectionData => {
        const sectionGridSchema = normalizeGridSchema(sectionData?.gridSchema);
        pushResult({
          kind: "customSection",
          title: sectionData.title,
          meta: customSection.title,
          tabTitle: customSection.title,
          sectionTitle: sectionData.title
        }, `${customSection.title} ${sectionData.title}`);
        (Array.isArray(sectionData.entries) ? sectionData.entries : []).forEach(entry => {
          const isGridEntry = isGridCustomEntry(entry, sectionData?.type || customType);
          const entryTitle = isGridEntry ? getGridEntryDisplayName(entry, sectionGridSchema) : entry.title;
          pushResult({
            kind: "customEntry",
            title: entryTitle,
            meta: `${customSection.title} / ${sectionData.title}`,
            tabTitle: customSection.title,
            sectionTitle: sectionData.title,
            entryTitle: entry.title
          }, isGridEntry ? `${customSection.title} ${sectionData.title} ${Object.values(JSON.parse(serializeGridEntryForEditor(entry, sectionGridSchema))).flat().join(" ")}` : `${customSection.title} ${sectionData.title} ${entry.title} ${entry.content || ""}`);
        });
      });
    });
    return results.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title)).slice(0, 12);
  }, [builtInTabs, grid, customSections, loreSections, searchQuery]);

  const classAbilityRanks = React.useMemo(() => {
    const ranks = new Map();
    classAbilities
      .filter(ability => ability.class === selectedClassName && !isSelectionAbility(ability) && !isSelectionCategory(ability))
      .sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0) || String(a.name).localeCompare(String(b.name)))
      .forEach(ability => {
        const rank = Number(ability.rank) || 0;
        if (!ranks.has(rank)) ranks.set(rank, []);
        ranks.get(rank).push(ability);
      });
    return [...ranks.entries()];
  }, [classAbilities, selectedClassName]);
  const classSelectionCategories = React.useMemo(() => {
    const categories = new Map();
    classAbilities.filter(ability => ability.class === selectedClassName && isSelectionCategory(ability)).forEach(category => {
      if (category.categoryKey) {
        categories.set(category.categoryKey, category);
      }
    });
    return categories;
  }, [classAbilities, selectedClassName]);
  const classSelectionAbilities = React.useMemo(() => classAbilities.filter(ability => ability.class === selectedClassName && isSelectionAbility(ability)).sort((a, b) => {
    const categoryCompare = String(a.selectionOption || "").localeCompare(String(b.selectionOption || ""));
    return categoryCompare || (Number(a.rank) || 0) - (Number(b.rank) || 0) || String(a.name).localeCompare(String(b.name));
  }), [classAbilities, selectedClassName]);

  const weaponTypes = React.useMemo(() => uniqueSortedValues(weapons.flatMap(weapon => weapon.type || [])), [weapons]);
  const damageTypes = React.useMemo(() => uniqueSortedValues(weapons.map(weapon => weapon.damage?.type)), [weapons]);
  const evasionCosts = React.useMemo(() => uniqueSortedValues(weapons.map(weapon => String(weapon.enduranceCost ?? ""))), [weapons]);
  const damageDice = React.useMemo(() => uniqueSortedValues(weapons.map(weapon => weapon.damage?.dice)), [weapons]);
  const weaponProperties = React.useMemo(() => uniqueSortedValues(weapons.flatMap(weapon => weapon.properties || []).map(getPropertyFilterLabel)), [weapons]);
  const equipmentPropertyLookup = React.useMemo(() => {
    const lookup = new Map();
    equipmentProperties.forEach(property => {
      const propertyName = String(property?.name || "").trim();
      if (!propertyName) return;
      lookup.set(propertyName.toLowerCase(), property);
    });
    return lookup;
  }, [equipmentProperties]);

  const filteredWeapons = React.useMemo(() => {
    const filtered = weapons.filter(weapon => {
      const weaponTypeList = weapon.type || [];
      const weaponPropertyList = weapon.properties || [];
      const weaponPropertyFilterList = weaponPropertyList.map(getPropertyFilterLabel);
      if (weaponTypeFilters.length > 0) {
        const matchesType = weaponTypeFilterMode === "and" ? weaponTypeFilters.every(type => weaponTypeList.includes(type)) : weaponTypeFilters.some(type => weaponTypeList.includes(type));
        if (!matchesType) return false;
      }
      if (damageTypeFilter && weapon.damage?.type !== damageTypeFilter) return false;
      if (evasionCostFilter && String(weapon.enduranceCost ?? "") !== evasionCostFilter) return false;
      if (damageFilter && weapon.damage?.dice !== damageFilter) return false;
      if (propertyFilters.length > 0) {
        const matchesProperties = propertyFilterMode === "and" ? propertyFilters.every(property => weaponPropertyFilterList.includes(property)) : propertyFilters.some(property => weaponPropertyFilterList.includes(property));
        if (!matchesProperties) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (weaponSortBy === "type") return (a.type || []).join(", ").localeCompare((b.type || []).join(", ")) || a.name.localeCompare(b.name);
      if (weaponSortBy === "damageType") return String(a.damage?.type || "").localeCompare(String(b.damage?.type || "")) || a.name.localeCompare(b.name);
      if (weaponSortBy === "enduranceCost") return (Number(a.enduranceCost) || 0) - (Number(b.enduranceCost) || 0) || a.name.localeCompare(b.name);
      if (weaponSortBy === "damage") return getWeaponDamageScore(a) - getWeaponDamageScore(b) || a.name.localeCompare(b.name);
      if (weaponSortBy === "properties") return (a.properties || []).join(", ").localeCompare((b.properties || []).join(", ")) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [weapons, weaponSortBy, weaponTypeFilters, weaponTypeFilterMode, damageTypeFilter, evasionCostFilter, damageFilter, propertyFilters, propertyFilterMode]);

  const resetWeaponFilters = () => {
    setWeaponTypeFilters([]);
    setWeaponTypeFilterMode("or");
    setDamageTypeFilter("");
    setEvasionCostFilter("");
    setDamageFilter("");
    setPropertyFilters([]);
    setPropertyFilterMode("or");
  };
  const toggleFilterValue = (value, setter) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };
  const addFilterValue = (value, setter) => {
    if (!value) return;
    setter(prev => prev.includes(value) ? prev : [...prev, value]);
  };
  const removeFilterValue = (value, setter) => {
    setter(prev => prev.filter(item => item !== value));
  };
  const weaponTableHeaders = ["Name", "Type", "Attack Stat", "Damage", "Damage Type", "Evasion Cost", "Properties"];
  const renderEquipmentPropertyValue = propertyText => {
    const exactMatch = equipmentPropertyLookup.get(String(propertyText || "").trim().toLowerCase());
    const filterMatch = equipmentPropertyLookup.get(getPropertyFilterLabel(propertyText).toLowerCase());
    const propertyDefinition = exactMatch || filterMatch || null;
    return React.createElement("span", {
      key: String(propertyText || ""),
      className: propertyDefinition ? "compendiumPropertyTag hasTooltip" : "compendiumPropertyTag",
      title: propertyDefinition?.description || undefined
    }, propertyText, propertyDefinition ? React.createElement("span", {
      className: "compendiumPropertyTooltip"
    }, React.createElement("strong", null, propertyDefinition.name), propertyDefinition.description ? React.createElement("span", null, propertyDefinition.description) : null) : null);
  };
  const renderEquipmentPropertyList = properties => {
    const propertyList = Array.isArray(properties) ? properties.filter(Boolean) : [];
    if (propertyList.length === 0) return "";
    return React.createElement("div", {
      className: "compendiumPropertyList"
    }, propertyList.map(renderEquipmentPropertyValue));
  };
  const renderFavoriteCard = React.useCallback((favorite, className, content, options = {}) => {
    const {
      showFavoriteButton = true
    } = options;
    const favoriteKey = favorite?.favoriteKey || "";
    const isFavorited = favorite ? favoriteKeys.has(favoriteKey) : false;
    const isFavoritePending = favorite ? favoritePendingKeySet.has(favoriteKey) : false;
    return React.createElement("article", {
      key: favoriteKey || className,
      className: `${className}${highlightedFavoriteKey === favoriteKey ? " compendiumFavoriteBlockTarget" : ""}`,
      "data-favorite-key": favoriteKey || undefined
    }, showFavoriteButton ? React.createElement("button", {
      type: "button",
      className: `compendiumFavoriteStar compendiumFavoriteCardStar${isFavorited ? " active" : ""}`,
      onClick: () => favorite && toggleFavorite(favorite),
      disabled: !favorite || isFavoritePending,
      title: isFavorited ? "Remove favorite" : "Add favorite"
    }, isFavorited ? "\u2605" : "\u2606") : null, content);
  }, [favoriteKeys, favoritePendingKeySet, highlightedFavoriteKey, toggleFavorite]);
  const renderFavoriteRowButton = React.useCallback(favorite => {
    const favoriteKey = favorite?.favoriteKey || "";
    const isFavorited = favorite ? favoriteKeys.has(favoriteKey) : false;
    const isFavoritePending = favorite ? favoritePendingKeySet.has(favoriteKey) : false;
    return React.createElement("button", {
      type: "button",
      className: `compendiumFavoriteStar compendiumFavoriteRowStar${isFavorited ? " active" : ""}`,
      onClick: () => favorite && toggleFavorite(favorite),
      disabled: !favorite || isFavoritePending,
      title: isFavorited ? "Remove favorite" : "Add favorite"
    }, isFavorited ? "\u2605" : "\u2606");
  }, [favoriteKeys, favoritePendingKeySet, toggleFavorite]);
  const renderWeaponRow = weapon => {
    const favorite = buildFavoriteDescriptor({
      topSectionKey: "equipment",
      sectionTitle: "weapons",
      entryTitle: weapon.name,
      blockType: "weapon",
      blockIndex: 0,
      blockText: [weapon.name, (weapon.type || []).join(", "), weapon.damage?.dice || "", weapon.damage?.type || "", weapon.enduranceCost != null ? `Endurance ${weapon.enduranceCost}` : "", (weapon.properties || []).join(", ")].filter(Boolean).join("\n")
    });
    return React.createElement("tr", {
      key: weapon.name,
      className: highlightedFavoriteKey === favorite?.favoriteKey ? "compendiumFavoriteRowTarget" : "",
      "data-favorite-key": favorite?.favoriteKey || undefined
    }, React.createElement("td", {
      className: "compendiumFavoriteTableCell"
    }, renderFavoriteRowButton(favorite)), React.createElement("td", null, weapon.name), React.createElement("td", null, (weapon.type || []).join(", ")), React.createElement("td", null, (weapon.attackStats || []).join(", ")), React.createElement("td", null, weapon.damage?.dice || ""), React.createElement("td", null, weapon.damage?.type || ""), React.createElement("td", null, weapon.enduranceCost), React.createElement("td", null, renderEquipmentPropertyList(weapon.properties)), canEdit ? React.createElement("td", null, editButton("weapons", weapon)) : null);
  };
  const renderArmorRow = armor => {
    const favorite = buildFavoriteDescriptor({
      topSectionKey: "equipment",
      sectionTitle: "armor",
      entryTitle: armor.name,
      blockType: "armor",
      blockIndex: 0,
      blockText: [armor.name, armor.baseEvasion != null ? `Base Evasion ${armor.baseEvasion}` : "", armor.toughness != null ? `Toughness ${armor.toughness}` : "", armor.dashPenalty != null ? `Dash Penalty ${armor.dashPenalty}` : "", (armor.properties || []).join(", ")].filter(Boolean).join("\n")
    });
    return React.createElement("tr", {
      key: armor.name,
      className: highlightedFavoriteKey === favorite?.favoriteKey ? "compendiumFavoriteRowTarget" : "",
      "data-favorite-key": favorite?.favoriteKey || undefined
    }, React.createElement("td", {
      className: "compendiumFavoriteTableCell"
    }, renderFavoriteRowButton(favorite)), React.createElement("td", null, armor.name), React.createElement("td", null, armor.baseEvasion ?? ""), React.createElement("td", null, armor.toughness ?? ""), React.createElement("td", null, armor.dashPenalty ?? 0), React.createElement("td", null, renderEquipmentPropertyList(armor.properties)), canEdit ? React.createElement("td", null, editButton("armors", armor)) : null);
  };
  const renderShieldRow = shield => {
    const favorite = buildFavoriteDescriptor({
      topSectionKey: "equipment",
      sectionTitle: "shields",
      entryTitle: shield.name,
      blockType: "shield",
      blockIndex: 0,
      blockText: [shield.name, shield.toughness != null ? `Toughness ${shield.toughness}` : "", shield.braceCost != null ? `Brace Endurance ${shield.braceCost}` : "", shield.dashPenalty != null ? `Dash Penalty ${shield.dashPenalty}` : "", (shield.properties || []).join(", ")].filter(Boolean).join("\n")
    });
    return React.createElement("tr", {
      key: shield.name,
      className: highlightedFavoriteKey === favorite?.favoriteKey ? "compendiumFavoriteRowTarget" : "",
      "data-favorite-key": favorite?.favoriteKey || undefined
    }, React.createElement("td", {
      className: "compendiumFavoriteTableCell"
    }, renderFavoriteRowButton(favorite)), React.createElement("td", null, shield.name), React.createElement("td", null, shield.toughness ?? ""), React.createElement("td", null, shield.braceCost ?? ""), React.createElement("td", null, shield.dashPenalty ?? 0), React.createElement("td", null, renderEquipmentPropertyList(shield.properties)), canEdit ? React.createElement("td", null, editButton("shields", shield)) : null);
  };
  const multiFilterGroup = (label, values, selectedValues, setSelectedValues, mode, setMode) => React.createElement("div", {
    className: "compendiumMultiFilter"
  }, React.createElement("div", {
    className: "compendiumMultiFilterHeader"
  }, React.createElement("span", null, label), React.createElement("div", {
    className: "compendiumFilterMode"
  }, ["or", "and"].map(nextMode => React.createElement("button", {
    key: nextMode,
    type: "button",
    className: mode === nextMode ? "active" : "",
    onClick: () => setMode(nextMode)
  }, nextMode.toUpperCase())))), React.createElement("select", {
    value: "",
    onChange: event => addFilterValue(event.target.value, setSelectedValues)
  }, React.createElement("option", {
    value: ""
  }, `Add ${label}`), values.filter(value => !selectedValues.includes(value)).map(value => React.createElement("option", {
    key: value,
    value
  }, value))), React.createElement("div", {
    className: "compendiumFilterChips"
  }, selectedValues.length === 0 ? React.createElement("span", {
    className: "compendiumFilterEmpty"
  }, "No selections") : selectedValues.map(value => React.createElement("span", {
    key: value,
    className: "compendiumFilterChip"
  }, React.createElement("span", null, value), React.createElement("button", {
    type: "button",
    onClick: () => removeFilterValue(value, setSelectedValues),
    "aria-label": `Remove ${value}`
  }, "x")))));
  const openEditDialog = (collection, entry) => {
    const isGridEntry = collection === "grid" || collection === "customSections" && isGridCustomEntry(entry, selectedLoreSection?.type || activeCustomSectionType);
    const dialogGridSchema = collection === "grid" ? gridSchema : activeGridSchema;
    setEditDialog({
      mode: "edit",
      collection,
      key: getEntryKey(collection, entry),
      entry
    });
    setEditText(collection === "loreSections" || collection === "customSections" && !isGridEntry ? String(entry.content || "") : isGridEntry ? serializeGridEntryForEditor(entry, dialogGridSchema) : JSON.stringify(entry, null, 2));
    setActiveGridParagraphFieldKey("");
    setEditMessage("");
  };
  const openAddDialog = (collection, entry) => {
    const isGridEntry = collection === "grid" || collection === "customSections" && isGridCustomEntry(entry, selectedLoreSection?.type || activeCustomSectionType);
    const dialogGridSchema = collection === "grid" ? gridSchema : activeGridSchema;
    setEditDialog({
      mode: "add",
      collection,
      entry
    });
    setEditText(collection === "loreSections" || collection === "customSections" && !isGridEntry ? String(entry.content || "") : isGridEntry ? serializeGridEntryForEditor(entry, dialogGridSchema) : JSON.stringify(entry, null, 2));
    setActiveGridParagraphFieldKey("");
    setEditMessage("");
  };
  const closeEditDialog = () => {
    if (isSavingEdit) return;
    setEditDialog(null);
    setEditText("");
    setActiveGridParagraphFieldKey("");
    setEditMessage("");
  };
  const clearEditDialogState = () => {
    setEditDialog(null);
    setEditText("");
    setActiveGridParagraphFieldKey("");
    setEditMessage("");
  };
  const isGridCustomEditDialog = editDialog?.collection === "customSections" && isGridCustomEntry(editDialog?.entry, selectedLoreSection?.type || activeCustomSectionType);
  const isGridEntryEditDialog = editDialog?.collection === "grid" || isGridCustomEditDialog;
  const canDeleteEditDialogEntry = editDialog?.mode !== "add" && isGridEntryEditDialog;
  const activeEditDialogGridSchema = React.useMemo(() => editDialog?.collection === "grid" ? gridSchema : activeGridSchema, [activeGridSchema, editDialog, gridSchema]);
  const gridEntryEditorValues = React.useMemo(() => parseGridEditorObject(editText), [editText]);
  const gridSchemaDraftFields = React.useMemo(() => parseGridSchemaEditorFields(gridSchemaDraft), [gridSchemaDraft]);
  const updateGridEntryEditorValue = (field, value) => {
    const nextValues = {
      ...parseGridEditorObject(editText),
      [field.key]: normalizeGridFieldValueForType(field, value)
    };
    setEditText(JSON.stringify(nextValues, null, 2));
  };
  const updateGridSchemaDraftFields = nextFields => {
    setGridSchemaDraft(serializeGridSchemaEditorFields(nextFields));
    setGridSchemaMessage("");
  };
  const updateGridSchemaDraftField = (index, updates) => {
    const nextFields = gridSchemaDraftFields.map((field, fieldIndex) => {
      if (fieldIndex !== index) return field;
      const nextField = normalizeGridSchemaEditorField({
        ...field,
        ...updates
      }, index);
      if (nextField.type !== "select" && nextField.type !== "multiselect") {
        delete nextField.options;
      }
      return nextField;
    });
    updateGridSchemaDraftFields(nextFields);
  };
  const addGridSchemaDraftField = () => {
    updateGridSchemaDraftFields([...gridSchemaDraftFields, {
      key: `field${gridSchemaDraftFields.length + 1}`,
      label: `Field ${gridSchemaDraftFields.length + 1}`,
      type: "text",
      isTitle: gridSchemaDraftFields.length === 0
    }]);
  };
  const removeGridSchemaDraftField = index => {
    const nextFields = gridSchemaDraftFields.filter((_field, fieldIndex) => fieldIndex !== index);
    updateGridSchemaDraftFields(nextFields.length > 0 ? nextFields : [{
      key: "name",
      label: "Name",
      type: "text",
      isTitle: true
    }]);
  };
  const setGridSchemaTitleField = index => {
    updateGridSchemaDraftFields(gridSchemaDraftFields.map((field, fieldIndex) => ({
      ...field,
      isTitle: fieldIndex === index
    })));
  };
  const insertLoreSnippet = React.useCallback(snippet => {
    const editor = editTextareaRef.current;
    if (!editor) {
      setEditText(previousText => `${previousText}${snippet}`);
      return;
    }
    const selection = editor.tagName === "TEXTAREA" ? {
      start: editor.selectionStart ?? editText.length,
      end: editor.selectionEnd ?? editText.length
    } : getEditableTextSelectionOffsets(editor) || {
      start: editText.length,
      end: editText.length
    };
    const selectionStart = selection.start;
    const selectionEnd = selection.end;
    const nextValue = editText.slice(0, selectionStart) + snippet + editText.slice(selectionEnd);
    setEditText(nextValue);
    const nextCursorPosition = selectionStart + snippet.length;
    pendingLoreSelectionOffsetsRef.current = {
      start: nextCursorPosition,
      end: nextCursorPosition
    };
  }, [editText]);
  const prepareCompendiumImageUpload = React.useCallback(async file => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type || "")) {
      throw new Error("Compendium image uploads currently support PNG, JPEG, and WebP files.");
    }
    if (file.size > LORE_IMAGE_UPLOAD_MAX_BYTES) {
      throw new Error("Compendium image uploads must be 5 MB or smaller.");
    }
    const readFileAsDataUrl = inputFile => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Unable to read that image file."));
      reader.readAsDataURL(inputFile);
    });
    const loadImageElement = imageSource => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to process that image file."));
      image.src = imageSource;
    });
    const canvasToBlob = (canvas, type, quality) => new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), type, quality);
    });
    const blobToDataUrl = blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Unable to convert that image."));
      reader.readAsDataURL(blob);
    });
    const originalImageSource = await readFileAsDataUrl(file);
    if (!originalImageSource) {
      throw new Error("Unable to read that image file.");
    }
    const image = await loadImageElement(originalImageSource);
    const maxDimension = Math.max(image.naturalWidth || image.width || 0, image.naturalHeight || image.height || 0) || 1;
    const baseScale = Math.min(1, LORE_IMAGE_UPLOAD_MAX_DIMENSION / maxDimension);
    const resizePasses = [1, 0.85, 0.7, 0.55];
    const qualityPasses = [0.9, 0.8, 0.7, 0.6];
    let bestBlob = null;
    for (const resizeFactor of resizePasses) {
      const width = Math.max(1, Math.round((image.naturalWidth || image.width || 1) * baseScale * resizeFactor));
      const height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * baseScale * resizeFactor));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      for (const quality of qualityPasses) {
        const blob = await canvasToBlob(canvas, "image/webp", quality);
        if (!blob) continue;
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        if (blob.size <= LORE_IMAGE_UPLOAD_TARGET_BYTES) {
          bestBlob = blob;
          break;
        }
      }
      if (bestBlob && bestBlob.size <= LORE_IMAGE_UPLOAD_TARGET_BYTES) break;
    }
    const finalImageSource = bestBlob ? await blobToDataUrl(bestBlob) : originalImageSource;
    if (!finalImageSource) {
      throw new Error("Unable to prepare that image file.");
    }
    return {
      fileName: file.name,
      altText: String(file.name || "Lore image").replace(/\.[^.]+$/, "").trim() || "Lore image",
      imageDataUrl: finalImageSource,
      finalSizeKb: Math.round((bestBlob?.size || file.size) / 1024)
    };
  }, []);
  const uploadCompendiumImageFile = React.useCallback(async file => {
    const preparedImage = await prepareCompendiumImageUpload(file);
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/upload-image", {
      method: "POST",
      body: JSON.stringify({
        fileName: preparedImage.fileName,
        imageDataUrl: preparedImage.imageDataUrl
      })
    });
    if (!response.ok) {
      throw new Error(payload.message || "Unable to upload that compendium image.");
    }
    const imageUrl = String(payload.imageUrl || "").trim();
    const storedFileName = String(payload.fileName || "").trim();
    if (!imageUrl || !storedFileName) {
      throw new Error("The uploaded compendium image did not return a usable file path.");
    }
    return {
      fileName: storedFileName,
      imageUrl,
      altText: preparedImage.altText,
      finalSizeKb: preparedImage.finalSizeKb
    };
  }, [prepareCompendiumImageUpload]);
  const insertLoreImageFromFile = React.useCallback(async file => {
    try {
      const uploadedImage = await uploadCompendiumImageFile(file);
      if (isGridEntryEditDialog && activeGridParagraphFieldKey) {
        const field = normalizeGridSchema(activeEditDialogGridSchema).find(candidate => candidate.key === activeGridParagraphFieldKey);
        if (field) {
          const values = parseGridEditorObject(editText);
          const currentValue = String(values[field.key] || "");
          const snippet = `${currentValue && !currentValue.endsWith("\n") ? "\n" : ""}![${uploadedImage.altText}](${uploadedImage.imageUrl})\n`;
          updateGridEntryEditorValue(field, `${currentValue}${snippet}`);
          setEditMessage(`Uploaded image: ${uploadedImage.fileName} (${uploadedImage.finalSizeKb} KB) to compendium/images.`);
          return;
        }
      }
      if (isGridEntryEditDialog) {
        setEditMessage("Focus a paragraph field before uploading an image.");
        return;
      }
      const snippet = `${editText && !editText.endsWith("\n") ? "\n" : ""}![${uploadedImage.altText}](${uploadedImage.imageUrl})\n`;
      insertLoreSnippet(snippet);
      setEditMessage(`Uploaded image: ${uploadedImage.fileName} (${uploadedImage.finalSizeKb} KB) to compendium/images.`);
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : "Unable to upload that image file.");
    }
  }, [activeEditDialogGridSchema, activeGridParagraphFieldKey, editText, insertLoreSnippet, isGridEntryEditDialog, uploadCompendiumImageFile]);
  const uploadCompendiumImageToLibrary = React.useCallback(async file => {
    if (!file) return;
    setPendingImageName("__upload__");
    try {
      const uploadedImage = await uploadCompendiumImageFile(file);
      setCompendiumImageMessage(`Uploaded ${uploadedImage.fileName} (${uploadedImage.finalSizeKb} KB).`);
      await loadCompendiumImages();
    } catch (error) {
      setCompendiumImageMessage(error instanceof Error ? error.message : "Unable to upload that compendium image.");
    } finally {
      setPendingImageName("");
    }
  }, [loadCompendiumImages, uploadCompendiumImageFile]);
  const renameCompendiumImage = React.useCallback(async image => {
    if (!image?.fileName) return;
    const currentBaseName = String(image.fileName).replace(/\.[^.]+$/, "");
    const nextBaseName = window.prompt("Rename image to?", currentBaseName);
    if (nextBaseName == null) return;
    setPendingImageName(image.fileName);
    try {
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/compendium/rename-image", {
        method: "POST",
        body: JSON.stringify({
          currentFileName: image.fileName,
          nextFileName: nextBaseName
        })
      });
      if (!response.ok) {
        throw new Error(payload.message || "Unable to rename that compendium image.");
      }
      setCompendiumImageMessage(payload.message || "Compendium image renamed.");
      await loadCompendiumImages();
    } catch (error) {
      setCompendiumImageMessage(error instanceof Error ? error.message : "Unable to rename that compendium image.");
    } finally {
      setPendingImageName("");
    }
  }, [loadCompendiumImages]);
  const deleteCompendiumImage = React.useCallback(async image => {
    if (!image?.fileName) return;
    if (!window.confirm(`Delete ${image.fileName}?`)) return;
    setPendingImageName(image.fileName);
    try {
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/compendium/delete-image", {
        method: "POST",
        body: JSON.stringify({
          fileName: image.fileName
        })
      });
      if (!response.ok) {
        throw new Error(payload.message || "Unable to delete that compendium image.");
      }
      setCompendiumImageMessage(payload.message || "Compendium image deleted.");
      await loadCompendiumImages();
    } catch (error) {
      setCompendiumImageMessage(error instanceof Error ? error.message : "Unable to delete that compendium image.");
    } finally {
      setPendingImageName("");
    }
  }, [loadCompendiumImages]);
  const copyCompendiumImageLink = React.useCallback(async image => {
    if (!image?.fileName) return;
    const snippet = `![](${image.fileName})`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
      } else {
        throw new Error("Clipboard access is unavailable.");
      }
      setCompendiumImageMessage(`Copied lore image snippet for ${image.fileName}.`);
    } catch (_error) {
      setCompendiumImageMessage(`Lore image snippet: ${snippet}`);
    }
  }, []);
  const preserveLoreEditorSelection = React.useCallback(() => {
    const editor = editTextareaRef.current;
    if (!editor || document.activeElement !== editor || editor.tagName === "TEXTAREA") return;
    pendingLoreSelectionOffsetsRef.current = getEditableTextSelectionOffsets(editor) || pendingLoreSelectionOffsetsRef.current;
  }, []);
  React.useEffect(() => {
    const shouldSpellcheckLoreEditor = editDialog?.collection === "loreSections" || editDialog?.collection === "customSections" && !isGridCustomEditDialog;
    const gridParagraphFields = isGridEntryEditDialog ? normalizeGridSchema(activeEditDialogGridSchema).filter(field => field.type === "paragraph") : [];
    if (!shouldSpellcheckLoreEditor && gridParagraphFields.length === 0) {
      setLoreSpellcheckIssues([]);
      setLoreSpellcheckMenu(null);
      return;
    }
    const requestId = loreSpellcheckRequestRef.current + 1;
    loreSpellcheckRequestRef.current = requestId;
    const timeoutId = window.setTimeout(async () => {
      try {
        const gridValues = parseGridEditorObject(editText);
        const spellcheckTargets = shouldSpellcheckLoreEditor
          ? [{ text: editText }]
          : gridParagraphFields.map(field => ({
              fieldKey: field.key,
              text: String(gridValues[field.key] || "")
            })).filter(target => target.text.trim());
        const spellcheckResponses = await Promise.all(spellcheckTargets.map(target => fetchPirateJson("/pyrrhic-war/compendium/spellcheck", {
          method: "POST",
          body: JSON.stringify({
            text: target.text,
            includeCompendiumWords: shouldSpellcheckLoreEditor
          })
        }).then(result => ({
          ...result,
          fieldKey: target.fieldKey || ""
        }))));
        if (loreSpellcheckRequestRef.current !== requestId) return;
        if (spellcheckResponses.some(result => !result.response.ok)) {
          preserveLoreEditorSelection();
          setLoreSpellcheckIssues([]);
          return;
        }
        preserveLoreEditorSelection();
        setLoreSpellcheckIssues(spellcheckResponses.flatMap(result => (Array.isArray(result.payload.issues) ? result.payload.issues : []).map(issue => ({
          ...issue,
          fieldKey: result.fieldKey || undefined
        }))));
      } catch (_error) {
        if (loreSpellcheckRequestRef.current !== requestId) return;
        preserveLoreEditorSelection();
        setLoreSpellcheckIssues([]);
      }
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [activeEditDialogGridSchema, editDialog, editText, isGridCustomEditDialog, isGridEntryEditDialog, preserveLoreEditorSelection]);
  React.useEffect(() => {
    if (!loreSpellcheckMenu) return;
    const closeMenu = () => setLoreSpellcheckMenu(null);
    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [loreSpellcheckMenu]);
  const applyLoreSpellcheckSuggestion = React.useCallback((issue, suggestion) => {
    if (!issue || !suggestion) return;
    if (issue.fieldKey) {
      const field = normalizeGridSchema(activeEditDialogGridSchema).find(candidate => candidate.key === issue.fieldKey);
      if (field) {
        const values = parseGridEditorObject(editText);
        const currentValue = String(values[field.key] || "");
        const start = Math.max(0, Number(issue.start) || 0);
        const end = Math.max(start, Number(issue.end) || start);
        updateGridEntryEditorValue(field, currentValue.slice(0, start) + suggestion + currentValue.slice(end));
        setLoreSpellcheckMenu(null);
        return;
      }
    }
    const start = Math.max(0, Number(issue.start) || 0);
    const end = Math.max(start, Number(issue.end) || start);
    const nextValue = editText.slice(0, start) + suggestion + editText.slice(end);
    setEditText(nextValue);
    setLoreSpellcheckMenu(null);
    pendingLoreSelectionOffsetsRef.current = {
      start,
      end: start + suggestion.length
    };
  }, [activeEditDialogGridSchema, editText]);
  const handleLoreSpellcheckContextMenu = React.useCallback((event, fieldKey = "") => {
    if (!Array.isArray(loreSpellcheckIssues) || loreSpellcheckIssues.length === 0) {
      return;
    }
    const selection = event.currentTarget.tagName === "TEXTAREA" ? {
      start: event.currentTarget.selectionStart ?? 0,
      end: event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? 0
    } : getEditableTextSelectionOffsets(event.currentTarget) || {
      start: 0,
      end: 0
    };
    const selectionStart = selection.start;
    const selectionEnd = selection.end;
    const matchedIssue = loreSpellcheckIssues.filter(issue => String(issue?.fieldKey || "") === String(fieldKey || "")).find(issue => {
      const start = Math.max(0, Number(issue?.start) || 0);
      const end = Math.max(start, Number(issue?.end) || start);
      return selectionStart >= start && selectionStart <= end || selectionEnd > start && selectionStart < end;
    });
    if (!matchedIssue || !Array.isArray(matchedIssue.suggestions) || matchedIssue.suggestions.length === 0) {
      setLoreSpellcheckMenu(null);
      return;
    }
    event.preventDefault();
    setLoreSpellcheckMenu({
      x: event.clientX,
      y: event.clientY,
      issue: matchedIssue
    });
  }, [loreSpellcheckIssues]);
  React.useLayoutEffect(() => {
    const pendingSelection = pendingLoreSelectionOffsetsRef.current;
    const editor = editTextareaRef.current;
    if (!pendingSelection || !editor) {
      return;
    }
    editor.focus();
    if (editor.tagName === "TEXTAREA") {
      editor.selectionStart = pendingSelection.start;
      editor.selectionEnd = pendingSelection.end;
    } else {
      setEditableTextSelectionOffsets(editor, pendingSelection.start, pendingSelection.end);
    }
    pendingLoreSelectionOffsetsRef.current = null;
  }, [editText, loreSpellcheckIssues]);
  const saveEditDialog = async () => {
    if (!editDialog) return;
    let parsedEntry;
    if (editDialog.collection === "loreSections" || editDialog.collection === "customSections" && !isGridCustomEditDialog) {
      parsedEntry = {
        title: editDialog.key?.title || editDialog.entry?.title || "",
        content: editText
      };
    } else {
      try {
        parsedEntry = parseCompendiumJsonEditorText(editText);
      } catch (_error) {
        setEditMessage("The entry must be valid JSON.");
        return;
      }
      if (isGridEntryEditDialog) {
        try {
          parsedEntry = buildGridEntryFromSchemaValues(parsedEntry, editDialog.collection === "grid" ? gridSchema : activeGridSchema, {
            includeType: editDialog.collection === "customSections",
            fallbackTitle: editDialog.entry?.name || editDialog.entry?.title || editDialog.key?.name || editDialog.key?.title || ""
          });
        } catch (error) {
          setEditMessage(error instanceof Error ? error.message : "Grid entries need a name.");
          return;
        }
      }
    }
    setIsSavingEdit(true);
    setEditMessage("");
    // Persist the current location before the compendium file write completes,
    // so a dev-server reload can restore the exact same place.
    persistCurrentCompendiumNavState({
      showWriterTools
    });
    try {
      const isAdd = editDialog.mode === "add";
      const {
        response,
        payload
      } = await fetchPirateJson(isAdd ? "/pyrrhic-war/compendium/add-entry" : "/pyrrhic-war/compendium/update-entry", {
        method: "POST",
        body: JSON.stringify(isAdd ? {
          collection: editDialog.collection,
          entry: parsedEntry
        } : {
          collection: editDialog.collection,
          key: editDialog.key,
          entry: parsedEntry
        })
      });
      if (!response.ok) {
        setEditMessage(payload.message || "Unable to save that entry.");
        return;
      }
      if (editDialog.collection === "loreSections" || editDialog.collection === "customSections") {
        const nextLoreSectionTitle = editDialog.key?.sectionTitle || selectedLoreSectionTitle;
        const nextLoreEntryTitle = payload.entry?.title || editDialog.key?.title || selectedLoreEntryTitle;
        const nextTopSectionKey = editDialog.collection === "customSections" ? getCustomSectionKey(editDialog.key?.tabTitle || activeNarrativeTabTitle) : "lore";
        pendingLoreSelectionRef.current = {
          topSectionKey: nextTopSectionKey,
          sectionTitle: nextLoreSectionTitle,
          entryTitle: nextLoreEntryTitle
        };
        persistCurrentCompendiumNavState({
          section: nextTopSectionKey,
          selectedLoreSectionTitle: nextLoreSectionTitle,
          selectedLoreEntryTitle: nextLoreEntryTitle,
          showWriterTools
        });
        if (editDialog.collection === "customSections") {
          selectCustomSection(getCustomSectionKey(editDialog.key?.tabTitle || activeNarrativeTabTitle), nextLoreSectionTitle, nextLoreEntryTitle);
        } else {
          selectLoreSection(nextLoreSectionTitle, nextLoreEntryTitle);
        }
      } else {
        persistCurrentCompendiumNavState({
          section,
          equipmentSection,
          selectedGroupTitle,
          selectedClassName,
          selectedLoreSectionTitle,
          selectedLoreEntryTitle,
          showWriterTools
        });
      }
      if (isAdd) {
        if (editDialog.collection === "classAbilities") setClassAbilities(prev => [...prev, payload.entry]);
        if (editDialog.collection === "weapons") setWeapons(prev => [...prev, payload.entry]);
        if (editDialog.collection === "armors") setArmors(prev => [...prev, payload.entry]);
        if (editDialog.collection === "shields") setShields(prev => [...prev, payload.entry]);
        if (editDialog.collection === "equipmentProperties") setEquipmentProperties(prev => [...prev, payload.entry]);
        if (editDialog.collection === "grid") setGrid(prev => [...prev, payload.entry]);
        if (editDialog.collection === "loreSections") setLoreSections(prev => [...prev, payload.entry]);
        if (editDialog.collection === "customSections") setCustomSections(prev => [...prev, payload.entry]);
        closeEditDialog();
        return;
      }
      const replaceEntry = entry => {
        if (editDialog.collection === "classAbilities") {
          return entry.class === editDialog.key.class && Number(entry.rank) === Number(editDialog.key.rank) && entry.name === editDialog.key.name ? payload.entry : entry;
        }
        return entry.name === editDialog.key.name ? payload.entry : entry;
      };
      if (editDialog.collection === "classAbilities") setClassAbilities(prev => prev.map(replaceEntry));
      if (editDialog.collection === "weapons") setWeapons(prev => prev.map(replaceEntry));
      if (editDialog.collection === "armors") setArmors(prev => prev.map(replaceEntry));
      if (editDialog.collection === "shields") setShields(prev => prev.map(replaceEntry));
      if (editDialog.collection === "equipmentProperties") setEquipmentProperties(prev => prev.map(replaceEntry));
      if (editDialog.collection === "grid") setGrid(prev => prev.map(replaceEntry));
      if (editDialog.collection === "loreSections") setLoreSections(prev => prev.map(sectionData => {
        if (sectionData.title !== editDialog.key.sectionTitle) return sectionData;
        return {
          ...sectionData,
          entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).map(sectionEntry => sectionEntry.title === editDialog.key.title ? payload.entry : sectionEntry)
        };
      }));
      if (editDialog.collection === "customSections") setCustomSections(prev => prev.map(tab => tab.title !== editDialog.key.tabTitle ? tab : {
        ...tab,
        sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title !== editDialog.key.sectionTitle ? sectionData : {
          ...sectionData,
          entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).map(sectionEntry => sectionEntry.title === editDialog.key.title ? payload.entry : sectionEntry)
        })
      }));
      closeEditDialog();
    } catch (_error) {
      setEditMessage("Unable to save that entry.");
    } finally {
      setIsSavingEdit(false);
    }
  };
  const deleteEditDialogEntry = async () => {
    if (!canDeleteEditDialogEntry || !editDialog) return;
    const entryName = editDialog.collection === "grid" ? String(editDialog.key?.name || editDialog.entry?.name || "").trim() : String(editDialog.key?.title || editDialog.entry?.title || "").trim();
    if (!entryName) return;
    if (!window.confirm(`Remove "${entryName}"?`)) return;
    setIsSavingEdit(true);
    setEditMessage("");
    try {
      if (editDialog.collection === "grid") {
        const {
          response,
          payload
        } = await fetchPirateJson("/pyrrhic-war/compendium/delete-entry", {
          method: "POST",
          body: JSON.stringify({
            collection: editDialog.collection,
            key: editDialog.key
          })
        });
        if (!response.ok) {
          setEditMessage(payload.message || "Unable to remove that entry.");
          return;
        }
        setGrid(prev => prev.filter(entry => entry.name !== entryName));
        clearEditDialogState();
        return;
      }
      const currentEntries = Array.isArray(selectedLoreSection?.entries) ? selectedLoreSection.entries : [];
      const deletedIndex = currentEntries.findIndex(entry => entry.title === entryName);
      const fallbackEntry = currentEntries[deletedIndex + 1] || currentEntries[deletedIndex - 1] || null;
      const {
        response,
        payload
      } = await fetchPirateJson("/pyrrhic-war/compendium/delete-custom-section-entry", {
        method: "POST",
        body: JSON.stringify({
          tabTitle: editDialog.key?.tabTitle || activeNarrativeTabTitle,
          sectionTitle: editDialog.key?.sectionTitle || selectedLoreSection?.title || "",
          title: entryName
        })
      });
      if (!response.ok) {
        setEditMessage(payload.message || "Unable to remove that entry.");
        return;
      }
      setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
        ...tab,
        sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title !== payload.sectionTitle ? sectionData : {
          ...sectionData,
          entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).filter(entry => entry.title !== payload.title)
        })
      }));
      clearEditDialogState();
      if (fallbackEntry) {
        selectCustomSection(getCustomSectionKey(editDialog.key?.tabTitle || activeNarrativeTabTitle), payload.sectionTitle, fallbackEntry.title);
        return;
      }
      setSelectedLoreEntryTitle("");
      persistCurrentCompendiumNavState({
        section: getCustomSectionKey(editDialog.key?.tabTitle || activeNarrativeTabTitle),
        selectedLoreSectionTitle: payload.sectionTitle,
        selectedLoreEntryTitle: "",
        showWriterTools
      });
    } catch (_error) {
      setEditMessage("Unable to remove that entry.");
    } finally {
      setIsSavingEdit(false);
    }
  };
  const editButton = (collection, entry) => editToolsVisible && React.createElement("button", {
    type: "button",
    className: "compendiumEditButton",
    onClick: () => openEditDialog(collection, entry),
    "aria-label": "Edit compendium entry",
    title: "Edit"
  }, "\u270E");
  const addButton = (label, onClick, options = {}) => editToolsVisible && React.createElement("button", {
    type: "button",
    className: "compendiumAddButton",
    onClick,
    title: `Add ${label}`
  }, options.showPlus === false ? label : ["+ ", label]);
  const addClassAbility = () => openAddDialog("classAbilities", {
    class: selectedClassName || "",
    rank: 1,
    name: "New Ability",
    type: "passive",
    description: ""
  });
  const addWeapon = () => openAddDialog("weapons", {
    name: "New Weapon",
    type: [],
    attackStats: [],
    damage: {
      dice: "1d4",
      type: ""
    },
    enduranceCost: 1,
    properties: []
  });
  const addArmor = () => openAddDialog("armors", {
    name: "New Armor",
    baseEvasion: 12,
    toughness: 0,
    dashPenalty: 0,
    properties: []
  });
  const addShield = () => openAddDialog("shields", {
    name: "New Shield",
    toughness: 0,
    braceCost: 0,
    dashPenalty: 0,
    properties: []
  });
  const addEquipmentProperty = () => openAddDialog("equipmentProperties", {
    name: "New Equipment Property",
    description: ""
  });
  const addGrid = () => openAddDialog("grid", buildGridEntryFromSchemaValues({}, gridSchema, {
    fallbackTitle: "New Grid Entry"
  }));
  const activeNarrativeCollection = section === "lore" ? "loreSections" : isCustomSectionKey(section) ? "customSections" : null;
  const activeBuiltInTabLabel = builtInTabs[section]?.label || BUILT_IN_TAB_DEFAULTS[section]?.label || "";
  const activeBuiltInTabColor = normalizeCompendiumAccentColor(builtInTabs[section]?.color);
  const activeNarrativeTabTitle = section === "lore" ? activeBuiltInTabLabel : activeCustomSection?.title || "";
  const activeCustomTabColor = normalizeCompendiumAccentColor(activeCustomSection?.color);
  const activeClassLabel = getClassLabel(selectedClassName || "");
  const activeEquipmentSectionLabel = getEquipmentSectionLabel(equipmentSection);
  const openNavEditor = config => {
    const normalizedColor = normalizeCompendiumAccentColor(config?.color);
    setNavEditDialog(config);
    setNavEditTitle(String(config?.title || ""));
    setNavEditColor(normalizedColor || "#b57c36");
    setNavEditUseDefaultColor(!normalizedColor);
    setNavEditMessage("");
  };
  const closeNavEditor = () => {
    if (isSavingNavEdit) return;
    setNavEditDialog(null);
    setNavEditMessage("");
  };
  const saveNavEditor = async () => {
    if (!navEditDialog) return;
    const nextTitle = String(navEditTitle || "").trim();
    if (!nextTitle) {
      setNavEditMessage("A title is required.");
      return;
    }
    const nextColor = navEditUseDefaultColor ? "" : normalizeCompendiumAccentColor(navEditColor);
    if (!navEditUseDefaultColor && !nextColor) {
      setNavEditMessage("Pick a valid color.");
      return;
    }
    const currentTitle = String(navEditDialog.title || "").trim();
    const currentColor = normalizeCompendiumAccentColor(navEditDialog.color);
    if (nextTitle === currentTitle && nextColor === currentColor) {
      closeNavEditor();
      return;
    }
    setIsSavingNavEdit(true);
    setNavEditMessage("");
    try {
      switch (navEditDialog.kind) {
        case "built-in-tab": {
          const {
            response,
            payload
          } = await fetchPirateJson("/pyrrhic-war/compendium/rename-built-in-tab", {
            method: "POST",
            body: JSON.stringify({
              tabKey: navEditDialog.tabKey,
              nextLabel: nextTitle,
              nextColor
            })
          });
          if (!response.ok) {
            setNavEditMessage(payload.message || "Unable to update that compendium tab.");
            return;
          }
          setBuiltInTabs(prev => ({
            ...prev,
            [payload.tabKey]: {
              ...(prev[payload.tabKey] || BUILT_IN_TAB_DEFAULTS[payload.tabKey]),
              label: payload.label,
              visible: payload.visible !== false,
              color: normalizeCompendiumAccentColor(payload.color)
            }
          }));
          break;
        }
        case "custom-tab": {
          const {
            response,
            payload
          } = await fetchPirateJson("/pyrrhic-war/compendium/rename-custom-tab", {
            method: "POST",
            body: JSON.stringify({
              tabTitle: navEditDialog.tabTitle,
              nextTitle,
              nextColor
            })
          });
          if (!response.ok) {
            setNavEditMessage(payload.message || "Unable to update that compendium tab.");
            return;
          }
          setCustomSections(prev => prev.map(tab => tab.title === navEditDialog.tabTitle ? {
            ...tab,
            title: payload.nextTitle,
            color: normalizeCompendiumAccentColor(payload.color)
          } : tab));
          setTabOrder(previousOrder => normalizeTabOrder(previousOrder.map(key => key === getCustomSectionKey(navEditDialog.tabTitle) ? getCustomSectionKey(payload.nextTitle) : key), customSectionsRef.current.map(tab => tab.title === navEditDialog.tabTitle ? {
            ...tab,
            title: payload.nextTitle,
            color: normalizeCompendiumAccentColor(payload.color)
          } : tab)));
          setSection(getCustomSectionKey(payload.nextTitle));
          persistCurrentCompendiumNavState({
            section: getCustomSectionKey(payload.nextTitle)
          });
          break;
        }
        case "lore-section": {
          const {
            response,
            payload
          } = await fetchPirateJson("/pyrrhic-war/compendium/rename-lore-section", {
            method: "POST",
            body: JSON.stringify({
              sectionTitle: navEditDialog.sectionTitle,
              nextTitle,
              nextColor
            })
          });
          if (!response.ok) {
            setNavEditMessage(payload.message || "Unable to update that category.");
            return;
          }
          setLoreSections(prev => prev.map(sectionData => sectionData.title === navEditDialog.sectionTitle ? {
            ...sectionData,
            title: payload.nextTitle,
            color: normalizeCompendiumAccentColor(payload.color)
          } : sectionData));
          selectLoreSection(payload.nextTitle, selectedLoreEntry?.title || null);
          break;
        }
        case "custom-section": {
          const {
            response,
            payload
          } = await fetchPirateJson("/pyrrhic-war/compendium/rename-custom-section-category", {
            method: "POST",
            body: JSON.stringify({
              tabTitle: navEditDialog.tabTitle,
              sectionTitle: navEditDialog.sectionTitle,
              nextTitle,
              nextColor
            })
          });
          if (!response.ok) {
            setNavEditMessage(payload.message || "Unable to update that category.");
            return;
          }
          setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
            ...tab,
            sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title === navEditDialog.sectionTitle ? {
              ...sectionData,
              title: payload.nextTitle,
              color: normalizeCompendiumAccentColor(payload.color)
            } : sectionData)
          }));
          selectCustomSection(section, payload.nextTitle, selectedLoreEntry?.title || null);
          break;
        }
        case "lore-entry": {
          const {
            response,
            payload
          } = await fetchPirateJson("/pyrrhic-war/compendium/rename-lore-entry", {
            method: "POST",
            body: JSON.stringify({
              sectionTitle: navEditDialog.sectionTitle,
              title: navEditDialog.entryTitle,
              nextTitle,
              nextColor
            })
          });
          if (!response.ok) {
            setNavEditMessage(payload.message || "Unable to update that subcategory.");
            return;
          }
          setLoreSections(prev => prev.map(sectionData => sectionData.title !== payload.sectionTitle ? sectionData : {
            ...sectionData,
            entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).map(entry => entry.title === navEditDialog.entryTitle ? {
              ...entry,
              title: payload.nextTitle,
              color: normalizeCompendiumAccentColor(payload.color)
            } : entry)
          }));
          selectLoreSection(payload.sectionTitle, payload.nextTitle);
          break;
        }
        case "custom-entry": {
          const {
            response,
            payload
          } = await fetchPirateJson("/pyrrhic-war/compendium/rename-custom-section-entry", {
            method: "POST",
            body: JSON.stringify({
              tabTitle: navEditDialog.tabTitle,
              sectionTitle: navEditDialog.sectionTitle,
              title: navEditDialog.entryTitle,
              nextTitle,
              nextColor
            })
          });
          if (!response.ok) {
            setNavEditMessage(payload.message || "Unable to update that subcategory.");
            return;
          }
          setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
            ...tab,
            sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title !== payload.sectionTitle ? sectionData : {
              ...sectionData,
              entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).map(entry => entry.title === navEditDialog.entryTitle ? {
                ...entry,
                title: payload.nextTitle,
                ...(entry.type === "grid" ? (() => {
                  const titleField = getPrimaryGridField(sectionData?.gridSchema);
                  return {
                    name: payload.nextTitle,
                    ...(titleField?.key ? {
                      [titleField.key]: payload.nextTitle
                    } : {})
                  };
                })() : {}),
                color: normalizeCompendiumAccentColor(payload.color)
              } : entry)
            })
          }));
          selectCustomSection(section, payload.sectionTitle, payload.nextTitle);
          break;
        }
        default:
          return;
      }
      setNavEditDialog(null);
    } finally {
      setIsSavingNavEdit(false);
    }
  };
  const saveGridSchemaDraft = async () => {
    let parsedSchema;
    try {
      parsedSchema = parseCompendiumJsonEditorText(gridSchemaDraft);
    } catch (_error) {
      setGridSchemaMessage("Grid fields must be valid JSON.");
      return;
    }
    const usesBuiltInGridSchema = section === "grid" || isCustomSectionKey(section) && activeCustomSectionType === "grid";
    const endpoint = usesBuiltInGridSchema ? "/pyrrhic-war/compendium/update-grid-schema" : "/pyrrhic-war/compendium/update-custom-section-grid-schema";
    const requestBody = usesBuiltInGridSchema ? {
      schema: parsedSchema
    } : {
      tabTitle: activeNarrativeTabTitle,
      sectionTitle: selectedLoreSection?.title || "",
      schema: parsedSchema
    };
    const {
      response,
      payload
    } = await fetchPirateJson(endpoint, {
      method: "POST",
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      setGridSchemaMessage(payload.message || "Unable to save those grid fields.");
      return;
    }
    const nextSchema = normalizeGridSchema(payload.schema);
    setGridSchemaMessage(payload.message || "Grid fields updated.");
    setGridSchemaDraft(serializeGridSchemaForEditor(nextSchema));
    if (usesBuiltInGridSchema) {
      setGridSchema(nextSchema);
      return;
    }
    setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
      ...tab,
      sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title !== payload.sectionTitle ? sectionData : {
        ...sectionData,
        gridSchema: nextSchema
      })
    }));
  };
  const addCustomTab = async () => {
    const title = window.prompt("New compendium tab name?");
    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) return;
    const typeInput = window.prompt("Tab type? Use Normal or Grid.", "Normal");
    const normalizedTypeInput = String(typeInput || "").trim().toLowerCase();
    if (!normalizedTypeInput) return;
    const tabType = normalizedTypeInput === "grid" ? "grid" : normalizedTypeInput === "normal" ? "lore" : null;
    if (!tabType) {
      window.alert('Tab type must be either "Normal" or "Grid".');
      return;
    }
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/add-custom-tab", {
      method: "POST",
      body: JSON.stringify({
        title: trimmedTitle,
        type: tabType
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to add that compendium tab.");
      return;
    }
    setCustomSections(prev => [...prev, payload.tab]);
    setTabOrder(previousOrder => normalizeTabOrder([...normalizeTabOrder(previousOrder, [...customSectionsRef.current, payload.tab]), getCustomSectionKey(payload.tab.title)], [...customSectionsRef.current, payload.tab]));
    setSection(getCustomSectionKey(payload.tab.title));
    if (normalizeCustomSectionType(payload.tab?.type) === "lore") {
      setSelectedLoreSectionTitle("");
      setSelectedLoreEntryTitle("");
    }
  };
  const deleteCustomTab = async () => {
    if (!activeCustomSection) return;
    if (!window.confirm(`Remove the compendium tab "${activeCustomSection.title}" and everything inside it?`)) return;
    const deletedTabTitle = activeCustomSection.title;
    const deletedIndex = customSections.findIndex(tab => tab.title === deletedTabTitle);
    const fallbackTab = customSections[deletedIndex + 1] || customSections[deletedIndex - 1] || null;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/delete-custom-tab", {
      method: "POST",
      body: JSON.stringify({
        tabTitle: deletedTabTitle
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to remove that compendium tab.");
      return;
    }
    setCustomSections(prev => prev.filter(tab => tab.title !== deletedTabTitle));
    setTabOrder(previousOrder => normalizeTabOrder(previousOrder.filter(key => key !== getCustomSectionKey(deletedTabTitle)), customSectionsRef.current.filter(tab => tab.title !== deletedTabTitle)));
    if (fallbackTab) {
      setSection(getCustomSectionKey(fallbackTab.title));
    } else {
      setSection("lore");
    }
    setSelectedLoreSectionTitle("");
    setSelectedLoreEntryTitle("");
  };
  const renameCustomTab = async () => {
    if (!activeCustomSection) return;
    const nextTitleInput = window.prompt("Rename compendium tab to?", activeCustomSection.title);
    const nextTitle = String(nextTitleInput || "").trim();
    if (!nextTitle || nextTitle === activeCustomSection.title) return;
    const previousTitle = activeCustomSection.title;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/rename-custom-tab", {
      method: "POST",
      body: JSON.stringify({
        tabTitle: previousTitle,
        nextTitle
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to rename that compendium tab.");
      return;
    }
    setCustomSections(prev => prev.map(tab => tab.title === previousTitle ? {
      ...tab,
      title: payload.nextTitle
    } : tab));
    setTabOrder(previousOrder => normalizeTabOrder(previousOrder.map(key => key === getCustomSectionKey(previousTitle) ? getCustomSectionKey(payload.nextTitle) : key), customSectionsRef.current.map(tab => tab.title === previousTitle ? {
      ...tab,
      title: payload.nextTitle
    } : tab)));
    setSection(getCustomSectionKey(payload.nextTitle));
    persistCurrentCompendiumNavState({
      section: getCustomSectionKey(payload.nextTitle)
    });
  };
  const renameBuiltInTab = async () => {
    if (!isBuiltInSectionKey(section)) return;
    const nextLabelInput = window.prompt("Rename compendium tab to?", activeBuiltInTabLabel);
    const nextLabel = String(nextLabelInput || "").trim();
    if (!nextLabel || nextLabel === activeBuiltInTabLabel) return;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/rename-built-in-tab", {
      method: "POST",
      body: JSON.stringify({
        tabKey: section,
        nextLabel
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to rename that compendium tab.");
      return;
    }
    setBuiltInTabs(prev => ({
      ...prev,
      [payload.tabKey]: {
        ...(prev[payload.tabKey] || BUILT_IN_TAB_DEFAULTS[payload.tabKey]),
        label: payload.label,
        visible: payload.visible !== false
      }
    }));
  };
  const removeBuiltInTab = async () => {
    if (!isBuiltInSectionKey(section)) return;
    if (!window.confirm(`Remove the compendium tab "${activeBuiltInTabLabel}"?`)) return;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/remove-built-in-tab", {
      method: "POST",
      body: JSON.stringify({
        tabKey: section
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to remove that compendium tab.");
      return;
    }
    setBuiltInTabs(prev => ({
      ...prev,
      [payload.tabKey]: {
        ...(prev[payload.tabKey] || BUILT_IN_TAB_DEFAULTS[payload.tabKey]),
        label: payload.label,
        visible: false
      }
    }));
  };
  const renameClassPageLabel = async (labelType, labelKey, currentLabel) => {
    const nextLabelInput = window.prompt("Rename to?", currentLabel);
    const nextLabel = String(nextLabelInput || "").trim();
    if (!nextLabel || nextLabel === currentLabel) return;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/rename-class-page-label", {
      method: "POST",
      body: JSON.stringify({
        labelType,
        labelKey,
        nextLabel
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to rename that class page label.");
      return;
    }
    setClassPageLabels(prev => ({
      ...prev,
      [payload.labelType === "group" ? "groupLabels" : "classLabels"]: {
        ...(prev[payload.labelType === "group" ? "groupLabels" : "classLabels"] || {}),
        [payload.labelKey]: payload.nextLabel
      }
    }));
  };
  const addClassPageGroup = async () => {
    const groupLabelInput = window.prompt("New classes category name?");
    const groupLabel = String(groupLabelInput || "").trim();
    if (!groupLabel) return;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/add-class-page-group", {
      method: "POST",
      body: JSON.stringify({
        groupKey: groupLabel,
        groupLabel
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to add that classes category.");
      return;
    }
    setClassPageStructure(prev => ({
      groups: [...prev.groups, {
        key: payload.group.key,
        classes: payload.group.classes || []
      }]
    }));
    setClassPageLabels(prev => ({
      ...prev,
      groupLabels: {
        ...(prev.groupLabels || {}),
        [payload.group.key]: payload.group.label
      }
    }));
    setSelectedGroupTitle(payload.group.key);
    setSelectedClassName("");
  };
  const removeClassPageGroup = async () => {
    if (!selectedGroup?.key) return;
    if (!window.confirm(`Remove the classes category "${getClassGroupLabel(selectedGroup.key)}" and all classes inside it?`)) return;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/remove-class-page-group", {
      method: "POST",
      body: JSON.stringify({
        groupKey: selectedGroup.key
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to remove that classes category.");
      return;
    }
    setClassPageStructure(prev => ({
      groups: prev.groups.filter(group => group.key !== payload.groupKey)
    }));
    setClassPageLabels(prev => {
      const nextGroupLabels = {
        ...(prev.groupLabels || {})
      };
      const nextClassLabels = {
        ...(prev.classLabels || {})
      };
      delete nextGroupLabels[payload.groupKey];
      (payload.removedClasses || []).forEach(classKey => delete nextClassLabels[classKey]);
      return {
        ...prev,
        groupLabels: nextGroupLabels,
        classLabels: nextClassLabels
      };
    });
  };
  const addClassPageClass = async () => {
    if (!selectedGroup?.key) return;
    const classLabelInput = window.prompt(`New class name for ${getClassGroupLabel(selectedGroup.key)}?`);
    const classLabel = String(classLabelInput || "").trim();
    if (!classLabel) return;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/add-class-page-class", {
      method: "POST",
      body: JSON.stringify({
        groupKey: selectedGroup.key,
        classKey: classLabel,
        classLabel
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to add that class.");
      return;
    }
    setClassPageStructure(prev => ({
      groups: prev.groups.map(group => group.key === payload.groupKey ? {
        ...group,
        classes: [...group.classes, payload.classKey]
      } : group)
    }));
    setClassPageLabels(prev => ({
      ...prev,
      classLabels: {
        ...(prev.classLabels || {}),
        [payload.classKey]: payload.classLabel
      }
    }));
    setSelectedClassName(payload.classKey);
  };
  const removeClassPageClass = async () => {
    if (!selectedClassName) return;
    if (!window.confirm(`Remove the class "${activeClassLabel}" and all of its abilities?`)) return;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/remove-class-page-class", {
      method: "POST",
      body: JSON.stringify({
        classKey: selectedClassName
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to remove that class.");
      return;
    }
    setClassPageStructure(prev => ({
      groups: prev.groups.map(group => group.key === payload.groupKey ? {
        ...group,
        classes: group.classes.filter(classKey => classKey !== payload.classKey)
      } : group)
    }));
    setClassPageLabels(prev => {
      const nextClassLabels = {
        ...(prev.classLabels || {})
      };
      delete nextClassLabels[payload.classKey];
      return {
        ...prev,
        classLabels: nextClassLabels
      };
    });
    setClassAbilities(prev => prev.filter(ability => ability.class !== payload.classKey));
  };
  const renameEquipmentPageLabel = async (labelType, labelKey, currentLabel) => {
    const nextLabelInput = window.prompt("Rename to?", currentLabel);
    const nextLabel = String(nextLabelInput || "").trim();
    if (!nextLabel || nextLabel === currentLabel) return;
    const {
      response,
      payload
    } = await fetchPirateJson("/pyrrhic-war/compendium/rename-equipment-page-label", {
      method: "POST",
      body: JSON.stringify({
        labelType,
        labelKey,
        nextLabel
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to rename that equipment page label.");
      return;
    }
    setEquipmentPageLabels(prev => ({
      ...prev,
      [payload.labelType === "section" ? "sectionLabels" : "subsectionLabels"]: {
        ...(prev[payload.labelType === "section" ? "sectionLabels" : "subsectionLabels"] || {}),
        [payload.labelKey]: payload.nextLabel
      }
    }));
  };
  const addLoreSection = async () => {
    if (!activeNarrativeCollection) return;
    const title = window.prompt(`New category name for ${activeNarrativeTabTitle}?`);
    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) return;
    const sectionType = activeNarrativeCollection === "customSections" ? normalizeCustomSectionType(window.prompt('Category type? Use Normal or Grid.', "Normal")) : "lore";
    const {
      response,
      payload
    } = await fetchPirateJson(activeNarrativeCollection === "loreSections" ? "/pyrrhic-war/compendium/add-lore-section" : "/pyrrhic-war/compendium/add-custom-section-category", {
      method: "POST",
      body: JSON.stringify({
        ...(activeNarrativeCollection === "customSections" ? {
          tabTitle: activeNarrativeTabTitle,
          type: sectionType
        } : {}),
        ...(activeNarrativeCollection === "loreSections" ? {
          title: trimmedTitle
        } : {
          title: trimmedTitle
        })
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to add that category.");
      return;
    }
    if (activeNarrativeCollection === "loreSections") {
      setLoreSections(prev => [...prev, payload.section]);
      selectLoreSection(payload.section.title);
      return;
    }
    setCustomSections(prev => prev.map(tab => tab.title === payload.tabTitle ? {
      ...tab,
      sections: [...(Array.isArray(tab.sections) ? tab.sections : []), payload.section]
    } : tab));
    selectCustomSection(section, payload.section.title);
  };
  const addLoreEntry = async (forceGrid = false) => {
    if (!selectedLoreSection || !activeNarrativeCollection) return;
    const shouldForceGrid = forceGrid === true;
    const gridTitleLabel = getPrimaryGridField(activeGridSchema)?.label || "Name";
    const title = window.prompt(shouldForceGrid ? `New ${gridTitleLabel.toLowerCase()} for ${selectedLoreSection.title}?` : `New subcategory name for ${selectedLoreSection.title}?`);
    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) return;
    const {
      response,
      payload
    } = await fetchPirateJson(activeNarrativeCollection === "loreSections" ? "/pyrrhic-war/compendium/add-lore-entry" : "/pyrrhic-war/compendium/add-custom-section-entry", {
      method: "POST",
      body: JSON.stringify({
        ...(activeNarrativeCollection === "customSections" ? {
          tabTitle: activeNarrativeTabTitle
        } : {}),
        sectionTitle: selectedLoreSection.title,
        entry: shouldForceGrid ? buildGridEntryFromSchemaValues({}, activeGridSchema, {
          includeType: true,
          fallbackTitle: trimmedTitle
        }) : {
          type: "lore",
          title: trimmedTitle,
          content: `# ${trimmedTitle}\n\t`
        }
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to add that subcategory.");
      return;
    }
    if (activeNarrativeCollection === "loreSections") {
      setLoreSections(prev => prev.map(sectionData => {
        if (sectionData.title !== payload.sectionTitle) return sectionData;
        return {
          ...sectionData,
          entries: [...(Array.isArray(sectionData.entries) ? sectionData.entries : []), payload.entry]
        };
      }));
    } else {
      setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
        ...tab,
        sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title !== payload.sectionTitle ? sectionData : {
          ...sectionData,
          entries: [...(Array.isArray(sectionData.entries) ? sectionData.entries : []), payload.entry]
        })
      }));
    }
    pendingLoreSelectionRef.current = {
      topSectionKey: section,
      sectionTitle: payload.sectionTitle,
      entryTitle: payload.entry.title
    };
    if (activeNarrativeCollection === "loreSections") {
      selectLoreSection(payload.sectionTitle, payload.entry.title);
      return;
    }
    selectCustomSection(section, payload.sectionTitle, payload.entry.title);
  };
  const renameLoreSection = async () => {
    if (!selectedLoreSection || !activeNarrativeCollection) return;
    const nextTitleInput = window.prompt("Rename category to?", selectedLoreSection.title);
    const nextTitle = String(nextTitleInput || "").trim();
    if (!nextTitle || nextTitle === selectedLoreSection.title) return;
    const previousTitle = selectedLoreSection.title;
    const {
      response,
      payload
    } = await fetchPirateJson(activeNarrativeCollection === "loreSections" ? "/pyrrhic-war/compendium/rename-lore-section" : "/pyrrhic-war/compendium/rename-custom-section-category", {
      method: "POST",
      body: JSON.stringify({
        ...(activeNarrativeCollection === "customSections" ? {
          tabTitle: activeNarrativeTabTitle
        } : {}),
        sectionTitle: previousTitle,
        nextTitle
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to rename that category.");
      return;
    }
    if (activeNarrativeCollection === "loreSections") {
      setLoreSections(prev => prev.map(sectionData => sectionData.title === previousTitle ? {
        ...sectionData,
        title: payload.nextTitle
      } : sectionData));
      selectLoreSection(payload.nextTitle, selectedLoreEntry?.title || null);
      return;
    }
    setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
      ...tab,
      sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title === previousTitle ? {
        ...sectionData,
        title: payload.nextTitle
      } : sectionData)
    }));
    selectCustomSection(section, payload.nextTitle, selectedLoreEntry?.title || null);
  };
  const deleteLoreSection = async () => {
    if (!selectedLoreSection || !activeNarrativeCollection) return;
    if (!window.confirm(`Remove the category "${selectedLoreSection.title}" and all of its subcategories?`)) return;
    const deletedSectionTitle = selectedLoreSection.title;
    const sourceSections = activeNarrativeCollection === "loreSections" ? loreSections : Array.isArray(activeCustomSection?.sections) ? activeCustomSection.sections : [];
    const deletedIndex = sourceSections.findIndex(sectionData => sectionData.title === deletedSectionTitle);
    const fallbackSection = sourceSections[deletedIndex + 1] || sourceSections[deletedIndex - 1] || null;
    const {
      response,
      payload
    } = await fetchPirateJson(activeNarrativeCollection === "loreSections" ? "/pyrrhic-war/compendium/delete-lore-section" : "/pyrrhic-war/compendium/delete-custom-section-category", {
      method: "POST",
      body: JSON.stringify({
        ...(activeNarrativeCollection === "customSections" ? {
          tabTitle: activeNarrativeTabTitle
        } : {}),
        sectionTitle: deletedSectionTitle
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to remove that category.");
      return;
    }
    if (activeNarrativeCollection === "loreSections") {
      setLoreSections(prev => prev.filter(sectionData => sectionData.title !== deletedSectionTitle));
    } else {
      setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
        ...tab,
        sections: (Array.isArray(tab.sections) ? tab.sections : []).filter(sectionData => sectionData.title !== payload.sectionTitle)
      }));
    }
    if (fallbackSection) {
      if (activeNarrativeCollection === "loreSections") {
        selectLoreSection(fallbackSection.title);
      } else {
        selectCustomSection(section, fallbackSection.title);
      }
      return;
    }
    setSelectedLoreSectionTitle("");
    setSelectedLoreEntryTitle("");
    persistCurrentCompendiumNavState({
      section,
      selectedLoreSectionTitle: "",
      selectedLoreEntryTitle: ""
    });
  };
  const deleteLoreEntry = async () => {
    if (!selectedLoreSection || !selectedLoreEntry || !activeNarrativeCollection) return;
    if (!window.confirm(`Remove the subcategory "${selectedLoreEntry.title}" from "${selectedLoreSection.title}"?`)) return;
    const currentEntries = Array.isArray(selectedLoreSection.entries) ? selectedLoreSection.entries : [];
    const deletedIndex = currentEntries.findIndex(entry => entry.title === selectedLoreEntry.title);
    const fallbackEntry = currentEntries[deletedIndex + 1] || currentEntries[deletedIndex - 1] || null;
    const deletedTitle = selectedLoreEntry.title;
    const {
      response,
      payload
    } = await fetchPirateJson(activeNarrativeCollection === "loreSections" ? "/pyrrhic-war/compendium/delete-lore-entry" : "/pyrrhic-war/compendium/delete-custom-section-entry", {
      method: "POST",
      body: JSON.stringify({
        ...(activeNarrativeCollection === "customSections" ? {
          tabTitle: activeNarrativeTabTitle
        } : {}),
        sectionTitle: selectedLoreSection.title,
        title: deletedTitle
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to remove that subcategory.");
      return;
    }
    if (activeNarrativeCollection === "loreSections") {
      setLoreSections(prev => prev.map(sectionData => {
        if (sectionData.title !== payload.sectionTitle) return sectionData;
        return {
          ...sectionData,
          entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).filter(entry => entry.title !== payload.title)
        };
      }));
    } else {
      setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
        ...tab,
        sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title !== payload.sectionTitle ? sectionData : {
          ...sectionData,
          entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).filter(entry => entry.title !== payload.title)
        })
      }));
    }
    if (fallbackEntry) {
      if (activeNarrativeCollection === "loreSections") {
        selectLoreSection(selectedLoreSection.title, fallbackEntry.title);
      } else {
        selectCustomSection(section, selectedLoreSection.title, fallbackEntry.title);
      }
      return;
    }
    setSelectedLoreEntryTitle("");
    persistCurrentCompendiumNavState({
      section,
      selectedLoreSectionTitle: selectedLoreSection.title,
      selectedLoreEntryTitle: ""
    });
  };
  const renameLoreEntry = async () => {
    if (!selectedLoreSection || !selectedLoreEntry || !activeNarrativeCollection) return;
    const nextTitleInput = window.prompt("Rename subcategory to?", selectedLoreEntry.title);
    const nextTitle = String(nextTitleInput || "").trim();
    if (!nextTitle || nextTitle === selectedLoreEntry.title) return;
    const previousTitle = selectedLoreEntry.title;
    const {
      response,
      payload
    } = await fetchPirateJson(activeNarrativeCollection === "loreSections" ? "/pyrrhic-war/compendium/rename-lore-entry" : "/pyrrhic-war/compendium/rename-custom-section-entry", {
      method: "POST",
      body: JSON.stringify({
        ...(activeNarrativeCollection === "customSections" ? {
          tabTitle: activeNarrativeTabTitle
        } : {}),
        sectionTitle: selectedLoreSection.title,
        title: previousTitle,
        nextTitle
      })
    });
    if (!response.ok) {
      window.alert(payload.message || "Unable to rename that subcategory.");
      return;
    }
    if (activeNarrativeCollection === "loreSections") {
      setLoreSections(prev => prev.map(sectionData => sectionData.title !== payload.sectionTitle ? sectionData : {
        ...sectionData,
        entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).map(entry => entry.title === previousTitle ? {
          ...entry,
          title: payload.nextTitle
        } : entry)
      }));
      selectLoreSection(payload.sectionTitle, payload.nextTitle);
      return;
    }
    setCustomSections(prev => prev.map(tab => tab.title !== payload.tabTitle ? tab : {
      ...tab,
      sections: (Array.isArray(tab.sections) ? tab.sections : []).map(sectionData => sectionData.title !== payload.sectionTitle ? sectionData : {
        ...sectionData,
        entries: (Array.isArray(sectionData.entries) ? sectionData.entries : []).map(entry => entry.title === previousTitle ? {
          ...entry,
          title: payload.nextTitle,
          ...(entry.type === "grid" ? (() => {
            const titleField = getPrimaryGridField(sectionData?.gridSchema);
            return {
              name: payload.nextTitle,
              ...(titleField?.key ? {
                [titleField.key]: payload.nextTitle
              } : {})
            };
          })() : {})
        } : entry)
      })
    }));
    selectCustomSection(section, payload.sectionTitle, payload.nextTitle);
  };
  const abilityCard = ability => {
    const favorite = buildFavoriteDescriptor({
      topSectionKey: "classes",
      sectionTitle: buildCompendiumFavoritePath(selectedGroup.key, selectedClassName),
      entryTitle: ability.name,
      blockType: "class-ability",
      blockIndex: 0,
      blockText: [ability.name, getAbilityMeta(ability), ability.selectionCategory && ability.selectionOption ? `${classSelectionCategories.get(ability.selectionCategory)?.label || ability.selectionCategory}: ${ability.selectionOption}` : "", ability.description].filter(Boolean).join("\n")
    });
    return renderFavoriteCard(favorite, "compendiumAbility", React.createElement(React.Fragment, null, React.createElement("div", {
      className: "compendiumAbilityTitle"
    }, ability.name), editButton("classAbilities", ability), getAbilityMeta(ability) && React.createElement("div", {
      className: "compendiumAbilityMeta"
    }, getAbilityMeta(ability)), ability.selectionCategory && ability.selectionOption && React.createElement("div", {
      className: "compendiumSelectionMeta"
    }, (classSelectionCategories.get(ability.selectionCategory)?.label || ability.selectionCategory), ": ", ability.selectionOption), React.createElement("p", null, ability.description)), {
      showFavoriteButton: !editToolsVisible
    });
  };
  const traitCard = (collection, entry, schema = gridSchema) => {
    const normalizedSchema = normalizeGridSchema(schema);
    const titleField = getPrimaryGridField(normalizedSchema);
    const entryTitle = getGridEntryDisplayName(entry, normalizedSchema) || "Grid Entry";
    const schemaFields = normalizedSchema.map(field => ({
      ...field,
      value: getGridEntryValue(entry, field)
    }));
    const gridMeta = schemaFields.filter(field => !field.isTitle && field.type !== "textarea" && field.type !== "paragraph").map(field => {
      if (field.type === "multiselect") {
        return Array.isArray(field.value) && field.value.length > 0 ? `${field.label} ${field.value.join(", ")}` : null;
      }
      if (field.type === "boolean") {
        return field.value === true ? `${field.label} Yes` : null;
      }
      return field.value != null && String(field.value).trim() ? `${field.label} ${field.value}` : null;
    }).filter(Boolean);
    const gridParagraphs = schemaFields.filter(field => !field.isTitle && field.type === "textarea" && String(field.value || "").trim()).map(field => React.createElement("p", {
      key: field.key
    }, React.createElement("strong", null, `${field.label}: `), String(field.value)));
    const gridProseParagraphs = schemaFields.filter(field => !field.isTitle && field.type === "paragraph" && String(field.value || "").trim()).map(field => React.createElement("div", {
      key: field.key,
      className: "compendiumGridParagraph"
    }, renderLoreContent(String(field.value || ""), {
      favoriteContext: false
    })));
    const favorite = buildFavoriteDescriptor({
      topSectionKey: "grid",
      sectionTitle: "grid",
      entryTitle: entryTitle,
      blockType: "grid",
      blockIndex: 0,
      blockText: [entryTitle, ...gridMeta, ...schemaFields.filter(field => !field.isTitle && field.type === "textarea").map(field => `${field.label}: ${String(field.value || "")}`), ...schemaFields.filter(field => !field.isTitle && field.type === "paragraph").map(field => String(field.value || ""))].filter(Boolean).join("\n")
    });
    return renderFavoriteCard(favorite, "compendiumCondition", React.createElement(React.Fragment, null, React.createElement("h3", null, entryTitle, editButton(collection, entry)), React.createElement("div", {
      className: "compendiumAbilityMeta"
    }, gridMeta.join(" | ") || titleField?.label || "Grid Entry"), gridParagraphs.length > 0 ? gridParagraphs : null, gridProseParagraphs.length > 0 ? gridProseParagraphs : null), {
      showFavoriteButton: !editToolsVisible
    });
  };
  const equipmentPropertyCard = property => {
    const favorite = buildFavoriteDescriptor({
      topSectionKey: "equipment",
      sectionTitle: "equipmentProperties",
      entryTitle: property.name,
      blockType: "equipment-property",
      blockIndex: 0,
      blockText: [property.name, property.description].filter(Boolean).join("\n")
    });
    return renderFavoriteCard(favorite, "compendiumCondition", React.createElement(React.Fragment, null, React.createElement("h3", null, property.name, editButton("equipmentProperties", property)), React.createElement("p", null, property.description)));
  };
  const renderLoreInlineText = React.useCallback((text, keyPrefix) => {
    const rawText = String(text || "");
    const parts = [];
    const referencePattern = /<([^<>]+)>/g;
    let lastIndex = 0;
    let matchIndex = 0;
    let match;
    while ((match = referencePattern.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(rawText.slice(lastIndex, match.index));
      }
      const referenceText = String(match[1] || "").trim();
      const targetExists = narrativeLinkTargets.some(target => target.normalizedTitle === referenceText.toLowerCase());
      if (referenceText && targetExists) {
        parts.push(React.createElement("button", {
          key: `${keyPrefix}-ref-${matchIndex}`,
          type: "button",
          className: "compendiumLoreInlineLink",
          onClick: () => navigateNarrativeReference(referenceText)
        }, referenceText));
      } else {
        parts.push(match[0]);
      }
      lastIndex = referencePattern.lastIndex;
      matchIndex += 1;
    }
    if (lastIndex < rawText.length) {
      parts.push(rawText.slice(lastIndex));
    }
    return parts.length === 0 ? rawText : parts;
  }, [narrativeLinkTargets, navigateNarrativeReference]);
  const renderLoreContent = (content, options = {}) => {
    const text = String(content || "");
    const favoriteContext = options.favoriteContext === false ? null : {
      topSectionKey: section === "lore" || isCustomSectionKey(section) ? section : "lore",
      sectionTitle: selectedLoreSection?.title || "",
      entryTitle: selectedLoreEntry?.title || ""
    };
    const lines = text.split(/\r?\n/);
    const elements = [];
    let paragraphLines = [];
    let blankLineCount = 0;
    let tableRows = [];
    let listItems = [];
    let listType = "";
    let favoriteBlockIndex = 0;
    const parseImageLine = line => {
      const trimmedLine = String(line || "").trim();
      const match = trimmedLine.match(/^!\[([^\]]*)\]\((.+)\)$/);
      if (!match) return null;
      const altText = String(match[1] || "").trim();
      const sourceText = String(match[2] || "").trim();
      const imageUrl = normalizeCompendiumImageUrl(sourceText);
      if (!imageUrl) return null;
      return {
        altText,
        sourceText: imageUrl
      };
    };
    const parseTableRow = line => {
      const trimmedLine = String(line || "").trim();
      if (!trimmedLine.includes("|")) return null;
      const normalizedLine = trimmedLine.startsWith("|") ? trimmedLine.slice(1) : trimmedLine;
      const withoutTrailingPipe = normalizedLine.endsWith("|") ? normalizedLine.slice(0, -1) : normalizedLine;
      const cells = withoutTrailingPipe.split("|").map(cell => cell.trim());
      return cells.length > 1 ? cells : null;
    };
    const isTableSeparatorRow = cells => Array.isArray(cells) && cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
    const renderFavoriteBlock = (blockType, blockText, keySuffix, contentElement) => {
      if (!favoriteContext) {
        return React.createElement("div", {
          key: `${blockType}-${keySuffix}`,
          className: "compendiumGridLoreBlock"
        }, contentElement);
      }
      const favorite = buildFavoriteDescriptor({
        topSectionKey: favoriteContext.topSectionKey,
        sectionTitle: favoriteContext.sectionTitle,
        entryTitle: favoriteContext.entryTitle,
        blockType,
        blockIndex: favoriteBlockIndex,
        blockText
      });
      const favoriteKey = favorite?.favoriteKey || `${blockType}-${keySuffix}`;
      const isFavorited = favorite ? favoriteKeys.has(favorite.favoriteKey) : false;
      const isFavoritePending = favorite ? favoritePendingKeySet.has(favorite.favoriteKey) : false;
      const block = React.createElement("div", {
        key: `favorite-${favoriteKey}`,
        className: `compendiumFavoriteBlock${highlightedFavoriteKey === favorite?.favoriteKey ? " compendiumFavoriteBlockTarget" : ""}`,
        "data-favorite-key": favorite?.favoriteKey || undefined
      }, !editToolsVisible ? React.createElement("button", {
        type: "button",
        className: `compendiumFavoriteStar${isFavorited ? " active" : ""}`,
        onClick: () => favorite && toggleFavorite(favorite),
        disabled: !favorite || isFavoritePending,
        title: isFavorited ? "Remove favorite" : "Add favorite"
      }, isFavorited ? "\u2605" : "\u2606") : null, React.createElement("div", {
        className: "compendiumFavoriteBlockBody"
      }, contentElement));
      favoriteBlockIndex += 1;
      return block;
    };
    const flushParagraph = keySuffix => {
      if (paragraphLines.length === 0) return;
      const paragraphText = paragraphLines.join("\n");
      elements.push(renderFavoriteBlock("paragraph", paragraphText, keySuffix, React.createElement("p", {
        key: `paragraph-${keySuffix}`
      }, renderLoreInlineText(paragraphText, `paragraph-${keySuffix}`))));
      paragraphLines = [];
    };
    const flushTable = keySuffix => {
      if (tableRows.length === 0) return;
      const hasExplicitHeader = tableRows.length > 1 && isTableSeparatorRow(tableRows[1]);
      const headerCells = tableRows[0] || [];
      const bodyRows = hasExplicitHeader ? tableRows.slice(2) : tableRows.slice(1);
      const tableHead = headerCells.length > 0 ? React.createElement("thead", null, React.createElement("tr", null, headerCells.map((cell, cellIndex) => React.createElement("th", {
        key: `head-${cellIndex}`
      }, renderLoreInlineText(cell, `head-${keySuffix}-${cellIndex}`))))) : null;
      const tableBody = bodyRows.length > 0 ? React.createElement("tbody", null, bodyRows.map((row, rowIndex) => React.createElement("tr", {
        key: `row-${rowIndex}`
      }, row.map((cell, cellIndex) => React.createElement("td", {
        key: `cell-${rowIndex}-${cellIndex}`
      }, renderLoreInlineText(cell, `cell-${keySuffix}-${rowIndex}-${cellIndex}`)))))) : null;
      elements.push(renderFavoriteBlock("table", tableRows.map(row => row.join(" | ")).join("\n"), keySuffix, React.createElement("div", {
        key: `table-wrap-${keySuffix}`,
        className: "compendiumLoreTableWrap"
      }, React.createElement("table", {
        className: "compendiumLoreTable"
      }, tableHead, tableBody))));
      tableRows = [];
    };
    const flushList = keySuffix => {
      if (listItems.length === 0) return;
      const tagName = listType === "ordered" ? "ol" : "ul";
      const blockText = listItems.map(item => `${listType === "ordered" ? "1." : "-"} ${item}`).join("\n");
      elements.push(renderFavoriteBlock("paragraph", blockText, keySuffix, React.createElement(tagName, {
        key: `list-${keySuffix}`,
        className: "compendiumLoreList"
      }, listItems.map((item, itemIndex) => React.createElement("li", {
        key: `item-${itemIndex}`
      }, renderLoreInlineText(item, `list-${keySuffix}-${itemIndex}`))))));
      listItems = [];
      listType = "";
    };
    const flushBlankLines = keySuffix => {
      if (blankLineCount === 0) return;
      elements.push(React.createElement("div", {
        key: `spacer-${keySuffix}`,
        className: "compendiumLoreSpacer",
        style: {
          height: `${blankLineCount * 16}px`
        }
      }));
      blankLineCount = 0;
    };
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        flushTable(index);
        flushParagraph(index);
        flushList(index);
        blankLineCount += 1;
        return;
      }
      flushBlankLines(index);
      const imageData = parseImageLine(line);
      if (imageData) {
        flushTable(index);
        flushParagraph(index);
        flushList(index);
        elements.push(renderFavoriteBlock("image", imageData.altText ? `${imageData.altText}\n${imageData.sourceText}` : imageData.sourceText, index, React.createElement("figure", {
          key: `image-${index}`,
          className: "compendiumLoreImageWrap"
        }, React.createElement("img", {
          className: "compendiumLoreImage",
          src: imageData.sourceText,
          alt: imageData.altText || "Lore image",
          loading: "lazy"
        }), imageData.altText ? React.createElement("figcaption", {
          className: "compendiumLoreImageCaption"
        }, renderLoreInlineText(imageData.altText, `image-caption-${index}`)) : null)));
        return;
      }
      const tableCells = parseTableRow(line);
      if (tableCells) {
        flushParagraph(index);
        flushList(index);
        tableRows.push(tableCells);
        return;
      }
      flushTable(index);
      const bulletMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
      const numberedMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
      if (bulletMatch || numberedMatch) {
        flushParagraph(index);
        const nextListType = numberedMatch ? "ordered" : "unordered";
        if (listType && listType !== nextListType) {
          flushList(index);
        }
        listType = nextListType;
        listItems.push((bulletMatch?.[1] || numberedMatch?.[1] || "").trim());
        return;
      }
      flushList(index);
      const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph(index);
        const level = headingMatch[1].length;
        const headingTag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
        const headingText = headingMatch[2].trim();
        elements.push(renderFavoriteBlock("heading", headingText, index, React.createElement(headingTag, {
          key: `heading-${index}`
        }, renderLoreInlineText(headingText, `heading-${index}`))));
        return;
      }
      paragraphLines.push(line);
    });
    flushTable("final");
    flushParagraph("final");
    flushList("final");
    flushBlankLines("final");
    if (elements.length === 0) {
      return React.createElement("div", {
        className: "compendiumLoreBody"
      }, React.createElement("p", null, ""));
    }
    return React.createElement("div", {
      className: "compendiumLoreBody"
    }, elements);
  };
  const hasClassAbilities = classAbilityRanks.length > 0 || classSelectionAbilities.length > 0;
  const rankGroupsContent = classAbilityRanks.map(([rank, abilities]) => React.createElement("section", {
    key: rank,
    className: "compendiumRankGroup"
  }, React.createElement("h3", null, "Rank ", rank), abilities.map(abilityCard)));
  const selectionGroupContent = classSelectionAbilities.length > 0 && React.createElement("section", {
    className: "compendiumRankGroup compendiumSelectionGroup"
  }, React.createElement("h3", null, "Selections"), classSelectionAbilities.map(abilityCard));

  const classesContent = section === "classes" && React.createElement("section", {
    className: "compendiumSection"
  }, React.createElement("div", {
    className: "compendiumLoreCategoryRow"
  }, React.createElement("div", {
    className: "compendiumCategoryBar"
  }, classPageStructure.groups.map(group => React.createElement("button", getReorderableButtonProps({
    key: group.key,
    type: "button",
    className: selectedGroup.key === group.key ? "active" : ""
  }, {
    id: group.key,
    kind: "class-group",
    scope: "classes"
  }, () => setSelectedGroupTitle(group.key)), getClassGroupLabel(group.key)))), editToolsVisible ? React.createElement("div", {
    className: "compendiumSectionTools compendiumLoreCategoryTools"
  }, React.createElement("button", {
    type: "button",
    className: "compendiumAddButton",
    onClick: addClassPageGroup,
    title: "Add classes category"
  }, "Add"), selectedGroup.key ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => renameClassPageLabel("group", selectedGroup.key, getClassGroupLabel(selectedGroup.key)),
    title: `Rename ${getClassGroupLabel(selectedGroup.key)}`
  }, "Rename") : null, selectedGroup.key ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: removeClassPageGroup,
    title: `Remove ${getClassGroupLabel(selectedGroup.key)}`
  }, "Remove") : null) : null), React.createElement("div", {
    className: "compendiumClassLayout"
  }, React.createElement("aside", {
    className: "compendiumClassList"
  }, classPageStructure.groups.length === 0 ? React.createElement("p", null, "No classes categories have been added yet.") : selectedGroup.classes.map(className => React.createElement("button", {
    key: className,
    type: "button",
    className: selectedClassName === className ? "active" : "",
    onClick: () => setSelectedClassName(className)
  }, getClassLabel(className))), editToolsVisible ? React.createElement("div", {
    className: "compendiumSectionTools compendiumLoreSubcategoryTools"
  }, React.createElement("button", {
    type: "button",
    className: "compendiumAddButton",
    onClick: addClassPageClass,
    title: `Add class to ${getClassGroupLabel(selectedGroup.key)}`
  }, "Add"), selectedClassName ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => renameClassPageLabel("class", selectedClassName, activeClassLabel),
    title: `Rename ${activeClassLabel}`
  }, "Rename") : null, selectedClassName ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: removeClassPageClass,
    title: `Remove ${activeClassLabel}`
  }, "Remove") : null) : null), React.createElement("div", {
    className: "compendiumClassDetails"
  }, React.createElement("div", {
    className: "compendiumClassDetailsHeader"
  }, React.createElement("h2", null, activeClassLabel || "No Entry Selected"), selectedClassName && addButton("Ability", addClassAbility)), classPageStructure.groups.length === 0 ? React.createElement("p", null, "This tab is empty. Add a category when you're ready.") : !selectedClassName ? React.createElement("p", null, "No entry selected.") : !hasClassAbilities ? React.createElement("p", null, "No entries listed in this category.") : React.createElement(React.Fragment, null, rankGroupsContent, selectionGroupContent))));
  const customClassesEmptyLabel = "No categories have been added to this tab yet.";
  const customClassesContent = isCustomSectionKey(section) && activeCustomSectionType === "classes" && React.createElement("section", {
    className: "compendiumSection"
  }, activeNarrativeCategories.length === 0 ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "compendiumLoreCategoryRow"
  }, React.createElement("div", {
    className: "compendiumCategoryBar"
  }), React.createElement("div", {
    className: "compendiumSectionTools compendiumLoreCategoryTools"
  }, addButton("Add", addLoreSection, {
    showPlus: false
  }))), React.createElement("p", null, customClassesEmptyLabel)) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "compendiumLoreCategoryRow"
  }, React.createElement("div", {
    className: "compendiumCategoryBar"
  }, activeNarrativeCategories.map(category => React.createElement("button", getReorderableButtonProps({
    key: category.title,
    type: "button",
    className: selectedLoreSection?.title === category.title ? "active" : "",
    style: getCompendiumAccentButtonStyle(category.color, selectedLoreSection?.title === category.title) || undefined
  }, {
    id: category.title,
    kind: "category",
    scope: `custom:${encodeURIComponent(activeNarrativeTabTitle)}`
  }, () => selectCustomSection(section, category.title)), category.title))), React.createElement("div", {
    className: "compendiumSectionTools compendiumLoreCategoryTools"
  }, addButton("Add", addLoreSection, {
    showPlus: false
  }), selectedLoreSection && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => openNavEditor({
      kind: "custom-section",
      tabTitle: activeNarrativeTabTitle,
      sectionTitle: selectedLoreSection.title,
      title: selectedLoreSection.title,
      color: selectedLoreSection.color
    }),
    title: `Edit ${selectedLoreSection.title}`
  }, "Edit") : null, selectedLoreSection && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: deleteLoreSection,
    title: `Remove ${selectedLoreSection.title}`
  }, "Remove") : null)), React.createElement("div", {
    className: "compendiumClassLayout"
  }, React.createElement("aside", {
    className: "compendiumClassList"
  }, (Array.isArray(selectedLoreSection?.entries) ? selectedLoreSection.entries : []).length === 0 ? React.createElement("p", null, "No subcategories yet.") : (Array.isArray(selectedLoreSection?.entries) ? selectedLoreSection.entries : []).map(entry => React.createElement("button", getReorderableButtonProps({
    key: entry.title,
    type: "button",
    className: selectedLoreEntry?.title === entry.title ? "active" : "",
    style: getCompendiumAccentButtonStyle(entry.color, selectedLoreEntry?.title === entry.title) || undefined
  }, {
    id: entry.title,
    kind: "entry",
    scope: `custom-entry::${encodeURIComponent(activeNarrativeTabTitle)}::${encodeURIComponent(selectedLoreSection?.title || "")}`
  }, () => selectLoreEntry(entry.title)), entry.title)), React.createElement("div", {
    className: "compendiumSectionTools compendiumLoreSubcategoryTools"
  }, addButton("Add", addLoreEntry, {
    showPlus: false
  }), selectedLoreEntry && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => openNavEditor({
      kind: "custom-entry",
      tabTitle: activeNarrativeTabTitle,
      sectionTitle: selectedLoreSection?.title || "",
      entryTitle: selectedLoreEntry.title,
      title: selectedLoreEntry.title,
      color: selectedLoreEntry.color
    }),
    title: `Edit ${selectedLoreEntry.title}`
  }, "Edit") : null, selectedLoreEntry && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: deleteLoreEntry,
    title: `Remove ${selectedLoreEntry.title}`
  }, "Remove") : null)), React.createElement("div", {
    className: "compendiumClassDetails"
  }, React.createElement("div", {
    className: "compendiumClassDetailsHeader"
  }, React.createElement("h2", null, selectedLoreEntry?.title || "No Entry Selected"), selectedLoreEntry && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumEditButton",
    onClick: () => openEditDialog(activeNarrativeCollection, {
      tabTitle: activeNarrativeTabTitle,
      sectionTitle: selectedLoreSection?.title || "",
      title: selectedLoreEntry.title,
      content: selectedLoreEntry.content || ""
    }),
    title: "Edit"
  }, "\u270E") : null), selectedLoreEntry ? React.createElement("article", {
    className: "compendiumCondition compendiumLoreCard"
  }, renderLoreContent(selectedLoreEntry.content || "")) : React.createElement("p", null, "No entry selected.")))));
  const weaponsContent = equipmentSection === "weapons" && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "compendiumToolbar"
  }, React.createElement("button", {
    type: "button",
    onClick: () => setShowWeaponFilters(prev => !prev)
  }, showWeaponFilters ? "Hide Filters" : "Show Filters"), React.createElement("label", null, "Sort", React.createElement("select", {
    value: weaponSortBy,
    onChange: e => setWeaponSortBy(e.target.value)
  }, ["name", "type", "damageType", "enduranceCost", "damage", "properties"].map(value => React.createElement("option", {
    key: value,
    value
  }, {
    name: "Name",
    type: "Weapon Type",
    damageType: "Damage Type",
    enduranceCost: "Evasion Cost",
    damage: "Damage Amount",
    properties: "Properties"
  }[value])))), React.createElement("button", {
    type: "button",
    onClick: resetWeaponFilters
  }, "Clear"), addButton("Weapon", addWeapon)), showWeaponFilters && React.createElement("div", {
    className: "compendiumFilterGrid"
  }, multiFilterGroup("Weapon Type", weaponTypes, weaponTypeFilters, setWeaponTypeFilters, weaponTypeFilterMode, setWeaponTypeFilterMode), [["Damage Type", damageTypeFilter, setDamageTypeFilter, damageTypes], ["Evasion Cost", evasionCostFilter, setEvasionCostFilter, evasionCosts], ["Damage", damageFilter, setDamageFilter, damageDice]].map(([label, value, setter, options]) => React.createElement("label", {
    key: label
  }, label, React.createElement("select", {
    value,
    onChange: event => setter(event.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All"), options.map(option => React.createElement("option", {
    key: option,
    value: option
  }, option))))), multiFilterGroup("Properties", weaponProperties, propertyFilters, setPropertyFilters, propertyFilterMode, setPropertyFilterMode)), React.createElement("div", {
    className: "compendiumTableWrap"
  }, React.createElement("table", {
    className: "compendiumWeaponTable"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    className: "compendiumFavoriteTableCell"
  }, "\u2606"), weaponTableHeaders.map(label => React.createElement("th", {
    key: label
  }, label)), canEdit ? React.createElement("th", null, "Edit") : null)), React.createElement("tbody", null, filteredWeapons.map(renderWeaponRow)))));
  const armorShieldsContent = equipmentSection === "armorShields" && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "compendiumToolbar"
  }, addButton("Armor", addArmor), addButton("Shield", addShield)), React.createElement("section", {
    className: "compendiumRankGroup"
  }, React.createElement("div", {
    className: "compendiumSectionTools"
  }, React.createElement("h3", null, getEquipmentSubsectionLabel("armor")), editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => renameEquipmentPageLabel("subsection", "armor", getEquipmentSubsectionLabel("armor")),
    title: `Rename ${getEquipmentSubsectionLabel("armor")}`
  }, "Rename") : null), React.createElement("div", {
    className: "compendiumTableWrap"
  }, React.createElement("table", {
    className: "compendiumWeaponTable"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    className: "compendiumFavoriteTableCell"
  }, "\u2606"), ["Name", "Base Evasion", "Toughness Bonus", "Dash Penalty", "Properties"].map(label => React.createElement("th", {
    key: label
  }, label)), canEdit ? React.createElement("th", null, "Edit") : null)), React.createElement("tbody", null, armors.map(renderArmorRow))))), React.createElement("section", {
    className: "compendiumRankGroup"
  }, React.createElement("div", {
    className: "compendiumSectionTools"
  }, React.createElement("h3", null, getEquipmentSubsectionLabel("shields")), editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => renameEquipmentPageLabel("subsection", "shields", getEquipmentSubsectionLabel("shields")),
    title: `Rename ${getEquipmentSubsectionLabel("shields")}`
  }, "Rename") : null), React.createElement("div", {
    className: "compendiumTableWrap"
  }, React.createElement("table", {
    className: "compendiumWeaponTable"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    className: "compendiumFavoriteTableCell"
  }, "\u2606"), ["Name", "Toughness Bonus", "Brace Endurance Cost", "Dash Penalty", "Properties"].map(label => React.createElement("th", {
    key: label
  }, label)), canEdit ? React.createElement("th", null, "Edit") : null)), React.createElement("tbody", null, shields.filter(shield => shield.name !== "No Shield").map(renderShieldRow))))));
  const equipmentPropertiesContent = equipmentSection === "equipmentProperties" && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "compendiumSectionTools"
  }, addButton("Equipment Property", addEquipmentProperty)), React.createElement("div", {
    className: "compendiumConditionGrid"
  }, equipmentProperties.map(equipmentPropertyCard)));
  const equipmentContent = (section === "equipment" || isCustomSectionKey(section) && activeCustomSectionType === "equipment") && React.createElement("section", {
    className: "compendiumSection"
  }, React.createElement("div", {
    className: "compendiumCategoryBar"
  }, [{
    key: "weapons",
    label: getEquipmentSectionLabel("weapons")
  }, {
    key: "armorShields",
    label: getEquipmentSectionLabel("armorShields")
  }, {
    key: "equipmentProperties",
    label: getEquipmentSectionLabel("equipmentProperties")
  }].map(item => React.createElement("button", {
    key: item.key,
    type: "button",
    className: equipmentSection === item.key ? "active" : "",
    onClick: () => setEquipmentSection(item.key)
  }, item.label)), editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => renameEquipmentPageLabel("section", equipmentSection, activeEquipmentSectionLabel),
    title: `Rename ${activeEquipmentSectionLabel}`
  }, "Rename") : null), weaponsContent, armorShieldsContent, equipmentPropertiesContent);
  const renderGridEntryEditorField = field => {
    const value = gridEntryEditorValues[field.key];
    const label = React.createElement("span", null, field.label, field.isTitle ? " *" : "");
    if (field.type === "boolean") {
      return React.createElement("label", {
        key: field.key,
        className: "compendiumGridFormCheckbox"
      }, React.createElement("input", {
        type: "checkbox",
        checked: value === true,
        onChange: event => updateGridEntryEditorValue(field, event.target.checked),
        disabled: isSavingEdit
      }), label);
    }
    if (field.type === "select") {
      return React.createElement("label", {
        key: field.key,
        className: "compendiumGridFormField"
      }, label, React.createElement("select", {
        value: String(value || ""),
        onChange: event => updateGridEntryEditorValue(field, event.target.value),
        disabled: isSavingEdit
      }, React.createElement("option", {
        value: ""
      }, "None"), (Array.isArray(field.options) ? field.options : []).map(option => React.createElement("option", {
        key: option,
        value: option
      }, option))));
    }
    if (field.type === "multiselect") {
      const selectedValues = Array.isArray(value) ? value : [];
      return React.createElement("label", {
        key: field.key,
        className: "compendiumGridFormField"
      }, label, React.createElement("select", {
        multiple: true,
        value: selectedValues,
        onChange: event => updateGridEntryEditorValue(field, [...event.target.selectedOptions].map(option => option.value)),
        disabled: isSavingEdit
      }, (Array.isArray(field.options) ? field.options : []).map(option => React.createElement("option", {
        key: option,
        value: option
      }, option))));
    }
    if (field.type === "paragraph") {
      const fieldSpellcheckIssues = loreSpellcheckIssues.filter(issue => String(issue?.fieldKey || "") === field.key);
      return React.createElement("label", {
        key: field.key,
        className: "compendiumGridFormField"
      }, label, React.createElement(CompendiumSpellcheckEditor, {
        value: String(value || ""),
        issues: fieldSpellcheckIssues,
        onChange: nextValue => updateGridEntryEditorValue(field, nextValue),
        onFocus: () => setActiveGridParagraphFieldKey(field.key),
        onContextMenu: event => handleLoreSpellcheckContextMenu(event, field.key),
        disabled: isSavingEdit,
        className: "compendiumGridRichText"
      }));
    }
    if (field.type === "textarea") {
      return React.createElement("label", {
        key: field.key,
        className: "compendiumGridFormField"
      }, label, React.createElement("textarea", {
        value: String(value || ""),
        onChange: event => updateGridEntryEditorValue(field, event.target.value),
        disabled: isSavingEdit,
        rows: 4
      }));
    }
    return React.createElement("label", {
      key: field.key,
      className: "compendiumGridFormField"
    }, label, React.createElement("input", {
      type: field.type === "number" ? "number" : "text",
      value: value ?? "",
      onChange: event => updateGridEntryEditorValue(field, field.type === "number" ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value),
      disabled: isSavingEdit
    }));
  };
  const gridEntryEditorForm = isGridEntryEditDialog ? React.createElement("div", {
    className: "compendiumGridForm"
  }, normalizeGridSchema(activeEditDialogGridSchema).map(renderGridEntryEditorField)) : null;
  const gridSchemaEditorForm = React.createElement("div", {
    className: "compendiumGridSchemaForm"
  }, gridSchemaDraftFields.map((field, index) => React.createElement("div", {
    key: `${field.key}-${index}`,
    className: "compendiumGridSchemaField"
  }, React.createElement("label", {
    className: "compendiumGridFormField"
  }, React.createElement("span", null, "Label"), React.createElement("input", {
    type: "text",
    value: field.label,
    onChange: event => updateGridSchemaDraftField(index, {
      label: event.target.value
    })
  })), React.createElement("label", {
    className: "compendiumGridFormField"
  }, React.createElement("span", null, "Key"), React.createElement("input", {
    type: "text",
    value: field.key,
    onChange: event => updateGridSchemaDraftField(index, {
      key: event.target.value
    })
  })), React.createElement("label", {
    className: "compendiumGridFormField"
  }, React.createElement("span", null, "Type"), React.createElement("select", {
    value: field.type,
    onChange: event => updateGridSchemaDraftField(index, {
      type: event.target.value
    })
  }, ["text", "textarea", "paragraph", "number", "select", "multiselect", "boolean"].map(type => React.createElement("option", {
    key: type,
    value: type
  }, type)))), field.type === "select" || field.type === "multiselect" ? React.createElement("label", {
    className: "compendiumGridFormField compendiumGridSchemaOptionsField"
  }, React.createElement("span", null, "Options"), React.createElement("input", {
    type: "text",
    value: getGridFieldOptionsText(field),
    onChange: event => updateGridSchemaDraftField(index, {
      options: event.target.value
    }),
    placeholder: "One, Two, Three"
  })) : null, React.createElement("label", {
    className: "compendiumGridFormCheckbox"
  }, React.createElement("input", {
    type: "radio",
    name: "grid-title-field",
    checked: field.isTitle === true,
    onChange: () => setGridSchemaTitleField(index)
  }), React.createElement("span", null, "Title field")), React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: () => removeGridSchemaDraftField(index)
  }, "Remove"))), React.createElement("div", {
    className: "compendiumSectionTools"
  }, React.createElement("button", {
    type: "button",
    className: "compendiumAddButton",
    onClick: addGridSchemaDraftField
  }, "Add Field")));
  const gridSchemaEditorPanel = activeGridSchemaScope && editToolsVisible ? React.createElement("div", {
    className: "compendiumGridEditorPanel"
  }, React.createElement("div", {
    className: "compendiumSectionTools"
  }, React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => setIsGridSchemaEditorOpen(true),
    title: "Edit Grid"
  }, "Edit Grid"))) : null;
  const gridSchemaEditorModal = activeGridSchemaScope && editToolsVisible && isGridSchemaEditorOpen ? React.createElement("div", {
    className: "compendiumEditOverlay",
    onClick: () => setIsGridSchemaEditorOpen(false)
  }, React.createElement("div", {
    className: "compendiumEditModal compendiumGridSchemaModal",
    onClick: event => event.stopPropagation()
  }, React.createElement("div", {
    className: "compendiumEditHeader"
  }, React.createElement("h2", null, "Edit Grid Fields")), React.createElement("textarea", {
    className: "compendiumHiddenGridSchemaJson",
    value: gridSchemaDraft,
    readOnly: true,
    tabIndex: -1,
    "aria-hidden": "true"
  }), gridSchemaEditorForm, React.createElement("div", {
    className: "compendiumEditMessage"
  }, "Choose each grid field's label, saved key, display type, and title field. Select and multiselect fields use comma-separated options."), React.createElement("div", {
    className: "compendiumSectionTools"
  }, React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => setIsGridSchemaEditorOpen(false),
    title: "Close Grid Editor"
  }, "Close"), React.createElement("button", {
    type: "button",
    className: "compendiumAddButton",
    onClick: saveGridSchemaDraft,
    title: "Save Grid Fields"
  }, "Save Grid Fields")), gridSchemaMessage ? React.createElement("div", {
    className: "compendiumEditMessage"
  }, gridSchemaMessage) : null)) : null;
  const gridContent = (section === "grid" || isCustomSectionKey(section) && activeCustomSectionType === "grid") && React.createElement("section", {
    className: "compendiumSection"
  }, React.createElement("div", {
    className: "compendiumSectionTools"
  }, addButton("Grid", addGrid)), gridSchemaEditorPanel, React.createElement("div", {
    className: "compendiumConditionGrid"
  }, grid.map(grid => traitCard("grid", grid, gridSchema))));
  const narrativeTabItems = [{
    key: "lore",
    label: "Lore"
  }, ...customSections.map(customSection => ({
    key: getCustomSectionKey(customSection.title),
    label: customSection.title
  }))];
  const activeNarrativeEmptyLabel = section === "lore" ? "No lore has been added yet." : "No sections have been added to this tab yet.";
  const isSelectedGridCategory = normalizeCustomSectionType(selectedLoreSection?.type || activeCustomSectionType) === "grid";
  const narrativeContent = (section === "lore" || isCustomSectionKey(section)) && React.createElement("section", {
    className: "compendiumSection"
  }, activeNarrativeCategories.length === 0 ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "compendiumLoreCategoryRow"
  }, React.createElement("div", {
    className: "compendiumCategoryBar"
  }), React.createElement("div", {
    className: "compendiumSectionTools compendiumLoreCategoryTools"
  }, addButton("Add", addLoreSection, {
    showPlus: false
  }))), React.createElement("p", null, activeNarrativeEmptyLabel)) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "compendiumLoreCategoryRow"
  }, React.createElement("div", {
    className: "compendiumCategoryBar"
  }, activeNarrativeCategories.map(loreSection => React.createElement("button", getReorderableButtonProps({
    key: loreSection.title,
    type: "button",
    className: selectedLoreSection?.title === loreSection.title ? "active" : "",
    style: getCompendiumAccentButtonStyle(loreSection.color, selectedLoreSection?.title === loreSection.title) || undefined
  }, {
    id: loreSection.title,
    kind: "category",
    scope: section === "lore" ? "lore" : `custom:${encodeURIComponent(activeNarrativeTabTitle)}`
  }, () => section === "lore" ? selectLoreSection(loreSection.title) : selectCustomSection(section, loreSection.title)), loreSection.title))), React.createElement("div", {
    className: "compendiumSectionTools compendiumLoreCategoryTools"
  }, addButton("Add", addLoreSection, {
    showPlus: false
  }), selectedLoreSection && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => openNavEditor(section === "lore" ? {
      kind: "lore-section",
      sectionTitle: selectedLoreSection.title,
      title: selectedLoreSection.title,
      color: selectedLoreSection.color
    } : {
      kind: "custom-section",
      tabTitle: activeNarrativeTabTitle,
      sectionTitle: selectedLoreSection.title,
      title: selectedLoreSection.title,
      color: selectedLoreSection.color
    }),
    title: `Edit ${selectedLoreSection.title}`
  }, "Edit") : null, selectedLoreSection && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: deleteLoreSection,
    title: `Remove ${selectedLoreSection.title}`
  }, "Remove") : null)), isSelectedGridCategory ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "compendiumSectionTools"
  }, editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumAddButton",
    onClick: () => addLoreEntry(true),
    title: "Add Grid"
  }, "Add Grid") : null), gridSchemaEditorPanel, React.createElement("div", {
    className: "compendiumConditionGrid"
  }, (Array.isArray(selectedLoreSection?.entries) ? selectedLoreSection.entries : []).length === 0 ? React.createElement("p", null, "No grid entries yet.") : (Array.isArray(selectedLoreSection?.entries) ? selectedLoreSection.entries : []).map(entry => traitCard("customSections", {
    tabTitle: activeNarrativeTabTitle,
    sectionTitle: selectedLoreSection?.title || "",
    ...entry
  }, selectedGridCategorySchema)))) : React.createElement("div", {
    className: "compendiumClassLayout"
  }, React.createElement("aside", {
    className: "compendiumClassList"
  }, (Array.isArray(selectedLoreSection?.entries) ? selectedLoreSection.entries : []).length === 0 ? React.createElement("p", null, "No subcategories yet.") : (Array.isArray(selectedLoreSection?.entries) ? selectedLoreSection.entries : []).map(entry => React.createElement("button", getReorderableButtonProps({
    key: entry.title,
    type: "button",
    className: selectedLoreEntry?.title === entry.title ? "active" : "",
    style: getCompendiumAccentButtonStyle(entry.color, selectedLoreEntry?.title === entry.title) || undefined
  }, {
    id: entry.title,
    kind: "entry",
    scope: section === "lore" ? `lore::${encodeURIComponent(selectedLoreSection?.title || "")}` : `custom-entry::${encodeURIComponent(activeNarrativeTabTitle)}::${encodeURIComponent(selectedLoreSection?.title || "")}`
  }, () => selectLoreEntry(entry.title)), isGridCustomEntry(entry, selectedLoreSection?.type || activeCustomSectionType) ? getGridEntryDisplayName(entry, activeGridSchema) : entry.title)), React.createElement("div", {
    className: "compendiumSectionTools compendiumLoreSubcategoryTools"
  }, addButton("Add", addLoreEntry, {
    showPlus: false
  }), selectedLoreEntry && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => openNavEditor(section === "lore" ? {
      kind: "lore-entry",
      sectionTitle: selectedLoreSection?.title || "",
      entryTitle: selectedLoreEntry.title,
      title: selectedLoreEntry.title,
      color: selectedLoreEntry.color
    } : {
      kind: "custom-entry",
      tabTitle: activeNarrativeTabTitle,
      sectionTitle: selectedLoreSection?.title || "",
      entryTitle: selectedLoreEntry.title,
      title: selectedLoreEntry.title,
      color: selectedLoreEntry.color
    }),
    title: `Edit ${selectedLoreEntry.title}`
  }, "Edit") : null, selectedLoreEntry && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: deleteLoreEntry,
    title: `Remove ${selectedLoreEntry.title}`
  }, "Remove") : null)), React.createElement("div", {
    className: "compendiumClassDetails"
  }, React.createElement("div", {
    className: "compendiumClassDetailsHeader compendiumLoreHeader"
  }, selectedLoreEntry && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumEditButton",
    onClick: () => openEditDialog(activeNarrativeCollection, isGridCustomEntry(selectedLoreEntry, selectedLoreSection?.type || activeCustomSectionType) ? {
      ...(activeNarrativeCollection === "customSections" ? {
        tabTitle: activeNarrativeTabTitle
      } : {}),
      sectionTitle: selectedLoreSection?.title || "",
      ...selectedLoreEntry
    } : {
      ...(activeNarrativeCollection === "customSections" ? {
        tabTitle: activeNarrativeTabTitle
      } : {}),
      sectionTitle: selectedLoreSection?.title || "",
      title: selectedLoreEntry.title,
      content: selectedLoreEntry.content || ""
    }),
    title: "Edit"
  }, "\u270E") : null), selectedLoreEntry ? React.createElement("article", {
    className: "compendiumCondition compendiumLoreCard"
  }, renderLoreContent(selectedLoreEntry.content || "")) : React.createElement("p", null, "No lore entry selected.")))));
  const searchResultsContent = searchResults.length === 0 ? React.createElement("div", {
    className: "compendiumSearchEmpty"
  }, "No matches found.") : searchResults.map(result => React.createElement("button", {
    key: `${result.kind}-${result.title}-${result.meta || ""}`,
    type: "button",
    className: "compendiumSearchResult",
    onClick: () => handleSearchResultSelect(result)
  }, React.createElement("span", {
    className: "compendiumSearchResultTitle"
  }, result.title), React.createElement("span", {
    className: "compendiumSearchResultMeta"
  }, result.meta)));
  const reorderPreview = reorderState ? React.createElement("div", {
    className: "compendiumDragPreview"
  }, React.createElement("button", {
    type: "button",
    className: "compendiumDragPreviewButton",
    style: {
      width: `${Math.max(72, reorderState.width || 0)}px`,
      minHeight: `${Math.max(34, reorderState.height || 0)}px`,
      transform: `translate(${(reorderState.pointerX || 0) - (reorderState.offsetX || 0)}px, ${(reorderState.pointerY || 0) - (reorderState.offsetY || 0)}px)`
    }
  }, reorderState.label || "")) : null;
  const navEditModal = navEditDialog ? React.createElement("div", {
    className: "compendiumEditOverlay",
    onClick: closeNavEditor
  }, React.createElement("div", {
    className: "compendiumEditModal compendiumNavEditModal",
    onClick: event => event.stopPropagation()
  }, React.createElement("div", {
    className: "compendiumEditHeader"
  }, React.createElement("h2", null, "Edit Item")), React.createElement("div", {
    className: "compendiumNavEditFields"
  }, React.createElement("label", {
    className: "compendiumNavEditField"
  }, React.createElement("span", null, "Name"), React.createElement("input", {
    type: "text",
    value: navEditTitle,
    onChange: event => setNavEditTitle(event.target.value),
    disabled: isSavingNavEdit
  })), React.createElement("label", {
    className: "compendiumNavEditCheckbox"
  }, React.createElement("input", {
    type: "checkbox",
    checked: navEditUseDefaultColor,
    onChange: event => setNavEditUseDefaultColor(event.target.checked),
    disabled: isSavingNavEdit
  }), React.createElement("span", null, "Use default compendium color")), React.createElement("label", {
    className: "compendiumNavEditField"
  }, React.createElement("span", null, "Color"), React.createElement("div", {
    className: "compendiumNavEditColorRow"
  }, React.createElement("input", {
    type: "color",
    value: navEditColor,
    onChange: event => setNavEditColor(event.target.value),
    disabled: navEditUseDefaultColor || isSavingNavEdit
  }), React.createElement("code", null, navEditUseDefaultColor ? "Theme default" : navEditColor.toUpperCase()))), React.createElement("div", {
    className: "compendiumNavEditPreviewRow"
  }, React.createElement("span", null, "Preview"), React.createElement("button", {
    type: "button",
    style: getCompendiumAccentButtonStyle(navEditUseDefaultColor ? "" : navEditColor, false) || undefined,
    disabled: true
  }, navEditTitle.trim() || "Preview"))), navEditMessage ? React.createElement("div", {
    className: "compendiumEditMessage"
  }, navEditMessage) : null, React.createElement("div", {
    className: "compendiumEditActions"
  }, React.createElement("button", {
    type: "button",
    onClick: closeNavEditor,
    disabled: isSavingNavEdit
  }, "Close"), React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: saveNavEditor,
    disabled: isSavingNavEdit
  }, isSavingNavEdit ? "Saving..." : "Save")))) : null;
  const editModal = editDialog && React.createElement("div", {
    className: "compendiumEditOverlay"
  }, React.createElement("div", {
    className: "compendiumEditModal",
    onClick: event => event.stopPropagation()
  }, React.createElement("div", {
    className: "compendiumEditHeader"
  }, React.createElement("h2", null, editDialog.mode === "add" ? "Add Entry" : "Edit Entry"), (editDialog?.collection === "loreSections" || editDialog?.collection === "customSections" && !isGridCustomEditDialog || isGridEntryEditDialog) && React.createElement("label", {
    className: "compendiumUploadButton"
  }, "Upload Image", React.createElement("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp",
    className: "compendiumHiddenFileInput",
    onChange: event => {
      insertLoreImageFromFile(event.target.files?.[0] || null);
      event.target.value = "";
    }
  }))), editDialog?.collection === "loreSections" || editDialog?.collection === "customSections" && !isGridCustomEditDialog ? React.createElement("textarea", {
    ref: editTextareaRef,
    className: "compendiumEditTextarea",
    value: editText,
    onChange: event => setEditText(event.target.value),
    onContextMenu: handleLoreSpellcheckContextMenu,
    onKeyDown: event => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const textarea = event.currentTarget;
      const selectionStart = textarea.selectionStart ?? editText.length;
      const selectionEnd = textarea.selectionEnd ?? editText.length;
      const nextValue = editText.slice(0, selectionStart) + "\t" + editText.slice(selectionEnd);
      setEditText(nextValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = selectionStart + 1;
        textarea.selectionEnd = selectionStart + 1;
      });
    },
    spellCheck: false,
    lang: "en-US",
    autoCorrect: "on",
    autoCapitalize: "sentences"
  }) : isGridEntryEditDialog ? gridEntryEditorForm : React.createElement("textarea", {
    ref: editTextareaRef,
    className: "compendiumEditTextarea",
    value: editText,
    onChange: event => setEditText(event.target.value),
    onKeyDown: event => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const textarea = event.currentTarget;
      const selectionStart = textarea.selectionStart ?? editText.length;
      const selectionEnd = textarea.selectionEnd ?? editText.length;
      const nextValue = editText.slice(0, selectionStart) + "\t" + editText.slice(selectionEnd);
      setEditText(nextValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = selectionStart + 1;
        textarea.selectionEnd = selectionStart + 1;
      });
    },
    spellCheck: false
  }), (editDialog?.collection === "loreSections" || editDialog?.collection === "customSections" && !isGridCustomEditDialog) && React.createElement("div", {
    className: "compendiumEditMessage"
  }, "Lore supports headings with #, ##, or ###, bullet lists with - item, numbered lists with 1. item, images with ![Caption](image-name.webp) from compendium/images, auto-compressed uploads from the Upload Image button, blank lines for paragraph spacing, Tab indentation, and markdown-style tables using | columns and an optional |---| separator row."), isGridEntryEditDialog && React.createElement("div", {
    className: "compendiumEditMessage"
  }, "Paragraph fields support headings with #, ##, or ###, links with <Entry Name>, bullet lists with - item, numbered lists with 1. item, images with ![Caption](image-name.webp), blank lines, spellcheck, and markdown-style tables using | columns."), editMessage && React.createElement("div", {
    className: "compendiumEditMessage"
  }, editMessage), React.createElement("div", {
    className: "compendiumEditActions"
  }, canDeleteEditDialogEntry ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: deleteEditDialogEntry,
    disabled: isSavingEdit
  }, "Delete") : null, React.createElement("button", {
    type: "button",
    onClick: closeEditDialog,
    disabled: isSavingEdit
  }, "Cancel"), React.createElement("button", {
    type: "button",
    onClick: saveEditDialog,
    disabled: isSavingEdit
  }, isSavingEdit ? "Saving..." : "Save")), loreSpellcheckMenu?.issue ? React.createElement("div", {
    className: "compendiumSpellcheckMenu",
    onMouseDown: event => event.stopPropagation(),
    style: {
      left: `${loreSpellcheckMenu.x}px`,
      top: `${loreSpellcheckMenu.y}px`
    }
  }, loreSpellcheckMenu.issue.suggestions.map(suggestion => React.createElement("button", {
    key: suggestion,
    type: "button",
    className: "compendiumSpellcheckMenuItem",
    onMouseDown: event => {
      event.preventDefault();
      event.stopPropagation();
      applyLoreSpellcheckSuggestion(loreSpellcheckMenu.issue, suggestion);
    }
  }, suggestion))) : null));
  const imageManagerModal = isImageManagerOpen && React.createElement("div", {
    className: "compendiumEditOverlay",
    onClick: () => setIsImageManagerOpen(false)
  }, React.createElement("div", {
    className: "compendiumImageManagerModal",
    onClick: event => event.stopPropagation()
  }, React.createElement("div", {
    className: "compendiumEditHeader"
  }, React.createElement("h2", null, "Compendium Images"), React.createElement("label", {
    className: "compendiumUploadButton"
  }, pendingImageName === "__upload__" ? "Uploading..." : "Upload Image", React.createElement("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp",
    className: "compendiumHiddenFileInput",
    disabled: pendingImageName === "__upload__",
    onChange: event => {
      uploadCompendiumImageToLibrary(event.target.files?.[0] || null);
      event.target.value = "";
    }
  }))), compendiumImageMessage ? React.createElement("div", {
    className: "compendiumEditMessage"
  }, compendiumImageMessage) : null, React.createElement("div", {
    className: "compendiumImageLibrary"
  }, isCompendiumImagesLoading ? React.createElement("p", null, "Loading images...") : compendiumImages.length === 0 ? React.createElement("p", null, "No images uploaded yet.") : compendiumImages.map(image => React.createElement("article", {
    key: image.fileName,
    className: "compendiumImageCard"
  }, React.createElement("img", {
    className: "compendiumImageCardPreview",
    src: `${API_URL}${image.imageUrl}`,
    alt: image.fileName,
    loading: "lazy"
  }), React.createElement("div", {
    className: "compendiumImageCardMeta"
  }, React.createElement("div", {
    className: "compendiumImageCardName"
  }, image.fileName), React.createElement("div", {
    className: "compendiumImageCardDetails"
  }, `${Math.max(1, Math.round((Number(image.size) || 0) / 1024))} KB`, image.updatedAt ? ` | ${new Date(image.updatedAt).toLocaleString()}` : "")), React.createElement("div", {
    className: "compendiumImageCardActions"
  }, React.createElement("button", {
    type: "button",
    onClick: () => copyCompendiumImageLink(image),
    disabled: pendingImageName === image.fileName
  }, "Copy Link"), React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => renameCompendiumImage(image),
    disabled: pendingImageName === image.fileName
  }, "Rename"), React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: () => deleteCompendiumImage(image),
    disabled: pendingImageName === image.fileName
  }, "Delete"))))), React.createElement("div", {
    className: "compendiumEditActions"
  }, React.createElement("button", {
    type: "button",
    onClick: () => setIsImageManagerOpen(false)
  }, "Close"))));
  const favoritesContent = section === FAVORITES_SECTION_KEY && React.createElement("section", {
    className: "compendiumSection"
  }, React.createElement("div", {
    className: "compendiumFavoritesHeader"
  }, React.createElement("div", null, React.createElement("h2", null, "Favorites"), React.createElement("p", {
    className: "compendiumFavoritesSummary"
  }, currentUser ? "Saved to your account for quick reference." : "Saved in this browser until you sign in.")), React.createElement("div", {
    className: "compendiumFavoritesCount"
  }, isFavoriteListLoading ? "Loading..." : `${favoriteItems.length} saved`)), favoriteItems.length === 0 && !isFavoriteListLoading ? React.createElement("p", null, "Star grid or lore blocks to keep them here for quick reference.") : null, React.createElement("div", {
    className: "compendiumConditionGrid compendiumFavoritesGrid"
  }, favoriteItems.map(favorite => React.createElement("article", {
    key: favorite.favoriteKey,
    className: "compendiumCondition compendiumFavoriteCard"
  }, React.createElement("div", {
    className: "compendiumFavoriteCardHeader"
  }, React.createElement("div", null, React.createElement("h3", null, favorite.entryTitle), React.createElement("div", {
    className: "compendiumFavoriteMeta"
  }, formatFavoriteLocation(favorite))), React.createElement("button", {
    type: "button",
    className: "compendiumFavoriteStar active",
    onClick: () => toggleFavorite(favorite),
    disabled: favoritePendingKeySet.has(favorite.favoriteKey),
    title: "Remove favorite"
  }, "\u2605")), React.createElement("pre", {
    className: "compendiumFavoriteExcerpt"
  }, favorite.blockText), React.createElement("div", {
    className: "compendiumFavoriteActions"
  }, React.createElement("button", {
    type: "button",
    onClick: () => openFavoriteSource(favorite)
  }, "Open Source"))))));
  const headerContent = React.createElement("div", {
    className: "compendiumHeader"
  }, React.createElement("div", null, React.createElement("div", {
    className: "folioKicker"
  }, "Reference Log"), React.createElement("h1", {
    className: "sectionTitle"
  }, "Compendium")), React.createElement("div", {
    className: "compendiumHeaderControls"
  }, editToolsVisible ? React.createElement("div", {
    className: "compendiumHeaderToolRow"
  }, React.createElement("button", {
    type: "button",
    className: "compendiumUploadButton",
    onClick: () => setIsImageManagerOpen(true)
  }, "Manage Images")) : null, React.createElement("label", {
    className: "compendiumSearchShell"
  }, React.createElement("span", {
    className: "compendiumSearchLabel"
  }, "Search"), React.createElement("input", {
    className: "compendiumSearchInput",
    type: "search",
    value: searchQuery,
    onChange: event => setSearchQuery(event.target.value),
    placeholder: "Search the compendium"
  }), searchQuery.trim() ? React.createElement("div", {
    className: "compendiumSearchResults"
  }, searchResultsContent) : null, favoriteMessage ? React.createElement("div", {
    className: "compendiumFavoriteMessage"
  }, favoriteMessage) : null)));
  const navContent = React.createElement("div", {
    className: "compendiumNavRow"
  }, React.createElement("div", {
    className: "compendiumNav"
  }, React.createElement("button", {
    type: "button",
    className: section === FAVORITES_SECTION_KEY ? "active" : "",
    onClick: openFavoritesSection,
    title: "Open your favorites"
  }, `Favorites (${favoriteItems.length})`), navItems.map(item => React.createElement("button", getReorderableButtonProps({
    key: item.key,
    type: "button",
    className: section === item.key ? "active" : "",
    style: getCompendiumAccentButtonStyle(item.color, section === item.key) || undefined
  }, {
    id: item.key,
    kind: "tab",
    scope: "tabs"
  }, () => setSection(item.key)), item.label))), React.createElement("div", {
    className: "compendiumNavActions"
  }, addButton("Add", addCustomTab, {
    showPlus: false
  }), isBuiltInSectionKey(section) && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => openNavEditor({
      kind: "built-in-tab",
      tabKey: section,
      title: activeBuiltInTabLabel,
      color: activeBuiltInTabColor
    }),
    title: `Edit ${activeBuiltInTabLabel}`
  }, "Edit") : null, isBuiltInSectionKey(section) && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: removeBuiltInTab,
    title: `Remove ${activeBuiltInTabLabel}`
  }, "Remove") : null, isCustomSectionKey(section) && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumRenameButton",
    onClick: () => openNavEditor({
      kind: "custom-tab",
      tabTitle: activeNarrativeTabTitle,
      title: activeNarrativeTabTitle,
      color: activeCustomTabColor
    }),
    title: `Edit ${activeNarrativeTabTitle}`
  }, "Edit") : null, isCustomSectionKey(section) && editToolsVisible ? React.createElement("button", {
    type: "button",
    className: "compendiumDeleteButton",
    onClick: deleteCustomTab,
    title: `Remove ${activeNarrativeTabTitle}`
  }, "Remove") : null));
  const writerToolsToggle = canEdit ? React.createElement("button", {
    type: "button",
    className: `compendiumWriterToggle${editToolsVisible ? " active" : ""}`,
    onClick: () => setShowWriterTools(visible => {
      const nextVisible = !visible;
      persistCurrentCompendiumNavState({
        showWriterTools: nextVisible
      });
      return nextVisible;
    }),
    title: editToolsVisible ? "Hide writer tools" : "Show writer tools"
  }, editToolsVisible ? "Hide Writer Tools" : "Show Writer Tools") : null;
  return React.createElement("main", {
    className: "compendiumPage"
  }, headerContent, navContent, favoritesContent, gridContent, narrativeContent, navEditModal, editModal, gridSchemaEditorModal, imageManagerModal, writerToolsToggle, reorderPreview);
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(CompendiumApp, null));
