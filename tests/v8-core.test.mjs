import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcMermaPct,
  formatBagsEquivalence,
  formatGrams,
  formatKg,
  recomputeInventoryGrams,
  toGrams,
} from '../src/utils/grams.js';
import {
  copToBs,
  copToUsd,
  formatBS,
  formatCOP,
  formatUSD,
  toCop,
} from '../src/utils/money.js';
import {
  LEGACY_STORAGE_KEY,
  V8_STORAGE_KEY,
  importBackupObject,
  loadInitialState,
} from '../src/utils/storage.js';
import {
  applyClientPayment,
  applySaleSuppliesDelta,
  computeCartTotals,
  createSaleRecord,
  getAllClientDebtAccounts,
  getClientDebtCop,
  getProducerAvailableGrams,
  normalizeCartItem,
  recalculateEditedSale,
} from '../src/utils/ledger.js';
import { computeCostingAnalysis } from '../src/utils/costing.js';
import {
  buildClientStatementWhatsAppText,
  buildSaleWhatsAppText,
} from '../src/utils/receipt.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
  };
}

test('Migración segura V6 -> V8 conserva solo Clientes y Productores y deja intacto colados_app_v6', () => {
  const legacyPayload = {
    rates: { usd_cop: 4200, cop_bs: 0.012 },
    inventory: { pergamino: 999, azul: 888, tostado: 777 },
    clients: [
      { id: 1, fullName: 'Café Central', business: 'Local 1', sector: 'Centro', phone: '300123' },
      { id: 2, fullName: 'café central', business: 'Dup', sector: 'Centro', phone: '' },
      'Don Pedro',
    ],
    producers: [
      'Finca El Mirador',
      { id: 10, name: 'Carlos Pérez', finca: 'La Esperanza', sector: 'Norte', phone: '311000' },
    ],
    sales: [
      { id: 1, cop: 50000, clientName: 'Café Central' },
      { id: 5, cop: 25000, clientName: 'Panadería La Espiga' },
    ],
    orders: [{ id: 6, clientName: 'Restaurante Los Andes' }],
    purchases: [
      { id: 2, kg: 50, coffeeType: 'Pergamino', producer: 'Carlos Pérez' },
      { id: 7, kg: 20, coffeeType: 'Azul', producer: 'Hacienda Santa Rita' },
    ],
    expenses: [{ id: 3, cop: 12000 }],
    processHistory: [{ id: 4, type: 'trilla', producer: 'Finca Las Nubes', input: 10, output: 8 }],
  };

  const rawLegacyStr = JSON.stringify(legacyPayload);
  const storage = createMemoryStorage({ [LEGACY_STORAGE_KEY]: rawLegacyStr });

  const { state, migrationNotice, hasLegacyData } = loadInitialState(storage);

  assert.equal(hasLegacyData, true);
  assert.ok(migrationNotice);
  assert.equal(state.schemaVersion, 8);
  assert.equal(state.clients.length, 4);
  assert.equal(state.clients[0].fullName, 'Café Central');
  assert.equal(state.clients[1].fullName, 'Don Pedro');
  assert.equal(state.clients[2].fullName, 'Panadería La Espiga');
  assert.equal(state.clients[3].fullName, 'Restaurante Los Andes');

  assert.equal(state.producers.length, 4);
  assert.equal(state.producers[0].name, 'Finca El Mirador');
  assert.equal(state.producers[1].finca, 'La Esperanza');
  assert.equal(state.producers[2].name, 'Hacienda Santa Rita');
  assert.equal(state.producers[3].name, 'Finca Las Nubes');

  // Datos contables e inventario arrancan en limpio
  assert.deepEqual(state.inventoryGrams, { pergamino: 0, azul: 0, tostado: 0 });
  assert.equal(state.sales.length, 0);
  assert.equal(state.purchases.length, 0);
  assert.equal(state.expenses.length, 0);
  assert.equal(state.processHistory.length, 0);
  assert.equal(state.invoiceCounter, 1);

  // Tasas válidas heredadas
  assert.equal(state.rates.usd_cop, 4200);
  assert.equal(state.rates.cop_bs, 0.012);

  // colados_app_v6 permanece intacto y se crea colados_app_v8
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), rawLegacyStr);
  assert.ok(storage.getItem(V8_STORAGE_KEY));
});

test('Importación de respaldo v6/v7 fusiona solo Clientes y Productores sin tocar ventas/inventario', () => {
  const storage = createMemoryStorage();
  const { state } = loadInitialState(storage);
  state.clients = [{ id: 1, fullName: 'Ana', business: '', sector: 'Sur', phone: '' }];
  state.sales = [{ id: 99, cop: 40000 }];

  const res = importBackupObject(
    {
      clients: [
        { id: 10, fullName: 'ana', business: '', sector: 'Sur', phone: '' },
        { id: 11, fullName: 'Luis', business: 'Tienda', sector: 'Este', phone: '555' },
      ],
      producers: ['Finca Nueva'],
      sales: [{ id: 1, cop: 999999 }],
      inventory: { tostado: 500 },
    },
    state
  );

  assert.equal(res.mode, 'legacy_directory_only');
  assert.equal(res.addedClients, 1);
  assert.equal(res.addedProducers, 1);
  assert.equal(res.state.clients.length, 2);
  assert.equal(res.state.producers.length, 1);
  assert.equal(res.state.sales.length, 1);
  assert.equal(res.state.sales[0].id, 99);
});

test('Precisión en gramos enteros, suma de sobrantes y recálculo exacto con lotes activos', () => {
  assert.equal(toGrams(10.2, 'kg'), 10200);
  assert.equal(toGrams(200, 'g') + toGrams(10, 'kg'), 10200);
  assert.equal(formatKg(10200), '10,2 kg');
  assert.equal(formatGrams(10200), '10.200 g');
  assert.equal(calcMermaPct(4000, 3160), 21);
  assert.equal(formatBagsEquivalence(1050, 200).bags, 5);
  assert.equal(formatBagsEquivalence(1050, 200).remainderGrams, 50);

  const inv = recomputeInventoryGrams({
    openingInventoryGrams: { pergamino: 200, azul: 100, tostado: 300 },
    purchases: [
      { coffeeType: 'Pergamino', grams: 10000, producer: 'Carlos' },
    ],
    processHistory: [
      { type: 'trilla', producer: 'Carlos', inputGrams: 5000, outputGrams: 3950 },
      { type: 'tueste', producer: 'Carlos', inputGrams: 2000, outputGrams: 1600 },
    ],
    activeProcesses: [
      { type: 'trilla', producer: 'Carlos', inputGrams: 1200 },
    ],
    sales: [
      {
        items: [
          normalizeCartItem({ name: '200g Bolsa Especial', gramsPerUnit: 200, quantity: 2, unitPriceCop: 15000 }),
          normalizeCartItem({ name: '1 Kg Granel', gramsPerUnit: 1000, quantity: 1, unitPriceCop: 40000 }),
        ],
      },
    ],
  });

  // Pergamino: 200 + 10000 - 5000 - 1200(en curso) = 4000g
  // Azul: 100 + 3950 - 2000 = 2050g
  // Tostado: 300 + 1600 - (2*200 + 1000 = 1400) = 500g (sin doble multiplicación!)
  assert.deepEqual(inv, { pergamino: 4000, azul: 2050, tostado: 500 });

  const avail = getProducerAvailableGrams(
    'Carlos',
    'Pergamino',
    [{ coffeeType: 'Pergamino', grams: 10000, producer: 'Carlos' }],
    [{ type: 'trilla', producer: 'Carlos', inputGrams: 5000, outputGrams: 3950 }],
    [{ type: 'trilla', producer: 'Carlos', inputGrams: 1200 }]
  );
  assert.equal(avail, 3800);
});

test('Monedas COP/USD/BS, carrito multi-producto, deuda acumulada, abonos FIFO y edición sin NaN', () => {
  const rates = { usd_cop: 4000, cop_bs: 0.01 };
  assert.equal(copToUsd(40000, rates), 10);
  assert.equal(copToBs(40000, rates), 400);
  assert.equal(toCop(10, 'USD', rates), 40000);
  assert.equal(toCop(400, 'BS', rates), 40000);
  assert.equal(formatCOP(40000), '$40.000 COP');
  assert.equal(formatUSD(10), 'USD $10.00');
  assert.match(formatBS(400), /Bs 400/);

  const cart = [
    normalizeCartItem({ catalogId: 1, name: '200g Bolsa Especial', packType: 'especial', hasLabel: true, gramsPerUnit: 200, unitPriceCop: 15000, quantity: 2, stickerType: 'grande' }),
    normalizeCartItem({ catalogId: 5, name: '1 Kg Transparente/Granel', packType: 'transparente', hasLabel: false, gramsPerUnit: 1000, unitPriceCop: 40000, quantity: 1, stickerType: 'ninguno' }),
  ];
  const totals = computeCartTotals(cart);
  assert.deepEqual(totals, { totalGrams: 1400, totalCop: 70000, totalUnits: 3 });

  // Descuento de insumos sin NaN
  const suppliesAfter = applySaleSuppliesDelta(
    { bolsas_especiales: 10, bolsas_transparentes: 5, etiquetas: 10, stickers_grandes: 0, stickers_pequenos: 0, alerta_umbral: 10 },
    cart,
    -1
  );
  assert.equal(suppliesAfter.bolsas_especiales, 8);
  assert.equal(suppliesAfter.etiquetas, 8);
  assert.equal(suppliesAfter.bolsas_transparentes, 4);
  assert.equal(Number.isNaN(suppliesAfter.stickers_grandes), false);

  // Venta 1 a crédito ($70.000)
  const sale1 = createSaleRecord({
    id: 100,
    invoiceCounter: 1,
    clientName: 'María',
    items: cart,
    isCredit: true,
    date: '20/11/2026',
    isoDate: '2026-11-20',
    time: '09:00',
    rates,
    previousDebtCop: 0,
  });
  assert.equal(sale1.balanceDueCop, 70000);

  // Venta 2 con abono parcial ($10.000 de $25.000)
  const sale2 = createSaleRecord({
    id: 200,
    invoiceCounter: 2,
    clientName: 'María',
    items: [normalizeCartItem({ name: '400g Bolsa Especial', packType: 'especial', gramsPerUnit: 400, unitPriceCop: 25000, quantity: 1 })],
    method: 'Efectivo COP',
    paidNowCop: 10000,
    date: '24/11/2026',
    isoDate: '2026-11-24',
    time: '10:00',
    rates,
    previousDebtCop: 70000,
  });

  const salesList = [sale2, sale1];
  assert.equal(getClientDebtCop(salesList, 'María'), 85000);

  // Abono FIFO de $80.000 -> liquida sale1 ($70k) y abona $10k a sale2 (queda $5k pendiente)
  const payRes = applyClientPayment(salesList, 'María', 80000, 'Bancolombia', '24/11/2026', '2026-11-24');
  assert.equal(payRes.appliedCop, 80000);
  assert.equal(payRes.remainingDebtCop, 5000);

  const accounts = getAllClientDebtAccounts(payRes.updatedSales, '2026-11-24');
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].debtCop, 5000);

  // Edición de venta sin NaN en USD/BS
  const edited = recalculateEditedSale(
    sale1,
    {
      ...sale1,
      items: [normalizeCartItem({ ...cart[0], quantity: 3 }), cart[1]], // +200g, +$15.000
    },
    rates
  );
  assert.equal(edited.gramsDelta, 200);
  assert.equal(edited.sale.cop, 85000);
  assert.equal(edited.sale.usd, 21.25);
  assert.equal(edited.sale.bs, 850);
  assert.equal(Number.isNaN(edited.sale.usd), false);
  assert.equal(Number.isNaN(edited.sale.bs), false);

  // Recibos WhatsApp incluyen deuda acumulada y saldo
  const txtSale = buildSaleWhatsAppText(sale2, 85000, rates);
  assert.match(txtSale, /Deuda anterior/);
  assert.match(txtSale, /Total acumulado/);
  assert.match(txtSale, /Saldo pendiente total/);

  const txtStmt = buildClientStatementWhatsAppText(accounts[0], rates);
  assert.match(txtStmt, /ESTADO DE CUENTA/);
  assert.match(txtStmt, /María/);
  assert.match(txtStmt, /\$5\.000 COP/);
});

test('Motor unificado de costos (2 mermas) y Punto de Equilibrio', () => {
  const catalog = [
    { id: 1, name: '200g Bolsa Especial', priceCop: 15000, grams: 200, packType: 'especial', hasLabel: true },
    { id: 5, name: '1 Kg Transparente/Granel', priceCop: 40000, grams: 1000, packType: 'transparente', hasLabel: false },
  ];

  const analysis = computeCostingAnalysis(
    {
      sourceMode: 'pergamino',
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
      prorrateoMode: 'projected',
      margenObjetivoPct: 35,
    },
    catalog,
    { monthKey: '2026-11' }
  );

  // 17000 / 0.79 = 21518.987 -> 21519
  assert.equal(analysis.costoKgAzulCop, 21519);
  // 21518.987 / 0.8 + 600 = 27498.73 -> 27499
  assert.equal(analysis.costoKgTostadoCop, 27499);
  assert.equal(analysis.horasPorKg, 0.375);
  assert.equal(analysis.costoManoObraKgCop, 3000);
  assert.equal(analysis.costoIndirectoPorKgCop, 5000);

  const item200 = analysis.itemsAnalysis[0];
  // Cafe: ~5500 + Bolsa: 1000 + Molino: 60 = ~6560; Mano obra: 600; Indirecto: 1000; Total: ~8160
  assert.equal(item200.costoDirectoCop, 6560);
  assert.equal(item200.costoManoObraCop, 600);
  assert.equal(item200.costoIndirectoCop, 1000);
  assert.equal(item200.costoTotalCop, 8160);
  assert.equal(item200.gananciaNetaCop, 6840);
  // Margen contribucion = 15000 - (6560 + 600) = 7840 -> ceil(250000 / 7840) = 32 uds = 6.4 kg
  assert.equal(item200.unidadesEquilibrio, 32);
  assert.equal(item200.kilosEquilibrio, 6.4);

  assert.ok(analysis.kilosTotalesEquilibrio > 0);
});

test('V8.1: Venta de gramos personalizados (300g, 400g) con precio final manual / descuento', () => {
  const rates = { usd_cop: 4000, cop_bs: 0.01 };
  const customItems = [
    normalizeCartItem({
      name: '300g Empaque Especial',
      packType: 'especial',
      hasLabel: true,
      gramsPerUnit: 300,
      unitPriceCop: 22000,
      quantity: 1,
    }),
    normalizeCartItem({
      name: '350g Sin Bolsa / Granel',
      packType: 'sin_bolsa',
      hasLabel: false,
      gramsPerUnit: 350,
      unitPriceCop: 18000,
      quantity: 1,
    }),
  ];

  // Subtotal = 40.000 COP, gramos = 650g, pero se vende con descuento manual en 35.000 COP
  const sale = createSaleRecord({
    id: 301,
    invoiceCounter: 10,
    clientName: 'Cliente Descuento',
    items: customItems,
    method: 'Efectivo COP',
    paidNowCop: 35000,
    customTotalCop: 35000,
    date: '24/11/2026',
    isoDate: '2026-11-24',
    time: '14:00',
    rates,
    previousDebtCop: 0,
  });

  assert.equal(sale.totalGrams, 650);
  assert.equal(sale.subtotalCop, 40000);
  assert.equal(sale.discountCop, 5000);
  assert.equal(sale.cop, 35000);
  assert.equal(sale.isPaid, true);
  assert.equal(sale.balanceDueCop, 0);

  // Insumos: 1 bolsa especial + 1 etiqueta, 0 bolsas transparentes (porque el segundo ítem es sin_bolsa)
  const suppliesAfter = applySaleSuppliesDelta(
    { bolsas_especiales: 10, bolsas_transparentes: 10, etiquetas: 10, stickers_grandes: 5, stickers_pequenos: 5 },
    sale.items,
    -1
  );
  assert.equal(suppliesAfter.bolsas_especiales, 9);
  assert.equal(suppliesAfter.etiquetas, 9);
  assert.equal(suppliesAfter.bolsas_transparentes, 10);

  const receiptText = buildSaleWhatsAppText(sale, 0, rates);
  assert.match(receiptText, /Subtotal:/);
  assert.match(receiptText, /Descuento aplicado:/);
});
