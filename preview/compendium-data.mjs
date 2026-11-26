const expeditionTerrains = {
  plains: 'Plains',
  forest: 'Forest',
  mountains: 'Mountains',
  swamp: 'Swamp',
  desert: 'Desert',
  arctic: 'Arctic',
  ocean: 'Ocean',
};

function titleFor(key) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
    .replace(/^./, letter => letter.toUpperCase());
}

function namedItems(items, convert) {
  const usedIds = new Set();
  return (items ?? []).map((item, index) => {
    const base = String(item.id ?? item.title ?? item.name ?? '').trim() || String(index + 1);
    let id = base;
    for (let suffix = 2; usedIds.has(id); suffix++) id = `${base}-${suffix}`;
    usedIds.add(id);
    return { ...convert(item, id), id };
  });
}

function compendiumBuilder() {
  const collections = [];
  function page(id, title, type, entries, options) {
    const collectionId = `collection-${collections.length + 1}`;
    collections.push({ id: collectionId, entries });
    return { id, title, type, collectionId, ...options };
  }
  return { collections, page };
}

export function expeditionCompendium(data) {
  if (Array.isArray(data?.tabs)) return data;
  if (!data?.tileTypes || typeof data.tileTypes !== 'object' || Array.isArray(data.tileTypes)) {
    throw new Error('The Expedition location compendium is missing terrain data.');
  }

  const { page, collections } = compendiumBuilder();
  const sections = Object.entries(data.tileTypes).flatMap(([terrain, locations]) => {
    const entries = Object.entries(locations).map(([number, location]) => ({
      id: number,
      title: location.title?.trim() || `Location ${number}`,
      content: location.description ?? '',
      locationNumber: number,
    }));
    if (!entries.length) return [];
    return page(terrain, expeditionTerrains[terrain] ?? titleFor(terrain), 'normal', entries, {
      fields: [{ key: 'locationNumber', label: 'Location number' }],
    });
  });
  return { tabs: [{ id: 'locations', title: 'Locations', type: 'normal', sections }], collections };
}

const pyrrhicEquipment = [
  ['weapons', 'Weapons', 'weapons'],
  ['armors', 'Armor', 'armorShields', 'Armor / Shields', 'armor'],
  ['shields', 'Shields', 'armorShields', 'Armor / Shields', 'shields'],
  ['equipmentProperties', 'Equipment Properties', 'equipmentProperties'],
];

function pyrrhicEntries(entries) {
  const uploadPath = /(!\[[^\]\r\n]*\]\(\s*)\/games\/PyrrhicWar\/compendium\/images\/([a-z0-9-]+\.(?:png|jpg|webp)\s*\))/gi;
  return namedItems(entries, entry => Object.fromEntries(Object.entries(entry).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.replace(uploadPath, '$1$2') : value,
  ])));
}

function legacySections(page, sections, tabType, tabFields) {
  return namedItems(sections, (section, id) => {
    const type = section.type ? legacyPageType(section.type) : tabType;
    return page(id, section.title ?? section.name ?? id, type, pyrrhicEntries(section.entries), {
      color: section.color,
      fields: section.gridSchema ?? tabFields,
    });
  });
}

function legacyPageType(type) {
  return type === 'grid' || type === 'conditions' ? 'grid' : 'normal';
}

function classOptions(data) {
  const groups = data.classPageStructure?.groups ?? [];
  const known = new Set(groups.flatMap(group => group.classes));
  const otherClasses = [...new Set((data.classAbilities ?? []).map(entry => entry.class).filter(Boolean))]
    .filter(name => !known.has(name));
  const structure = otherClasses.length
    ? [...groups, { key: 'other-classes', classes: otherClasses }]
    : groups;
  return {
    classPageLabels: {
      ...data.classPageLabels,
      groupLabels: { 'other-classes': 'Other Classes', ...data.classPageLabels?.groupLabels },
    },
    classPageStructure: structure.length ? { groups: structure } : undefined,
  };
}

export function pyrrhicWarCompendium(data) {
  if (Array.isArray(data?.tabs)) return data;
  if (!data || !['loreSections', 'grid', 'conditions', 'customSections', 'classAbilities', 'weapons']
    .some(key => Array.isArray(data[key]))) {
    throw new Error('The Pyrrhic War compendium has an unrecognized data format.');
  }

  const { page, collections } = compendiumBuilder();
  const { builtInTabs = {}, equipmentPageLabels = {} } = data;
  const lore = builtInTabs.lore ?? {};
  const grid = builtInTabs.grid ?? builtInTabs.conditions ?? {};
  const sections = pyrrhicEquipment.map(([key, defaultTitle, group, defaultGroupTitle, subcategory]) =>
    page(key, equipmentPageLabels.subsectionLabels?.[subcategory] ??
      equipmentPageLabels.sectionLabels?.[key] ?? defaultTitle, 'table', pyrrhicEntries(data[key]), {
      navigationGroup: {
        id: group,
        title: equipmentPageLabels.sectionLabels?.[group] ?? defaultGroupTitle ?? defaultTitle,
      },
    }));
  const tabs = new Map([
    ['lore', lore.visible === false ? null : {
      id: 'lore', title: lore.label || 'Lore', type: 'normal', color: lore.color,
      sections: legacySections(page, data.loreSections, 'normal'),
    }],
    ['grid', grid.visible === false ? null : page('grid', grid.label || 'Grid', 'grid',
      pyrrhicEntries(data.grid ?? data.conditions), { color: grid.color, fields: data.gridSchema })],
  ]);

  if (data.classAbilities?.length) {
    tabs.set('classes', page('classes', builtInTabs.classes?.label || 'Classes', 'classes',
      pyrrhicEntries(data.classAbilities), classOptions(data)));
  }
  if (pyrrhicEquipment.some(([key]) => data[key]?.length)) {
    tabs.set('equipment', { id: 'equipment', title: 'Equipment', type: 'table', sections });
  }

  for (const tab of namedItems(data.customSections, item => item)) {
    const type = legacyPageType(tab.type);
    const id = `custom:${tab.id}`;
    const key = `custom:${tab.title}`;
    tabs.set(tabs.has(key) ? id : key, page(id, tab.title ?? tab.id, type, pyrrhicEntries(tab.entries), {
      color: tab.color,
      fields: tab.gridSchema,
      sections: legacySections(page, tab.sections, type, tab.gridSchema),
    }));
  }

  const requested = (data.tabOrder ?? []).map(key => key === 'conditions' ? 'grid' : key);
  const order = [...new Set([...requested, ...tabs.keys()])];
  return { tabs: order.map(key => tabs.get(key)).filter(Boolean), collections };
}
