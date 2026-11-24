/**
 * Almacenamiento local, esquema V8.0, migración segura (solo Clientes y Productores)
 * y exportación/importación nativa o web.
 */
import { DEFAULT_RATES, roundCop } from './money.js';

export const V8_STORAGE_KEY = 'colados_app_v8';
export const LEGACY_STORAGE_KEY = 'colados_app_v6';

export const DEFAULT_CATALOG = [
  { id: 1, name: '200g Bolsa Especial', priceCop: 15000, grams: 200, packType: 'especial', hasLabel: true },
  { id: 2, name: '400g Bolsa Especial', priceCop: 25000, grams: 400, packType: 'especial', hasLabel: true },
  { id: 3, name: '250g Transparente/Granel', priceCop: 10000, grams: 250, packType: 'transparente', hasLabel: false },
  { id: 4, name: '500g Transparente/Granel', priceCop: 20000, grams: 500, packType: 'transparente', hasLabel: false },
  { id: 5, name: '1 Kg Transparente/Granel', priceCop: 40000, grams: 1000, packType: 'transparente', hasLabel: false },
];

export const DEFAULT_SUPPLIES = {
  bolsas_especiales: 0,
  bolsas_transparentes: 0,
  etiquetas: 0,
  stickers_grandes: 0,
  stickers_pequenos: 0,
  alerta_umbral: 10,
};

export const DEFAULT_COST_CONFIG = {
  sourceMode: 'pergamino', // 'pergamino' | 'azul' | 'auto_purchases'
  precioKgPergaminoCop: 17000,
  mermaTrillaPct: 21,
  precioKgAzulCop: 20500,
  mermaTuestePct: 20,
  costoGasKgTostadoCop: 600,
  costoMolinoKgCop: 300,
  costoBolsaEspecialCop: 1000,
  costoBolsaTransparenteCop: 40,
  valorHoraCop: 8000,
  horasTanda: 1.5,
  kgTanda: 4,
  costosFijosMesCop: 250000,
  useRealOpexForFixed: false,
  volumenMensualMetaKg: 50,
  prorrateoMode: 'projected', // 'projected' | 'real'
  margenObjetivoPct: 35,
};

export function createFreshV8State(overrides = {}) {
  return {
    schemaVersion: 8,
    theme: 'light',
    displayCurrency: 'COP',
    rates: { ...DEFAULT_RATES },
    inventoryGrams: { pergamino: 0, azul: 0, tostado: 0 },
    openingInventoryGrams: { pergamino: 0, azul: 0, tostado: 0 },
    supplies: { ...DEFAULT_SUPPLIES },
    catalog: DEFAULT_CATALOG.map((item) => ({ ...item })),
    costConfig: { ...DEFAULT_COST_CONFIG },
    clients: [],
    producers: [],
    sales: [],
    purchases: [],
    expenses: [],
    processHistory: [],
    activeProcesses: [],
    orders: [],
    invoiceCounter: 1,
    ...overrides,
  };
}

function safePositiveNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function safeNonNegativeInt(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : fallback;
}

export function normalizeClients(rawClients) {
  if (!Array.isArray(rawClients)) return [];
  const seen = new Set();
  const result = [];
  const baseTs = Date.now();

  rawClients.forEach((entry, idx) => {
    const isString = typeof entry === 'string';
    const rawName = isString ? entry : (entry?.fullName || entry?.name || '');
    const fullName = String(rawName).trim();
    if (!fullName) return;

    const key = fullName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    result.push({
      id: (!isString && entry?.id) ? entry.id : baseTs + idx,
      fullName,
      business: isString ? '' : String(entry?.business || '').trim(),
      sector: isString ? '' : String(entry?.sector || '').trim(),
      phone: isString ? '' : String(entry?.phone || '').trim(),
    });
  });

  return result;
}

export function normalizeProducers(rawProducers) {
  if (!Array.isArray(rawProducers)) return [];
  const seen = new Set();
  const result = [];
  const baseTs = Date.now();

  rawProducers.forEach((entry, idx) => {
    const isString = typeof entry === 'string';
    const rawName = isString ? entry : (entry?.name || entry?.fullName || '');
    const name = String(rawName).trim();
    if (!name) return;

    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    result.push({
      id: (!isString && entry?.id) ? entry.id : baseTs + idx + 1000,
      name,
      finca: isString ? '' : String(entry?.finca || '').trim(),
      sector: isString ? '' : String(entry?.sector || '').trim(),
      phone: isString ? '' : String(entry?.phone || '').trim(),
    });
  });

  return result;
}

export function normalizeCatalog(rawCatalog) {
  if (!Array.isArray(rawCatalog) || rawCatalog.length === 0) {
    return DEFAULT_CATALOG.map((item) => ({ ...item }));
  }
  return rawCatalog
    .map((item, idx) => {
      const name = String(item?.name || '').trim();
      if (!name) return null;
      const grams = Number.isFinite(Number(item?.grams)) && Number(item.grams) > 0
        ? Math.round(Number(item.grams))
        : Math.max(1, Math.round((Number(item?.deductKg) || 1) * 1000));
      const packType = item?.packType === 'especial' || item?.bagType === 'bolsas_kraft'
        ? 'especial'
        : 'transparente';
      return {
        id: item?.id ?? idx + 1,
        name,
        priceCop: roundCop(item?.priceCop ?? item?.price ?? 0),
        grams,
        packType,
        hasLabel: item?.hasLabel !== undefined ? Boolean(item.hasLabel) : packType === 'especial',
      };
    })
    .filter(Boolean);
}

export function normalizeV8State(raw) {
  const base = createFreshV8State();
  if (!raw || typeof raw !== 'object') return base;

  const rawRates = raw.rates || {};
  const rates = {
    usd_cop: safePositiveNumber(rawRates.usd_cop, DEFAULT_RATES.usd_cop),
    cop_bs: safePositiveNumber(rawRates.cop_bs, DEFAULT_RATES.cop_bs),
  };

  const rawInv = raw.inventoryGrams || {};
  const inventoryGrams = {
    pergamino: safeNonNegativeInt(rawInv.pergamino, 0),
    azul: safeNonNegativeInt(rawInv.azul, 0),
    tostado: safeNonNegativeInt(rawInv.tostado, 0),
  };

  const rawOpen = raw.openingInventoryGrams || {};
  const openingInventoryGrams = {
    pergamino: safeNonNegativeInt(rawOpen.pergamino, 0),
    azul: safeNonNegativeInt(rawOpen.azul, 0),
    tostado: safeNonNegativeInt(rawOpen.tostado, 0),
  };

  const rawSup = raw.supplies || {};
  const supplies = {
    bolsas_especiales: safeNonNegativeInt(rawSup.bolsas_especiales, 0),
    bolsas_transparentes: safeNonNegativeInt(rawSup.bolsas_transparentes, 0),
    etiquetas: safeNonNegativeInt(rawSup.etiquetas, 0),
    stickers_grandes: safeNonNegativeInt(rawSup.stickers_grandes, 0),
    stickers_pequenos: safeNonNegativeInt(rawSup.stickers_pequenos, 0),
    alerta_umbral: safeNonNegativeInt(rawSup.alerta_umbral, DEFAULT_SUPPLIES.alerta_umbral),
  };

  const rawCost = raw.costConfig || {};
  const costConfig = {
    sourceMode: ['pergamino', 'azul', 'auto_purchases'].includes(rawCost.sourceMode)
      ? rawCost.sourceMode
      : DEFAULT_COST_CONFIG.sourceMode,
    precioKgPergaminoCop: safeNonNegativeInt(rawCost.precioKgPergaminoCop, DEFAULT_COST_CONFIG.precioKgPergaminoCop),
    mermaTrillaPct: Number.isFinite(Number(rawCost.mermaTrillaPct))
      ? Math.min(90, Math.max(0, Number(rawCost.mermaTrillaPct)))
      : DEFAULT_COST_CONFIG.mermaTrillaPct,
    precioKgAzulCop: safeNonNegativeInt(rawCost.precioKgAzulCop, DEFAULT_COST_CONFIG.precioKgAzulCop),
    mermaTuestePct: Number.isFinite(Number(rawCost.mermaTuestePct))
      ? Math.min(90, Math.max(0, Number(rawCost.mermaTuestePct)))
      : DEFAULT_COST_CONFIG.mermaTuestePct,
    costoGasKgTostadoCop: safeNonNegativeInt(rawCost.costoGasKgTostadoCop, DEFAULT_COST_CONFIG.costoGasKgTostadoCop),
    costoMolinoKgCop: safeNonNegativeInt(rawCost.costoMolinoKgCop, DEFAULT_COST_CONFIG.costoMolinoKgCop),
    costoBolsaEspecialCop: safeNonNegativeInt(rawCost.costoBolsaEspecialCop, DEFAULT_COST_CONFIG.costoBolsaEspecialCop),
    costoBolsaTransparenteCop: safeNonNegativeInt(rawCost.costoBolsaTransparenteCop, DEFAULT_COST_CONFIG.costoBolsaTransparenteCop),
    valorHoraCop: safeNonNegativeInt(rawCost.valorHoraCop, DEFAULT_COST_CONFIG.valorHoraCop),
    horasTanda: safePositiveNumber(rawCost.horasTanda, DEFAULT_COST_CONFIG.horasTanda),
    kgTanda: safePositiveNumber(rawCost.kgTanda, DEFAULT_COST_CONFIG.kgTanda),
    costosFijosMesCop: safeNonNegativeInt(rawCost.costosFijosMesCop, DEFAULT_COST_CONFIG.costosFijosMesCop),
    useRealOpexForFixed: Boolean(rawCost.useRealOpexForFixed),
    volumenMensualMetaKg: safePositiveNumber(rawCost.volumenMensualMetaKg, DEFAULT_COST_CONFIG.volumenMensualMetaKg),
    prorrateoMode: rawCost.prorrateoMode === 'real' ? 'real' : 'projected',
    margenObjetivoPct: Number.isFinite(Number(rawCost.margenObjetivoPct))
      ? Math.min(90, Math.max(0, Number(rawCost.margenObjetivoPct)))
      : DEFAULT_COST_CONFIG.margenObjetivoPct,
  };

  return {
    schemaVersion: 8,
    theme: raw.theme === 'dark' ? 'dark' : 'light',
    displayCurrency: ['COP', 'USD', 'BS'].includes(raw.displayCurrency) ? raw.displayCurrency : 'COP',
    rates,
    inventoryGrams,
    openingInventoryGrams,
    supplies,
    catalog: normalizeCatalog(raw.catalog),
    costConfig,
    clients: normalizeClients(raw.clients),
    producers: normalizeProducers(raw.producers),
    sales: Array.isArray(raw.sales) ? raw.sales : [],
    purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    processHistory: Array.isArray(raw.processHistory) ? raw.processHistory : [],
    activeProcesses: Array.isArray(raw.activeProcesses) ? raw.activeProcesses : [],
    orders: Array.isArray(raw.orders) ? raw.orders : [],
    invoiceCounter: Math.max(1, safeNonNegativeInt(raw.invoiceCounter, 1)),
  };
}

/**
 * Migra desde colados_app_v6 conservando ÚNICAMENTE Clientes y Productores
 * (más tasas válidas si existen). Todo inventario, ventas, compras, gastos y
 * procesos anteriores se dejan limpios para evitar arrastrar errores previos.
 */
export function migrateFromLegacyRaw(legacyObj) {
  const clients = normalizeClients(legacyObj?.clients);
  const producers = normalizeProducers(legacyObj?.producers);
  const legacyRates = legacyObj?.rates || {};
  const rates = {
    usd_cop: safePositiveNumber(legacyRates.usd_cop, DEFAULT_RATES.usd_cop),
    cop_bs: safePositiveNumber(legacyRates.cop_bs, DEFAULT_RATES.cop_bs),
  };

  const state = createFreshV8State({
    clients,
    producers,
    rates,
  });

  return {
    state,
    counts: {
      clients: clients.length,
      producers: producers.length,
    },
  };
}

function getDefaultStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function saveV8State(state, storage = getDefaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(V8_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Error guardando colados_app_v8:', err);
    return false;
  }
}

export function getLegacyRawString(storage = getDefaultStorage()) {
  if (!storage) return null;
  try {
    return storage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function loadInitialState(storage = getDefaultStorage()) {
  const legacyRaw = getLegacyRawString(storage);
  const hasLegacyData = Boolean(legacyRaw);

  if (storage) {
    try {
      const v8Raw = storage.getItem(V8_STORAGE_KEY);
      if (v8Raw) {
        const parsedV8 = JSON.parse(v8Raw);
        if (parsedV8 && parsedV8.schemaVersion === 8) {
          return {
            state: normalizeV8State(parsedV8),
            migrationNotice: null,
            hasLegacyData,
          };
        }
      }
    } catch (err) {
      console.error('Error leyendo colados_app_v8:', err);
    }

    if (legacyRaw) {
      try {
        const legacyParsed = JSON.parse(legacyRaw);
        if (legacyParsed && typeof legacyParsed === 'object') {
          const { state, counts } = migrateFromLegacyRaw(legacyParsed);
          saveV8State(state, storage);
          return {
            state,
            migrationNotice: `Migración segura a V8.0: ${counts.clients} clientes y ${counts.producers} productores conservados. Contabilidad e inventario iniciados en limpio.`,
            hasLegacyData: true,
          };
        }
      } catch (err) {
        console.error('Error migrando datos v6 -> v8:', err);
      }
    }
  }

  const fresh = createFreshV8State();
  saveV8State(fresh, storage);
  return {
    state: fresh,
    migrationNotice: null,
    hasLegacyData,
  };
}

export function mergeDirectoryLists(existingList, incomingList, keyField) {
  const seen = new Set(
    existingList.map((item) => String(item?.[keyField] || '').trim().toLowerCase()).filter(Boolean)
  );
  const added = [];
  for (const item of incomingList) {
    const key = String(item?.[keyField] || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    added.push(item);
  }
  return {
    merged: [...existingList, ...added],
    addedCount: added.length,
  };
}

export function importBackupObject(parsed, currentState = createFreshV8State()) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Archivo de respaldo inválido');
  }
  if (parsed.schemaVersion === 8) {
    return {
      state: normalizeV8State(parsed),
      mode: 'v8_full',
      addedClients: 0,
      addedProducers: 0,
    };
  }

  const incomingClients = normalizeClients(parsed.clients);
  const incomingProducers = normalizeProducers(parsed.producers);
  const clientMerge = mergeDirectoryLists(currentState.clients || [], incomingClients, 'fullName');
  const producerMerge = mergeDirectoryLists(currentState.producers || [], incomingProducers, 'name');

  return {
    state: {
      ...currentState,
      clients: clientMerge.merged,
      producers: producerMerge.merged,
    },
    mode: 'legacy_directory_only',
    addedClients: clientMerge.addedCount,
    addedProducers: producerMerge.addedCount,
  };
}

export function buildCsvContent(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export async function exportTextFileNativeOrWeb(content, fileName, mimeType = 'application/json') {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return { native: true, fileName };
  } catch {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      throw new Error('No se pudo exportar en este entorno');
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { native: false, fileName };
  }
}
