/**
 * Motor unificado de costos de producción (2 etapas de merma)
 * y Punto de Equilibrio para COLADOS V8.0.
 */
import { calcMermaPct, getSaleTotalGrams, toGrams } from './grams.js';
import { getCurrentMonthKey, roundCop } from './money.js';
import { DEFAULT_COST_CONFIG } from './storage.js';

export function computeCostingAnalysis(
  rawCostConfig = DEFAULT_COST_CONFIG,
  catalog = [],
  { purchases = [], sales = [], expenses = [], processHistory = [], monthKey = getCurrentMonthKey() } = {}
) {
  const cfg = { ...DEFAULT_COST_CONFIG, ...rawCostConfig };

  // 1. Determinar precio base de materia prima y mermas según modo
  let precioKgPergamino = Math.max(0, roundCop(cfg.precioKgPergaminoCop));
  let precioKgAzul = Math.max(0, roundCop(cfg.precioKgAzulCop));
  let mermaTrillaPct = Math.min(90, Math.max(0, Number(cfg.mermaTrillaPct) || 0));
  let mermaTuestePct = Math.min(90, Math.max(0, Number(cfg.mermaTuestePct) || 0));

  if (cfg.sourceMode === 'auto_purchases') {
    const pergPurchases = purchases.filter((p) => p.coffeeType === 'Pergamino' && (Number(p.grams) > 0 || Number(p.kg) > 0));
    if (pergPurchases.length > 0) {
      let totG = 0;
      let totCop = 0;
      for (const p of pergPurchases) {
        totG += Number.isFinite(Number(p.grams)) ? Number(p.grams) : toGrams(p.kg, 'kg');
        totCop += roundCop(p.cop);
      }
      if (totG > 0) precioKgPergamino = roundCop((totCop / totG) * 1000);
    }

    const azulPurchases = purchases.filter((p) => p.coffeeType === 'Azul' && (Number(p.grams) > 0 || Number(p.kg) > 0));
    if (azulPurchases.length > 0) {
      let totG = 0;
      let totCop = 0;
      for (const p of azulPurchases) {
        totG += Number.isFinite(Number(p.grams)) ? Number(p.grams) : toGrams(p.kg, 'kg');
        totCop += roundCop(p.cop);
      }
      if (totG > 0) precioKgAzul = roundCop((totCop / totG) * 1000);
    }

    const trillaLogs = processHistory.filter((l) => l.type === 'trilla');
    if (trillaLogs.length > 0) {
      const inG = trillaLogs.reduce((s, l) => s + (Number(l.inputGrams) || toGrams(l.input, 'kg')), 0);
      const outG = trillaLogs.reduce((s, l) => s + (Number(l.outputGrams) || toGrams(l.output, 'kg')), 0);
      if (inG > 0) mermaTrillaPct = Math.min(90, Math.max(0, calcMermaPct(inG, outG)));
    }

    const tuesteLogs = processHistory.filter((l) => l.type === 'tueste');
    if (tuesteLogs.length > 0) {
      const inG = tuesteLogs.reduce((s, l) => s + (Number(l.inputGrams) || toGrams(l.input, 'kg')), 0);
      const outG = tuesteLogs.reduce((s, l) => s + (Number(l.outputGrams) || toGrams(l.output, 'kg')), 0);
      if (inG > 0) mermaTuestePct = Math.min(90, Math.max(0, calcMermaPct(inG, outG)));
    }
  }

  // 2. Costo de café tostado (por kg y por gramo)
  const trillaYield = Math.max(0.05, 1 - mermaTrillaPct / 100);
  const tuesteYield = Math.max(0.05, 1 - mermaTuestePct / 100);

  const costoKgAzulDesdePergamino = precioKgPergamino / trillaYield;
  const baseAzulParaTueste = cfg.sourceMode === 'azul' ? precioKgAzul : costoKgAzulDesdePergamino;

  const costoGasKg = Math.max(0, roundCop(cfg.costoGasKgTostadoCop));
  const costoMolinoKg = Math.max(0, roundCop(cfg.costoMolinoKgCop));
  const costoKgTostado = baseAzulParaTueste / tuesteYield + costoGasKg;
  const costoGramoTostado = costoKgTostado / 1000;

  // 3. Mano de obra de tueste por kg
  const horasTanda = Math.max(0.01, Number(cfg.horasTanda) || 1.5);
  const kgTanda = Math.max(0.1, Number(cfg.kgTanda) || 4);
  const horasPorKg = horasTanda / kgTanda;
  const costoManoObraKg = Math.max(0, roundCop(cfg.valorHoraCop)) * horasPorKg;

  // 4. Costos fijos del período (presupuesto o OPEX real del mes) y volumen mensual
  const monthExpenses = expenses.filter((e) => String(e.isoDate || '').startsWith(monthKey));
  const realMonthOpexCop = monthExpenses.reduce((sum, e) => sum + roundCop(e.cop), 0);
  const realMonthFixedOpexCop = monthExpenses
    .filter((e) => e.isFixed !== false)
    .reduce((sum, e) => sum + roundCop(e.cop), 0);

  const costosFijosMesCop = cfg.useRealOpexForFixed
    ? (realMonthFixedOpexCop > 0 ? realMonthFixedOpexCop : realMonthOpexCop)
    : Math.max(0, roundCop(cfg.costosFijosMesCop));

  const monthSales = sales.filter(
    (s) => !s.isDonation && String(s.isoDate || '').startsWith(monthKey)
  );
  const monthSoldGrams = monthSales.reduce((sum, s) => sum + getSaleTotalGrams(s), 0);
  const monthSoldKg = Math.round((monthSoldGrams / 1000) * 1000) / 1000;
  const monthRevenueCop = monthSales.reduce((sum, s) => sum + roundCop(s.cop), 0);

  const volumenMetaKg = Math.max(0.1, Number(cfg.volumenMensualMetaKg) || 50);
  const divisorKgIndirecto = cfg.prorrateoMode === 'real'
    ? Math.max(0.1, monthSoldKg || volumenMetaKg)
    : volumenMetaKg;
  const costoIndirectoPorKgCop = costosFijosMesCop / divisorKgIndirecto;

  // 5. Análisis por presentación del catálogo
  const margenObjetivo = Math.min(90, Math.max(0, Number(cfg.margenObjetivoPct) || 35));

  const itemsAnalysis = catalog.map((item) => {
    const grams = Math.max(1, Math.round(Number(item.grams) || 200));
    const kgRatio = grams / 1000;
    const priceCop = Math.max(0, roundCop(item.priceCop));

    const costoCafeCop = grams * costoGramoTostado;
    const costoEmpaqueCop = item.packType === 'especial'
      ? Math.max(0, roundCop(cfg.costoBolsaEspecialCop))
      : Math.max(0, roundCop(cfg.costoBolsaTransparenteCop));
    const costoMolinoCop = kgRatio * costoMolinoKg;
    const costoDirectoCop = costoCafeCop + costoEmpaqueCop + costoMolinoCop;

    const costoManoObraCop = kgRatio * costoManoObraKg;
    const costoVariableCop = costoDirectoCop + costoManoObraCop;
    const costoIndirectoCop = kgRatio * costoIndirectoPorKgCop;
    const costoTotalCop = costoVariableCop + costoIndirectoCop;

    const gananciaNetaCop = priceCop - costoTotalCop;
    const margenNetoPct = priceCop > 0
      ? Math.round((gananciaNetaCop / priceCop) * 1000) / 10
      : 0;

    const margenContribucionCop = priceCop - costoVariableCop;
    const unidadesEquilibrio = margenContribucionCop > 0
      ? Math.ceil(costosFijosMesCop / margenContribucionCop)
      : null;
    const kilosEquilibrio = unidadesEquilibrio !== null
      ? Math.round(((unidadesEquilibrio * grams) / 1000) * 100) / 100
      : null;

    const rawSugerido = costoTotalCop / Math.max(0.05, 1 - margenObjetivo / 100);
    const precioSugeridoCop = Math.ceil(rawSugerido / 100) * 100;

    return {
      ...item,
      grams,
      priceCop,
      costoCafeCop: roundCop(costoCafeCop),
      costoEmpaqueCop: roundCop(costoEmpaqueCop),
      costoMolinoCop: roundCop(costoMolinoCop),
      costoDirectoCop: roundCop(costoDirectoCop),
      costoManoObraCop: roundCop(costoManoObraCop),
      costoVariableCop: roundCop(costoVariableCop),
      costoIndirectoCop: roundCop(costoIndirectoCop),
      costoTotalCop: roundCop(costoTotalCop),
      gananciaNetaCop: roundCop(gananciaNetaCop),
      margenNetoPct,
      margenContribucionCop: roundCop(margenContribucionCop),
      unidadesEquilibrio,
      kilosEquilibrio,
      precioSugeridoCop,
    };
  });

  // 6. Punto de equilibrio global del mes (en kilos totales)
  let monthVariableCostCop = 0;
  for (const s of monthSales) {
    const saleItems = Array.isArray(s.items) && s.items.length > 0
      ? s.items
      : [{ gramsPerUnit: getSaleTotalGrams(s), quantity: 1, packType: 'transparente' }];

    for (const line of saleItems) {
      const qty = Math.max(1, Math.round(Number(line.quantity) || 1));
      const gramsUnit = Math.max(1, Math.round(Number(line.gramsPerUnit) || 200));
      const kgUnit = gramsUnit / 1000;
      const empaque = line.packType === 'especial'
        ? Math.max(0, roundCop(cfg.costoBolsaEspecialCop))
        : Math.max(0, roundCop(cfg.costoBolsaTransparenteCop));
      const unitVar = gramsUnit * costoGramoTostado + empaque + kgUnit * (costoMolinoKg + costoManoObraKg);
      monthVariableCostCop += unitVar * qty;
    }
  }

  let margenContribucionPromedioKgCop = 0;
  if (monthSoldKg > 0) {
    const monthContribCop = monthRevenueCop - monthVariableCostCop;
    margenContribucionPromedioKgCop = monthContribCop / monthSoldKg;
  } else if (itemsAnalysis.length > 0) {
    const sumMcPerKg = itemsAnalysis.reduce(
      (sum, it) => sum + it.margenContribucionCop / (it.grams / 1000),
      0
    );
    margenContribucionPromedioKgCop = sumMcPerKg / itemsAnalysis.length;
  }

  const kilosTotalesEquilibrio = margenContribucionPromedioKgCop > 0
    ? Math.round((costosFijosMesCop / margenContribucionPromedioKgCop) * 10) / 10
    : null;

  const progresoEquilibrioPct = kilosTotalesEquilibrio && kilosTotalesEquilibrio > 0
    ? Math.min(100, Math.round((monthSoldKg / kilosTotalesEquilibrio) * 1000) / 10)
    : 0;

  const kilosFaltantesEquilibrio = kilosTotalesEquilibrio !== null
    ? Math.max(0, Math.round((kilosTotalesEquilibrio - monthSoldKg) * 10) / 10)
    : null;

  const utilidadOperativaMesCop = monthSoldKg > 0
    ? roundCop(monthRevenueCop - monthVariableCostCop - costosFijosMesCop)
    : -costosFijosMesCop;

  return {
    config: cfg,
    precioKgPergaminoUsed: precioKgPergamino,
    precioKgAzulUsed: roundCop(baseAzulParaTueste),
    mermaTrillaPct,
    mermaTuestePct,
    costoKgAzulCop: roundCop(costoKgAzulDesdePergamino),
    costoKgTostadoCop: roundCop(costoKgTostado),
    costoGramoTostadoCop: Math.round(costoGramoTostado * 100) / 100,
    horasPorKg: Math.round(horasPorKg * 1000) / 1000,
    costoManoObraKgCop: roundCop(costoManoObraKg),
    costoIndirectoPorKgCop: roundCop(costoIndirectoPorKgCop),
    costosFijosMesCop,
    realMonthOpexCop,
    monthSoldGrams,
    monthSoldKg,
    monthRevenueCop,
    monthVariableCostCop: roundCop(monthVariableCostCop),
    margenContribucionPromedioKgCop: roundCop(margenContribucionPromedioKgCop),
    kilosTotalesEquilibrio,
    progresoEquilibrioPct,
    kilosFaltantesEquilibrio,
    utilidadOperativaMesCop,
    itemsAnalysis,
  };
}
