/**
 * Motor de pesos en gramos enteros para COLADOS V8.0.
 * Elimina errores de punto flotante (ej. 156.06500000000003kg)
 * trabajando siempre internamente en gramos redondeados.
 */

export function toGrams(value, unit = 'g') {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return unit === 'kg' ? Math.round(num * 1000) : Math.round(num);
}

export function gramsToKg(grams) {
  const g = Math.max(0, Math.round(Number(grams) || 0));
  return g / 1000;
}

export function formatKg(grams) {
  const kg = gramsToKg(grams);
  return `${kg.toLocaleString('es-CO', { maximumFractionDigits: 3 })} kg`;
}

export function formatGrams(grams) {
  const g = Math.max(0, Math.round(Number(grams) || 0));
  return `${g.toLocaleString('es-CO')} g`;
}

export function formatWeightDual(grams) {
  const g = Math.max(0, Math.round(Number(grams) || 0));
  if (g >= 1000) {
    return `${formatKg(g)} (${formatGrams(g)})`;
  }
  return formatGrams(g);
}

export function calcMermaPct(inputGrams, outputGrams) {
  const inG = Math.round(Number(inputGrams) || 0);
  const outG = Math.round(Number(outputGrams) || 0);
  if (inG <= 0) return 0;
  const pct = ((inG - outG) / inG) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

export function formatBagsEquivalence(grams, bagGrams = 200) {
  const g = Math.max(0, Math.round(Number(grams) || 0));
  const unitG = Math.max(1, Math.round(Number(bagGrams) || 200));
  const bags = Math.floor(g / unitG);
  const remainderGrams = g % unitG;
  const label = remainderGrams > 0
    ? `${bags} bolsas (${unitG}g) + ${formatGrams(remainderGrams)}`
    : `${bags} bolsas (${unitG}g)`;
  return { bags, remainderGrams, label };
}

export function getSaleTotalGrams(sale) {
  if (!sale) return 0;
  if (Array.isArray(sale.items) && sale.items.length > 0) {
    return sale.items.reduce((sum, item) => {
      const g = Number.isFinite(Number(item?.totalGrams))
        ? Math.round(Number(item.totalGrams))
        : Math.round((Number(item?.gramsPerUnit) || 0) * (Number(item?.quantity) || 1));
      return sum + Math.max(0, g);
    }, 0);
  }
  if (Number.isFinite(Number(sale.totalGrams))) {
    return Math.max(0, Math.round(Number(sale.totalGrams)));
  }
  return 0;
}

export function recomputeInventoryGrams({
  openingInventoryGrams = {},
  purchases = [],
  processHistory = [],
  activeProcesses = [],
  sales = [],
} = {}) {
  let pergamino = Math.max(0, Math.round(Number(openingInventoryGrams?.pergamino) || 0));
  let azul = Math.max(0, Math.round(Number(openingInventoryGrams?.azul) || 0));
  let tostado = Math.max(0, Math.round(Number(openingInventoryGrams?.tostado) || 0));

  for (const purchase of purchases) {
    const g = Number.isFinite(Number(purchase?.grams))
      ? Math.max(0, Math.round(Number(purchase.grams)))
      : toGrams(purchase?.kg, 'kg');
    if (purchase?.coffeeType === 'Pergamino') pergamino += g;
    else if (purchase?.coffeeType === 'Azul') azul += g;
    else if (purchase?.coffeeType === 'Tostado') tostado += g;
  }

  for (const log of processHistory) {
    const inG = Number.isFinite(Number(log?.inputGrams))
      ? Math.max(0, Math.round(Number(log.inputGrams)))
      : toGrams(log?.input, 'kg');
    const outG = Number.isFinite(Number(log?.outputGrams))
      ? Math.max(0, Math.round(Number(log.outputGrams)))
      : toGrams(log?.output, 'kg');

    if (log?.type === 'trilla') {
      pergamino -= inG;
      azul += outG;
    } else if (log?.type === 'tueste') {
      azul -= inG;
      tostado += outG;
    }
  }

  for (const ap of activeProcesses) {
    const inG = Number.isFinite(Number(ap?.inputGrams))
      ? Math.max(0, Math.round(Number(ap.inputGrams)))
      : toGrams(ap?.input, 'kg');
    if (ap?.type === 'trilla') {
      pergamino -= inG;
    } else if (ap?.type === 'tueste') {
      azul -= inG;
    }
  }

  for (const sale of sales) {
    tostado -= getSaleTotalGrams(sale);
  }

  return {
    pergamino: Math.max(0, Math.round(pergamino)),
    azul: Math.max(0, Math.round(azul)),
    tostado: Math.max(0, Math.round(tostado)),
  };
}
