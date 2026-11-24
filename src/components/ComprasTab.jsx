import React, { useMemo, useState } from 'react';
import { Edit3, List, MinusCircle, Package, ShoppingCart, Trash2 } from 'lucide-react';
import { formatGrams, formatWeightDual, toGrams } from '../utils/grams.js';
import {
  copToBs,
  copToUsd,
  formatBS,
  formatCOP,
  formatUSD,
  getTodayISO,
  roundCop,
  toCop,
} from '../utils/money.js';

const EXPENSE_CATEGORIES = [
  'Empaques/Bolsas',
  'Etiquetas',
  'Gas',
  'Electricidad/Agua',
  'Mantenimiento/Equipos',
  'Transporte/Envíos',
  'Insumos',
  'Otros',
];

const DEFAULT_FIXED_CATEGORIES = new Set([
  'Electricidad/Agua',
  'Mantenimiento/Equipos',
  'Transporte/Envíos',
  'Otros',
]);

const SUPPLY_OPTIONS = [
  { key: '', label: 'No suma unidades (solo gasto en $)' },
  { key: 'bolsas_especiales', label: 'Bolsas Especiales (Con Etiqueta)' },
  { key: 'bolsas_transparentes', label: 'Bolsas Transparentes / Granel' },
  { key: 'etiquetas', label: 'Etiquetas' },
  { key: 'stickers_grandes', label: 'Stickers Grandes (G)' },
  { key: 'stickers_pequenos', label: 'Stickers Pequeños (P)' },
];

const SUPPLY_LABELS = {
  bolsas_especiales: 'Bolsas Especiales',
  bolsas_transparentes: 'Bolsas Transp./Granel',
  etiquetas: 'Etiquetas',
  stickers_grandes: 'Stickers G',
  stickers_pequenos: 'Stickers P',
};

const PAYMENT_METHODS = [
  'Efectivo COP',
  'Efectivo USD',
  'Efectivo BS',
  'Pago Móvil',
  'Bancolombia',
  'Binance',
];

export default function ComprasTab({
  state,
  onAddPurchase,
  onDeletePurchase,
  onAddExpense,
  onDeleteExpense,
  onUpdateSupplies,
  onNotify,
}) {
  const { rates, producers, purchases, expenses, inventoryGrams, supplies } = state;
  const todayISO = getTodayISO();

  const [cTab, setCTab] = useState('materia_prima');
  const [cDate, setCDate] = useState(todayISO);
  const [cProdType, setCProdType] = useState('Pergamino');
  const [cProducer, setCProducer] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg'); // 'kg' | 'g'
  const [cWeight, setCWeight] = useState('');
  const [cPricePerKgCop, setCPricePerKgCop] = useState('');
  const [cMethod, setCMethod] = useState('Efectivo COP');
  const [showBuyHistory, setShowBuyHistory] = useState(false);

  // OPEX + Compra de Insumos (Bolsas, Etiquetas, Stickers)
  const [oDate, setODate] = useState(todayISO);
  const [oCategory, setOCategory] = useState('Empaques/Bolsas');
  const [oIsFixed, setOIsFixed] = useState(false);
  const [oDesc, setODesc] = useState('');
  const [oAmount, setOAmount] = useState('');
  const [oCurrency, setOCurrency] = useState('COP');
  const [oMethod, setOMethod] = useState('Efectivo COP');
  const [oSupplyKey, setOSupplyKey] = useState('bolsas_especiales');
  const [oSupplyQty, setOSupplyQty] = useState('');
  const [showOpexHistory, setShowOpexHistory] = useState(false);
  const [showQuickSuppliesEdit, setShowQuickSuppliesEdit] = useState(false);

  const sortedProducers = useMemo(
    () => producers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [producers]
  );

  const incomingGrams = useMemo(() => toGrams(cWeight, weightUnit), [cWeight, weightUnit]);
  const totalBuyCop = useMemo(() => {
    const priceKg = Number(cPricePerKgCop) || 0;
    if (incomingGrams <= 0 || priceKg <= 0) return 0;
    return roundCop((incomingGrams / 1000) * priceKg);
  }, [incomingGrams, cPricePerKgCop]);

  const currentTypeGrams = cProdType === 'Pergamino'
    ? (inventoryGrams?.pergamino || 0)
    : (inventoryGrams?.azul || 0);

  const handleBuySubmit = (e) => {
    e.preventDefault();
    if (!cProducer.trim() || incomingGrams <= 0 || !cPricePerKgCop) {
      onNotify?.('⚠️ Completa productor, peso y precio por Kg');
      return;
    }

    onAddPurchase({
      isoDate: cDate || todayISO,
      coffeeType: cProdType,
      producer: cProducer.trim(),
      grams: incomingGrams,
      pricePerKgCop: roundCop(cPricePerKgCop),
      cop: totalBuyCop,
      method: cMethod,
      isCredit: cMethod === 'Crédito',
    });

    setCWeight('');
    setCPricePerKgCop('');
    setCProducer('');
  };

  const opexCopPreview = useMemo(
    () => toCop(oAmount || 0, oCurrency, rates),
    [oAmount, oCurrency, rates]
  );

  const parsedSupplyQty = Math.max(0, parseInt(oSupplyQty, 10) || 0);
  const currentSupplyCount = oSupplyKey ? (supplies?.[oSupplyKey] ?? 0) : 0;

  const handleCategoryChange = (cat) => {
    setOCategory(cat);
    setOIsFixed(DEFAULT_FIXED_CATEGORIES.has(cat));
    if (cat === 'Empaques/Bolsas') {
      setOSupplyKey('bolsas_especiales');
    } else if (cat === 'Etiquetas') {
      setOSupplyKey('etiquetas');
    } else if (cat === 'Insumos') {
      setOSupplyKey('stickers_grandes');
    } else {
      setOSupplyKey('');
      setOSupplyQty('');
    }
  };

  const handleOpexSubmit = (e) => {
    e.preventDefault();
    if (!oDesc.trim() || opexCopPreview <= 0) {
      onNotify?.('⚠️ Ingresa detalle y monto del gasto');
      return;
    }

    onAddExpense({
      isoDate: oDate || todayISO,
      category: oCategory,
      isFixed: oIsFixed,
      description: oDesc.trim(),
      originalAmount: parseFloat(oAmount) || 0,
      originalCurrency: oCurrency,
      cop: opexCopPreview,
      method: oMethod,
      supplyKey: oSupplyKey || null,
      supplyQty: oSupplyKey ? parsedSupplyQty : 0,
    });

    setOAmount('');
    setODesc('');
    setOSupplyQty('');
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in pb-28">
      <div className="flex theme-card p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setCTab('materia_prima')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 ${
            cTab === 'materia_prima' ? 'theme-accent-bg shadow-sm' : 'theme-muted'
          }`}
        >
          <Package size={14} /> MATERIA PRIMA
        </button>
        <button
          type="button"
          onClick={() => setCTab('opex')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 ${
            cTab === 'opex' ? 'bg-red-600 text-white shadow-sm' : 'theme-muted'
          }`}
        >
          <MinusCircle size={14} /> INSUMOS & GASTOS
        </button>
      </div>

      {/* Barra rápida de stock de insumos (Bolsas, Etiquetas, Stickers) editable a mano */}
      <div className="theme-card p-3 rounded-2xl space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-wider theme-accent-text flex items-center gap-1">
            <Package size={13} /> Stock de Bolsas, Etiquetas y Stickers
          </span>
          <button
            type="button"
            onClick={() => setShowQuickSuppliesEdit((v) => !v)}
            className="text-[10px] font-black theme-accent-soft px-2 py-0.5 rounded-lg flex items-center gap-1"
          >
            <Edit3 size={11} /> {showQuickSuppliesEdit ? 'Listo' : 'Poner a mano'}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5 text-center">
          {[
            { key: 'bolsas_especiales', short: 'B. Esp.' },
            { key: 'bolsas_transparentes', short: 'B. Transp.' },
            { key: 'etiquetas', short: 'Etiquetas' },
            { key: 'stickers_grandes', short: 'Sticker G' },
            { key: 'stickers_pequenos', short: 'Sticker P' },
          ].map((item) => (
            <div key={item.key} className="theme-subtle p-1.5 rounded-xl">
              <span className="text-[8px] font-bold uppercase theme-muted block truncate">
                {item.short}
              </span>
              {showQuickSuppliesEdit ? (
                <input
                  type="number"
                  min="0"
                  value={supplies?.[item.key] ?? 0}
                  onChange={(e) =>
                    onUpdateSupplies?.({
                      ...supplies,
                      [item.key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-full p-1 rounded theme-card text-center font-black text-xs mt-0.5"
                />
              ) : (
                <span className="text-xs font-black block mt-0.5">
                  {supplies?.[item.key] ?? 0}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {cTab === 'materia_prima' ? (
        <>
          <div className="theme-card p-4 rounded-2xl">
            <form onSubmit={handleBuySubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted">Fecha</label>
                  <input
                    type="date"
                    value={cDate}
                    onChange={(e) => setCDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted">Tipo de Café</label>
                  <select
                    value={cProdType}
                    onChange={(e) => setCProdType(e.target.value)}
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                  >
                    <option value="Pergamino">Pergamino</option>
                    <option value="Azul">Azul (Lavado)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase theme-muted">Productor / Finca</label>
                <input
                  list="producers-list-v8"
                  value={cProducer}
                  onChange={(e) => setCProducer(e.target.value)}
                  placeholder="Buscar o escribir productor..."
                  className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-semibold"
                  required
                />
                <datalist id="producers-list-v8">
                  {sortedProducers.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.finca ? `${p.name} (${p.finca})` : p.name}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="theme-subtle p-3 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase theme-muted">
                    Peso (Acumula sobrantes exactos en g)
                  </span>
                  <div className="flex rounded-lg overflow-hidden border theme-border">
                    {['kg', 'g'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setWeightUnit(u)}
                        className={`px-2.5 py-1 text-[10px] font-black uppercase ${
                          weightUnit === u ? 'theme-accent-bg' : 'theme-card theme-muted'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Cantidad ({weightUnit})
                    </label>
                    <input
                      type="number"
                      step={weightUnit === 'kg' ? '0.001' : '1'}
                      value={cWeight}
                      onChange={(e) => setCWeight(e.target.value)}
                      placeholder={weightUnit === 'kg' ? '10.000' : '10000'}
                      className="w-full p-2.5 rounded-xl theme-card text-sm font-black mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Precio x Kg (COP)
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={cPricePerKgCop}
                      onChange={(e) => setCPricePerKgCop(e.target.value)}
                      placeholder="17000"
                      className="w-full p-2.5 rounded-xl theme-card text-sm font-black mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] pt-1 border-t theme-border">
                  <span className="theme-muted">
                    Stock actual: <strong>{formatGrams(currentTypeGrams)}</strong>
                  </span>
                  <span className="theme-success-text font-black">
                    Nuevo total: {formatWeightDual(currentTypeGrams + incomingGrams)}
                  </span>
                </div>
              </div>

              <div className="theme-accent-soft p-3 rounded-xl text-center space-y-0.5">
                <p className="text-[10px] font-bold uppercase">Monto Total Compra</p>
                <p className="text-xl font-black">{formatCOP(totalBuyCop)}</p>
                <p className="text-[11px] font-semibold">
                  {formatUSD(copToUsd(totalBuyCop, rates))} · {formatBS(copToBs(totalBuyCop, rates))}
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase theme-muted">Método de Pago</label>
                <select
                  value={cMethod}
                  onChange={(e) => setCMethod(e.target.value)}
                  className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="Crédito">A CRÉDITO (POR PAGAR)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full theme-accent-bg py-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow"
              >
                <ShoppingCart size={16} /> REGISTRAR COMPRA
              </button>
            </form>
          </div>

          {purchases.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowBuyHistory((v) => !v)}
                className="w-full theme-card px-3.5 py-2.5 rounded-xl text-xs font-bold flex justify-between items-center"
              >
                <span className="flex items-center gap-1.5">
                  <List size={14} /> HISTORIAL COMPRAS ({purchases.length})
                </span>
                <span>{showBuyHistory ? '▲' : '▼'}</span>
              </button>
              {showBuyHistory && (
                <div className="space-y-2 mt-2">
                  {purchases.slice(0, 30).map((p) => (
                    <div
                      key={p.id}
                      className="theme-card p-3 rounded-xl flex justify-between items-center gap-2"
                    >
                      <div>
                        <p className="text-xs font-extrabold">
                          {formatWeightDual(p.grams)} {p.coffeeType} — {p.producer}
                        </p>
                        <p className="text-[10px] theme-muted">
                          {p.date} · {p.method} ·{' '}
                          <span className={p.isPaid ? 'theme-success-text font-bold' : 'theme-danger-text font-bold'}>
                            {p.isPaid ? 'Pagado' : `Pendiente ${formatCOP(p.balanceDueCop ?? p.cop)}`}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black theme-danger-text">
                          -{formatCOP(p.cop)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeletePurchase(p.id)}
                          className="theme-muted hover:text-red-500 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* GASTOS OPEX + COMPRA DE INSUMOS (BOLSAS / ETIQUETAS / STICKERS) */
        <>
          <div className="theme-card p-4 rounded-2xl">
            <form onSubmit={handleOpexSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted">Fecha</label>
                  <input
                    type="date"
                    value={oDate}
                    onChange={(e) => setODate(e.target.value)}
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted">Categoría</label>
                  <select
                    value={oCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bloque para sumar unidades compradas (Bolsas, Etiquetas, Stickers) al stock */}
              <div className="theme-subtle p-3 rounded-xl space-y-2.5 border border-amber-500/30">
                <p className="text-[10px] font-black uppercase theme-accent-text flex items-center gap-1">
                  <Package size={13} /> ¿Compraste Bolsas, Etiquetas o Stickers? (Suma al stock)
                </p>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <label className="text-[9px] font-bold uppercase theme-muted">
                      Insumo a sumar
                    </label>
                    <select
                      value={oSupplyKey}
                      onChange={(e) => setOSupplyKey(e.target.value)}
                      className="w-full p-2 rounded-lg theme-card text-xs font-bold mt-0.5"
                    >
                      {SUPPLY_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-5">
                    <label className="text-[9px] font-bold uppercase theme-muted">
                      Cantidad (uds)
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={!oSupplyKey}
                      value={oSupplyQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOSupplyQty(val);
                        if (oSupplyKey && val && !oDesc) {
                          setODesc(`${val} ${SUPPLY_LABELS[oSupplyKey]}`);
                        }
                      }}
                      placeholder={oSupplyKey ? 'Ej. 100' : '-'}
                      className="w-full p-2 rounded-lg theme-card text-xs font-black text-center mt-0.5"
                    />
                  </div>
                </div>
                {oSupplyKey && (
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t theme-border">
                    <span className="theme-muted">
                      Hay: <strong>{currentSupplyCount} uds</strong>
                    </span>
                    <span className="theme-success-text font-black">
                      Quedarán: {currentSupplyCount + parsedSupplyQty} uds
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOIsFixed(false)}
                  className={`py-2 rounded-xl text-[11px] font-extrabold border ${
                    !oIsFixed ? 'theme-accent-bg border-transparent' : 'theme-subtle theme-muted'
                  }`}
                >
                  Costo Directo / Variable
                </button>
                <button
                  type="button"
                  onClick={() => setOIsFixed(true)}
                  className={`py-2 rounded-xl text-[11px] font-extrabold border ${
                    oIsFixed ? 'bg-red-600 text-white border-transparent' : 'theme-subtle theme-muted'
                  }`}
                >
                  Costo Fijo / Indirecto
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase theme-muted">Detalle</label>
                <input
                  type="text"
                  value={oDesc}
                  onChange={(e) => setODesc(e.target.value)}
                  placeholder="Ej. 100 Bolsas Especiales, 200 Stickers G, Gas..."
                  className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted">Moneda</label>
                  <select
                    value={oCurrency}
                    onChange={(e) => setOCurrency(e.target.value)}
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-black"
                  >
                    <option value="COP">Pesos (COP)</option>
                    <option value="USD">Dólares (USD)</option>
                    <option value="BS">Bolívares (BS)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted">Monto Total</label>
                  <input
                    type="number"
                    step="0.01"
                    value={oAmount}
                    onChange={(e) => setOAmount(e.target.value)}
                    placeholder="0"
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-sm font-black"
                    required
                  />
                </div>
              </div>

              {opexCopPreview > 0 && (
                <p className="text-[11px] font-bold theme-muted text-center">
                  Equivalente: {formatCOP(opexCopPreview)} · {formatUSD(copToUsd(opexCopPreview, rates))}
                  {oSupplyKey && parsedSupplyQty > 0 && (
                    <span className="block theme-accent-text">
                      Costo unitario: {formatCOP(Math.round(opexCopPreview / parsedSupplyQty))} c/u
                    </span>
                  )}
                </p>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase theme-muted">Pagado con</label>
                <select
                  value={oMethod}
                  onChange={(e) => setOMethod(e.target.value)}
                  className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow"
              >
                <MinusCircle size={16} /> REGISTRAR GASTO
                {oSupplyKey && parsedSupplyQty > 0 ? ` (+${parsedSupplyQty} UDS AL STOCK)` : ''}
              </button>
            </form>
          </div>

          {expenses.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOpexHistory((v) => !v)}
                className="w-full theme-card px-3.5 py-2.5 rounded-xl text-xs font-bold flex justify-between items-center"
              >
                <span className="flex items-center gap-1.5">
                  <List size={14} /> HISTORIAL GASTOS E INSUMOS ({expenses.length})
                </span>
                <span>{showOpexHistory ? '▲' : '▼'}</span>
              </button>
              {showOpexHistory && (
                <div className="space-y-2 mt-2">
                  {expenses.slice(0, 30).map((e) => (
                    <div
                      key={e.id}
                      className="theme-card p-3 rounded-xl flex justify-between items-center gap-2"
                    >
                      <div>
                        <p className="text-xs font-extrabold">
                          {e.category} — {e.description}
                        </p>
                        <p className="text-[10px] theme-muted">
                          {e.date} · {e.isFixed ? 'Fijo/Indirecto' : 'Directo/Variable'} · {e.originalAmount}{' '}
                          {e.originalCurrency}
                        </p>
                        {e.supplyKey && e.supplyQty > 0 && (
                          <p className="text-[10px] font-black theme-success-text">
                            +{e.supplyQty} uds sumadas a {SUPPLY_LABELS[e.supplyKey] || e.supplyKey}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black theme-danger-text">
                          -{formatCOP(e.cop)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(e.id)}
                          className="theme-muted hover:text-red-500 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
