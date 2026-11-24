/**
 * Lógica de ventas multi-producto, inventario de insumos,
 * cuentas acumuladas por cliente, abonos FIFO y stock por productor.
 */
import { toGrams } from './grams.js';
import { copToBs, copToUsd, daysBetweenISO, getTodayISO, roundCop } from './money.js';

export function normalizeKey(name) {
  return String(name || '').trim().toLowerCase();
}

export function normalizeCartItem(item) {
  const quantity = Math.max(1, Math.round(Number(item?.quantity) || 1));
  const gramsPerUnit = Math.max(1, Math.round(Number(item?.gramsPerUnit) || 0));
  const unitPriceCop = Math.max(0, roundCop(item?.unitPriceCop));
  const totalGrams = gramsPerUnit * quantity;
  const lineTotalCop = unitPriceCop * quantity;
  const packType = ['especial', 'transparente', 'sin_bolsa'].includes(item?.packType)
    ? item.packType
    : 'transparente';

  return {
    lineId: item?.lineId || `${item?.catalogId || 'custom'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    catalogId: item?.catalogId ?? null,
    name: String(item?.name || 'Café Tostado').trim(),
    packType,
    hasLabel: item?.hasLabel !== undefined ? Boolean(item.hasLabel) : packType === 'especial',
    gramsPerUnit,
    quantity,
    unitPriceCop,
    totalGrams,
    lineTotalCop,
    stickerType: ['grande', 'pequeño', 'ninguno'].includes(item?.stickerType)
      ? item.stickerType
      : (packType === 'especial' ? 'grande' : 'ninguno'),
    isCustomGranel: Boolean(item?.isCustomGranel),
  };
}

export function computeCartTotals(items = []) {
  return items.reduce(
    (acc, rawItem) => {
      const item = normalizeCartItem(rawItem);
      acc.totalGrams += item.totalGrams;
      acc.totalCop += item.lineTotalCop;
      acc.totalUnits += item.quantity;
      return acc;
    },
    { totalGrams: 0, totalCop: 0, totalUnits: 0 }
  );
}

export function applySaleSuppliesDelta(supplies = {}, items = [], direction = -1) {
  const next = {
    bolsas_especiales: Math.max(0, Math.round(Number(supplies?.bolsas_especiales) || 0)),
    bolsas_transparentes: Math.max(0, Math.round(Number(supplies?.bolsas_transparentes) || 0)),
    etiquetas: Math.max(0, Math.round(Number(supplies?.etiquetas) || 0)),
    stickers_grandes: Math.max(0, Math.round(Number(supplies?.stickers_grandes) || 0)),
    stickers_pequenos: Math.max(0, Math.round(Number(supplies?.stickers_pequenos) || 0)),
    alerta_umbral: Math.max(0, Math.round(Number(supplies?.alerta_umbral) || 10)),
  };

  for (const rawItem of items) {
    const qty = Math.max(1, Math.round(Number(rawItem?.quantity) || 1));
    const delta = direction * qty;
    if (rawItem?.packType === 'especial') {
      next.bolsas_especiales = Math.max(0, next.bolsas_especiales + delta);
      if (rawItem?.hasLabel !== false) {
        next.etiquetas = Math.max(0, next.etiquetas + delta);
      }
    } else if (rawItem?.packType === 'transparente') {
      next.bolsas_transparentes = Math.max(0, next.bolsas_transparentes + delta);
    }

    if (rawItem?.stickerType === 'grande') {
      next.stickers_grandes = Math.max(0, next.stickers_grandes + delta);
    } else if (rawItem?.stickerType === 'pequeño') {
      next.stickers_pequenos = Math.max(0, next.stickers_pequenos + delta);
    }
  }

  return next;
}

export function getClientPendingSales(sales = [], clientName = '') {
  const key = normalizeKey(clientName);
  if (!key) return [];
  return sales
    .filter((s) => normalizeKey(s.clientName) === key && !s.isDonation && roundCop(s.balanceDueCop) > 0)
    .slice()
    .sort((a, b) => {
      const cmp = String(a.isoDate || '').localeCompare(String(b.isoDate || ''));
      return cmp !== 0 ? cmp : (Number(a.id) || 0) - (Number(b.id) || 0);
    });
}

export function getClientDebtCop(sales = [], clientName = '') {
  return getClientPendingSales(sales, clientName).reduce(
    (sum, s) => sum + roundCop(s.balanceDueCop),
    0
  );
}

export function getClientHistorySummary(sales = [], clientName = '') {
  const key = normalizeKey(clientName);
  if (!key) {
    return {
      totalBoughtCop: 0,
      totalGrams: 0,
      visits: 0,
      totalPaidCop: 0,
      debtCop: 0,
      pendingSales: [],
      clientSales: [],
      allPayments: [],
    };
  }

  const clientSales = sales
    .filter((s) => normalizeKey(s.clientName) === key && !s.isDonation)
    .slice()
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

  let totalBoughtCop = 0;
  let totalGrams = 0;
  let totalPaidCop = 0;
  let debtCop = 0;
  const allPayments = [];

  for (const s of clientSales) {
    totalBoughtCop += roundCop(s.cop);
    totalGrams += Math.max(0, Math.round(Number(s.totalGrams) || 0));
    totalPaidCop += roundCop(s.paidAmountCop);
    debtCop += Math.max(0, roundCop(s.balanceDueCop));
    if (Array.isArray(s.payments)) {
      for (const p of s.payments) {
        allPayments.push({
          ...p,
          invoiceNum: s.invoiceNum,
          saleId: s.id,
        });
      }
    }
  }

  allPayments.sort((a, b) => {
    const cmp = String(b.isoDate || '').localeCompare(String(a.isoDate || ''));
    return cmp !== 0 ? cmp : (Number(b.id) || 0) - (Number(a.id) || 0);
  });

  return {
    totalBoughtCop,
    totalGrams,
    visits: clientSales.length,
    totalPaidCop,
    debtCop,
    pendingSales: getClientPendingSales(sales, clientName),
    clientSales,
    allPayments,
  };
}

export function getAllClientDebtAccounts(sales = [], todayIso = getTodayISO()) {
  const grouped = new Map();

  for (const s of sales) {
    if (s.isDonation) continue;
    const balance = roundCop(s.balanceDueCop);
    if (balance <= 0) continue;

    const key = normalizeKey(s.clientName);
    if (!key) continue;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        clientName: s.clientName,
        debtCop: 0,
        pendingCount: 0,
        oldestIsoDate: s.isoDate || todayIso,
        pendingSales: [],
        payments: [],
      });
    }

    const acc = grouped.get(key);
    acc.debtCop += balance;
    acc.pendingCount += 1;
    if (s.isoDate && s.isoDate < acc.oldestIsoDate) {
      acc.oldestIsoDate = s.isoDate;
    }
    acc.pendingSales.push(s);
    if (Array.isArray(s.payments)) {
      acc.payments.push(
        ...s.payments.map((p) => ({ ...p, invoiceNum: s.invoiceNum, saleId: s.id }))
      );
    }
  }

  return Array.from(grouped.values())
    .map((acc) => {
      acc.pendingSales.sort((a, b) => String(a.isoDate || '').localeCompare(String(b.isoDate || '')));
      acc.payments.sort((a, b) => String(b.isoDate || '').localeCompare(String(a.isoDate || '')));
      return {
        ...acc,
        isOverdue: daysBetweenISO(acc.oldestIsoDate, todayIso) > 7,
      };
    })
    .sort((a, b) => b.debtCop - a.debtCop);
}

export function createSaleRecord({
  id = Date.now(),
  invoiceCounter = 1,
  clientName,
  items = [],
  method = 'Efectivo COP',
  paidNowCop = 0,
  customTotalCop = null,
  excessToDebtCop = 0,
  isCredit = false,
  isDonation = false,
  date,
  isoDate,
  time,
  rates,
  previousDebtCop = 0,
}) {
  const normalizedItems = items.map(normalizeCartItem);
  const { totalGrams, totalCop: rawSubtotalCop, totalUnits } = computeCartTotals(normalizedItems);
  const hasCustomTotal =
    customTotalCop !== null &&
    customTotalCop !== undefined &&
    customTotalCop !== '' &&
    Number.isFinite(Number(customTotalCop)) &&
    Number(customTotalCop) >= 0;
  const totalCop = hasCustomTotal ? roundCop(customTotalCop) : rawSubtotalCop;
  const discountCop = Math.max(0, rawSubtotalCop - totalCop);
  const effectiveMethod = isDonation ? 'Donación' : (isCredit && paidNowCop <= 0 ? 'Crédito' : method);
  const receivedCop = isDonation || isCredit ? 0 : Math.max(0, roundCop(paidNowCop));
  const paidAmountCop = isDonation ? 0 : Math.min(totalCop, receivedCop);
  const balanceDueCop = isDonation ? 0 : Math.max(0, totalCop - paidAmountCop);
  const rawChangeCop = isDonation || isCredit ? 0 : Math.max(0, receivedCop - totalCop);
  const appliedToOldDebtCop = isDonation || isCredit ? 0 : Math.min(rawChangeCop, Math.max(0, roundCop(excessToDebtCop)));
  const changeCop = Math.max(0, rawChangeCop - appliedToOldDebtCop);
  const isPaid = isDonation ? true : balanceDueCop === 0;

  const payments = !isDonation && paidAmountCop > 0
    ? [{ id: id + 1, date, isoDate, amountCop: paidAmountCop, method: effectiveMethod }]
    : [];

  return {
    id,
    invoiceNum: String(invoiceCounter).padStart(4, '0'),
    clientName: String(clientName || 'Cliente Ocasional').trim(),
    items: normalizedItems,
    totalGrams,
    totalUnits,
    subtotalCop: rawSubtotalCop,
    discountCop,
    cop: totalCop,
    usd: copToUsd(totalCop, rates),
    bs: copToBs(totalCop, rates),
    method: effectiveMethod,
    isDonation: Boolean(isDonation),
    date,
    isoDate,
    time,
    previousDebtCop: Math.max(0, roundCop(previousDebtCop)),
    receivedCop,
    paidAmountCop,
    balanceDueCop,
    appliedToOldDebtCop,
    changeCop,
    isPaid,
    payments,
  };
}

export function applyClientPayment(
  sales = [],
  clientName,
  amountCop,
  method = 'Efectivo COP',
  dateStr = '',
  isoDate = getTodayISO()
) {
  const targetAmount = Math.max(0, roundCop(amountCop));
  if (targetAmount <= 0) {
    return {
      updatedSales: sales,
      appliedCop: 0,
      unappliedExcessCop: 0,
      remainingDebtCop: getClientDebtCop(sales, clientName),
    };
  }

  const pendingOrdered = getClientPendingSales(sales, clientName);
  let remainingToApply = targetAmount;
  const allocations = new Map();
  const baseTs = Date.now();
  let seq = 0;

  for (const s of pendingOrdered) {
    if (remainingToApply <= 0) break;
    const due = Math.max(0, roundCop(s.balanceDueCop));
    if (due <= 0) continue;
    const slice = Math.min(due, remainingToApply);
    remainingToApply -= slice;
    seq += 1;
    allocations.set(s.id, {
      slice,
      payment: {
        id: baseTs + seq,
        date: dateStr,
        isoDate,
        amountCop: slice,
        method,
      },
    });
  }

  const updatedSales = sales.map((s) => {
    const alloc = allocations.get(s.id);
    if (!alloc) return s;
    const newPaid = Math.min(roundCop(s.cop), roundCop(s.paidAmountCop) + alloc.slice);
    const newBalance = Math.max(0, roundCop(s.cop) - newPaid);
    return {
      ...s,
      paidAmountCop: newPaid,
      balanceDueCop: newBalance,
      isPaid: newBalance === 0,
      payments: [...(Array.isArray(s.payments) ? s.payments : []), alloc.payment],
    };
  });

  const appliedCop = targetAmount - remainingToApply;
  return {
    updatedSales,
    appliedCop,
    unappliedExcessCop: remainingToApply,
    remainingDebtCop: getClientDebtCop(updatedSales, clientName),
  };
}

export function applySingleSalePayment(
  sales = [],
  saleId,
  amountCop,
  method = 'Efectivo COP',
  dateStr = '',
  isoDate = getTodayISO()
) {
  const pay = Math.max(0, roundCop(amountCop));
  if (pay <= 0) return sales;

  return sales.map((s) => {
    if (s.id !== saleId) return s;
    const total = roundCop(s.cop);
    const currentPaid = roundCop(s.paidAmountCop);
    const due = Math.max(0, total - currentPaid);
    const slice = Math.min(due, pay);
    if (slice <= 0) return s;
    const newPaid = currentPaid + slice;
    const newBalance = Math.max(0, total - newPaid);
    const paymentEntry = {
      id: Date.now(),
      date: dateStr,
      isoDate,
      amountCop: slice,
      method,
    };
    return {
      ...s,
      paidAmountCop: newPaid,
      balanceDueCop: newBalance,
      isPaid: newBalance === 0,
      payments: [...(Array.isArray(s.payments) ? s.payments : []), paymentEntry],
    };
  });
}

export function recalculateEditedSale(oldSale, editedDraft, rates) {
  const oldItems = Array.isArray(oldSale?.items) ? oldSale.items.map(normalizeCartItem) : [];
  const oldGrams = oldItems.reduce((sum, i) => sum + i.totalGrams, 0);

  const newItems = Array.isArray(editedDraft?.items)
    ? editedDraft.items.map(normalizeCartItem)
    : oldItems;
  const { totalGrams: newGrams, totalCop, totalUnits } = computeCartTotals(newItems);

  const isDonation = Boolean(editedDraft?.isDonation);
  const clampedPaid = isDonation
    ? 0
    : Math.min(totalCop, Math.max(0, roundCop(editedDraft?.paidAmountCop ?? oldSale?.paidAmountCop)));
  const balanceDueCop = isDonation ? 0 : Math.max(0, totalCop - clampedPaid);

  const sale = {
    ...oldSale,
    ...editedDraft,
    clientName: String(editedDraft?.clientName || oldSale?.clientName || 'Cliente Ocasional').trim(),
    items: newItems,
    totalGrams: newGrams,
    totalUnits,
    cop: totalCop,
    usd: copToUsd(totalCop, rates),
    bs: copToBs(totalCop, rates),
    paidAmountCop: clampedPaid,
    balanceDueCop,
    isPaid: isDonation ? true : balanceDueCop === 0,
    isDonation,
  };

  return {
    sale,
    gramsDelta: newGrams - oldGrams,
    oldItems,
    newItems,
  };
}

export function getProducerAvailableGrams(
  producerName,
  coffeeType,
  purchases = [],
  processHistory = [],
  activeProcesses = []
) {
  const key = normalizeKey(producerName);
  if (!key) return 0;

  let stock = 0;

  for (const p of purchases) {
    if (normalizeKey(p.producer) === key && p.coffeeType === coffeeType) {
      const g = Number.isFinite(Number(p.grams)) ? Math.round(Number(p.grams)) : toGrams(p.kg, 'kg');
      stock += g;
    }
  }

  for (const log of processHistory) {
    if (normalizeKey(log.producer) !== key) continue;
    const inG = Number.isFinite(Number(log.inputGrams)) ? Math.round(Number(log.inputGrams)) : toGrams(log.input, 'kg');
    const outG = Number.isFinite(Number(log.outputGrams)) ? Math.round(Number(log.outputGrams)) : toGrams(log.output, 'kg');

    if (coffeeType === 'Pergamino' && log.type === 'trilla') stock -= inG;
    if (coffeeType === 'Azul' && log.type === 'trilla') stock += outG;
    if (coffeeType === 'Azul' && log.type === 'tueste') stock -= inG;
  }

  for (const ap of activeProcesses) {
    if (normalizeKey(ap.producer) !== key) continue;
    const inG = Number.isFinite(Number(ap.inputGrams)) ? Math.round(Number(ap.inputGrams)) : toGrams(ap.input, 'kg');
    if (coffeeType === 'Pergamino' && ap.type === 'trilla') stock -= inG;
    if (coffeeType === 'Azul' && ap.type === 'tueste') stock -= inG;
  }

  return Math.max(0, Math.round(stock));
}
