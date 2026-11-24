import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Clock,
  Edit3,
  Factory,
  Flame,
  List,
  Package,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  calcMermaPct,
  formatBagsEquivalence,
  formatGrams,
  formatKg,
  formatWeightDual,
  toGrams,
} from '../utils/grams.js';
import { getProducerAvailableGrams } from '../utils/ledger.js';
import { formatCOP, getTodayISO, roundCop } from '../utils/money.js';

export default function FabricaTab({
  state,
  onCompleteProcess,
  onSaveActiveProcess,
  onResumeActiveProcess,
  onCancelActiveProcess,
  onEditLog,
  onDeleteLog,
  onAdjustManualInventory,
  onUpdateSupplies,
  onNotify,
}) {
  const {
    inventoryGrams,
    supplies,
    producers,
    purchases,
    processHistory,
    activeProcesses,
    catalog,
    costConfig,
  } = state;
  const todayISO = getTodayISO();

  const [fAction, setFAction] = useState('trilla'); // 'trilla' | 'tueste'
  const [fDate, setFDate] = useState(todayISO);
  const [fProducer, setFProducer] = useState('Stock General / Mezcla');
  const [unit, setUnit] = useState('g'); // 'g' | 'kg'
  const [fInVal, setFInVal] = useState('');
  const [fOutVal, setFOutVal] = useState('');

  // Panel para cargar/poner a mano Café Tostado sobrante (de la semana pasada), Azul, Pergamino e Insumos
  const [showManualStockPanel, setShowManualStockPanel] = useState(false);
  const [manualCoffeeType, setManualCoffeeType] = useState('tostado'); // 'tostado' | 'azul' | 'pergamino'
  const [manualUnit, setManualUnit] = useState('g'); // 'g' | 'kg'
  const [manualVal, setManualVal] = useState('');

  const inputGrams = useMemo(() => toGrams(fInVal, unit), [fInVal, unit]);
  const outputGrams = useMemo(() => toGrams(fOutVal, unit), [fOutVal, unit]);
  const currentMerma = useMemo(() => calcMermaPct(inputGrams, outputGrams), [inputGrams, outputGrams]);

  const producersWithStock = useMemo(() => {
    const coffeeType = fAction === 'trilla' ? 'Pergamino' : 'Azul';
    return producers
      .map((p) => ({
        name: p.name,
        stockGrams: getProducerAvailableGrams(
          p.name,
          coffeeType,
          purchases,
          processHistory,
          activeProcesses
        ),
      }))
      .filter((p) => p.stockGrams > 0);
  }, [producers, fAction, purchases, processHistory, activeProcesses]);

  const availablePoolGrams = fAction === 'trilla'
    ? (inventoryGrams?.pergamino || 0)
    : (inventoryGrams?.azul || 0);

  const roastedBagsEquiv = formatBagsEquivalence(inventoryGrams?.tostado || 0, 200);
  const outputBagsEquiv = formatBagsEquivalence(outputGrams, 200);

  const gasEstimateCop = fAction === 'tueste'
    ? roundCop((outputGrams / 1000) * (costConfig?.costoGasKgTostadoCop || 600))
    : 0;

  const handleManualCoffeeAction = (mode) => {
    const grams = toGrams(manualVal, manualUnit);
    if (mode === 'add' && grams <= 0) {
      onNotify?.('⚠️ Ingresa una cantidad mayor a 0 para sumar');
      return;
    }
    if (mode === 'set' && (manualVal === '' || Number(manualVal) < 0)) {
      onNotify?.('⚠️ Ingresa un peso válido');
      return;
    }
    onAdjustManualInventory?.({
      coffeeKey: manualCoffeeType,
      grams,
      mode, // 'add' | 'set'
    });
    setManualVal('');
  };

  const handleFinish = (e) => {
    e.preventDefault();
    if (inputGrams <= 0 || outputGrams <= 0 || outputGrams > inputGrams) {
      onNotify?.('⚠️ Verifica pesos: salida debe ser mayor a 0 y no superar entrada');
      return;
    }
    if (inputGrams > availablePoolGrams) {
      onNotify?.(`⚠️ Stock insuficiente (${formatWeightDual(availablePoolGrams)} disponible)`);
      return;
    }

    const kgItem = catalog.find((c) => c.grams === 1000) || { priceCop: 40000 };
    const lastPurchase = purchases.find(
      (p) => p.coffeeType === (fAction === 'trilla' ? 'Pergamino' : 'Azul')
    );
    const costPerKg = lastPurchase?.pricePerKgCop || (
      fAction === 'trilla' ? (costConfig?.precioKgPergaminoCop || 17000) : (costConfig?.precioKgAzulCop || 20500)
    );
    const estRevenue = roundCop((outputGrams / 1000) * kgItem.priceCop);
    const estCost = roundCop((inputGrams / 1000) * costPerKg) + gasEstimateCop;

    onCompleteProcess({
      type: fAction,
      producer: fProducer || 'Stock General / Mezcla',
      inputGrams,
      outputGrams,
      mermaPct: currentMerma,
      gasCostCop: gasEstimateCop,
      estimatedProfitCop: estRevenue - estCost,
      isoDate: fDate || todayISO,
    });

    setFInVal('');
    setFOutVal('');
  };

  const handleSaveActive = () => {
    if (inputGrams <= 0) {
      onNotify?.('⚠️ Ingresa el peso bruto de entrada');
      return;
    }
    if (inputGrams > availablePoolGrams) {
      onNotify?.(`⚠️ Stock insuficiente (${formatWeightDual(availablePoolGrams)} disponible)`);
      return;
    }

    onSaveActiveProcess({
      type: fAction,
      producer: fProducer || 'Stock General / Mezcla',
      inputGrams,
      isoDate: fDate || todayISO,
    });

    setFInVal('');
    setFOutVal('');
  };

  const handleResume = (ap) => {
    const resumed = onResumeActiveProcess(ap.id);
    if (resumed) {
      setFAction(resumed.type);
      setFProducer(resumed.producer || 'Stock General / Mezcla');
      setUnit('g');
      setFInVal(String(resumed.inputGrams));
      setFOutVal('');
    }
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in pb-28">
      {/* Tarjetas de inventario en gramos + kg (Toca cualquiera para ajustar a mano) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            setManualCoffeeType('pergamino');
            setShowManualStockPanel(true);
          }}
          className="theme-card p-3 rounded-2xl text-center"
        >
          <p className="text-[9px] font-bold uppercase theme-muted">Pergamino ✏️</p>
          <p className="text-lg font-black mt-0.5">{formatKg(inventoryGrams?.pergamino || 0)}</p>
          <p className="text-[10px] theme-muted font-semibold">
            {formatGrams(inventoryGrams?.pergamino || 0)}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setManualCoffeeType('azul');
            setShowManualStockPanel(true);
          }}
          className="theme-card p-3 rounded-2xl text-center"
        >
          <p className="text-[9px] font-bold uppercase theme-muted">Café Azul ✏️</p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {formatKg(inventoryGrams?.azul || 0)}
          </p>
          <p className="text-[10px] theme-muted font-semibold">
            {formatGrams(inventoryGrams?.azul || 0)}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setManualCoffeeType('tostado');
            setShowManualStockPanel(true);
          }}
          className="theme-accent-bg p-3 rounded-2xl text-center shadow"
        >
          <p className="text-[9px] font-bold uppercase opacity-95">Tostado ✏️</p>
          <p className="text-lg font-black mt-0.5">{formatKg(inventoryGrams?.tostado || 0)}</p>
          <p className="text-[10px] font-bold opacity-95">
            {roastedBagsEquiv.bags}x 200g
          </p>
        </button>
      </div>

      {/* Botón / Panel para poner a mano Café Tostado de la semana pasada, Azul, Pergamino o Insumos */}
      <div className="theme-card p-3.5 rounded-2xl space-y-3 border-2 border-amber-500/40">
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => setShowManualStockPanel((v) => !v)}
            className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text text-left"
          >
            <Edit3 size={15} />
            Cargar / Poner Stock a Mano (Café Tostado, Azul, Bolsas...)
          </button>
          <button
            type="button"
            onClick={() => setShowManualStockPanel((v) => !v)}
            className="text-xs font-black theme-accent-soft px-2.5 py-1 rounded-lg"
          >
            {showManualStockPanel ? 'Cerrar ▲' : 'Abrir ▼'}
          </button>
        </div>

        {showManualStockPanel && (
          <div className="space-y-3 pt-2 border-t theme-border">
            <p className="text-[11px] theme-muted">
              Úsalo para meter el <strong>café tostado que te quedó de la semana pasada</strong> o ajustar a mano lo que tienes hoy en físico sin tener que trillar/tostar primero.
            </p>

            {/* Selector tipo de café */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { key: 'tostado', label: '☕ Café Tostado' },
                { key: 'azul', label: '💧 Café Azul' },
                { key: 'pergamino', label: '🌾 Pergamino' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setManualCoffeeType(t.key)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-black border ${
                    manualCoffeeType === t.key
                      ? 'theme-accent-bg border-transparent'
                      : 'theme-subtle theme-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase theme-muted block">
                  Cantidad de {manualCoffeeType.toUpperCase()} (Actual:{' '}
                  {formatWeightDual(inventoryGrams?.[manualCoffeeType] || 0)})
                </label>
                <input
                  type="number"
                  step={manualUnit === 'kg' ? '0.001' : '1'}
                  min="0"
                  value={manualVal}
                  onChange={(e) => setManualVal(e.target.value)}
                  placeholder={manualUnit === 'g' ? 'Ej. 1500' : 'Ej. 1.5'}
                  className="w-full p-2.5 rounded-xl theme-input text-sm font-black mt-1"
                />
              </div>
              <div className="flex rounded-xl overflow-hidden border theme-border mb-0.5">
                {['g', 'kg'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setManualUnit(u)}
                    className={`px-3 py-2.5 text-xs font-black uppercase ${
                      manualUnit === u ? 'theme-accent-bg' : 'theme-card theme-muted'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleManualCoffeeAction('add')}
                className="theme-success-soft py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1"
              >
                <Plus size={14} /> SUMAR AL STOCK
              </button>
              <button
                type="button"
                onClick={() => handleManualCoffeeAction('set')}
                className="theme-accent-bg py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1"
              >
                <Save size={14} /> FIJAR ESTE TOTAL
              </button>
            </div>

            {/* Ajuste rápido de insumos a mano aquí mismo */}
            <div className="pt-2 border-t theme-border space-y-2">
              <p className="text-[10px] font-black uppercase theme-muted flex items-center gap-1">
                <Package size={12} /> Poner a mano Bolsas, Etiquetas y Stickers actuales
              </p>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {[
                  { key: 'bolsas_especiales', label: 'B. Esp.' },
                  { key: 'bolsas_transparentes', label: 'B. Transp.' },
                  { key: 'etiquetas', label: 'Etiquetas' },
                  { key: 'stickers_grandes', label: 'Sticker G' },
                  { key: 'stickers_pequenos', label: 'Sticker P' },
                ].map((s) => (
                  <div key={s.key} className="theme-subtle p-1.5 rounded-xl">
                    <label className="text-[8px] font-bold uppercase theme-muted block truncate">
                      {s.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={supplies?.[s.key] ?? 0}
                      onChange={(e) =>
                        onUpdateSupplies?.({
                          ...supplies,
                          [s.key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full p-1 rounded theme-card text-center font-black text-xs mt-0.5"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selector Trilla / Tueste */}
      <div className="flex theme-card p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setFAction('trilla')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg ${
            fAction === 'trilla' ? 'theme-accent-bg shadow-sm' : 'theme-muted'
          }`}
        >
          1. TRILLAR (Pergamino → Azul)
        </button>
        <button
          type="button"
          onClick={() => setFAction('tueste')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1 ${
            fAction === 'tueste' ? 'bg-orange-600 text-white shadow-sm' : 'theme-muted'
          }`}
        >
          <Flame size={14} /> 2. TOSTAR (Azul → Tostado)
        </button>
      </div>

      {/* Lotes en curso */}
      {activeProcesses.length > 0 && (
        <div className="theme-info-soft p-3.5 rounded-2xl border border-blue-400/30 space-y-2">
          <p className="text-xs font-black uppercase flex items-center gap-1.5">
            <Clock size={14} /> Lotes en Proceso ({activeProcesses.length})
          </p>
          {activeProcesses.map((ap) => (
            <div
              key={ap.id}
              className="theme-card p-2.5 rounded-xl flex justify-between items-center gap-2"
            >
              <div>
                <p className="text-xs font-extrabold">
                  {ap.type === 'trilla' ? 'Trilla' : 'Tueste'} — {ap.producer}
                </p>
                <p className="text-[10px] theme-muted">
                  Entrada: {formatWeightDual(ap.inputGrams)} · {ap.date}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleResume(ap)}
                  className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black"
                >
                  CONTINUAR
                </button>
                <button
                  type="button"
                  onClick={() => onCancelActiveProcess(ap.id)}
                  className="theme-muted hover:text-red-500 p-1"
                  title="Cancelar y devolver gramos"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de Trilla / Tueste */}
      <div className="theme-card p-4 rounded-2xl">
        <form onSubmit={handleFinish} className="space-y-3.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase theme-muted">
              Disponible para {fAction === 'trilla' ? 'trillar' : 'tostar'}:{' '}
              <strong>{formatWeightDual(availablePoolGrams)}</strong>
            </span>
            <div className="flex rounded-lg overflow-hidden border theme-border">
              {['g', 'kg'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase ${
                    unit === u ? 'theme-accent-bg' : 'theme-card theme-muted'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase theme-muted">Fecha</label>
              <input
                type="date"
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
                className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase theme-muted">Productor / Lote</label>
              <select
                value={fProducer}
                onChange={(e) => setFProducer(e.target.value)}
                className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
              >
                <option value="Stock General / Mezcla">
                  Stock General / Mezcla ({formatKg(availablePoolGrams)})
                </option>
                {producersWithStock.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({formatWeightDual(p.stockGrams)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase theme-muted">
                Peso Entrada ({unit})
              </label>
              <input
                type="number"
                step={unit === 'kg' ? '0.001' : '1'}
                value={fInVal}
                onChange={(e) => setFInVal(e.target.value)}
                placeholder={unit === 'g' ? '4000' : '4.0'}
                className="w-full p-3 rounded-xl theme-input mt-1 text-center text-base font-black"
                required
              />
            </div>
            <ArrowRightLeft size={20} className="theme-muted mt-5 shrink-0" />
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase theme-muted">
                Peso Obtenido ({unit})
              </label>
              <input
                type="number"
                step={unit === 'kg' ? '0.001' : '1'}
                value={fOutVal}
                onChange={(e) => setFOutVal(e.target.value)}
                placeholder={unit === 'g' ? '3200' : '3.2'}
                className="w-full p-3 rounded-xl theme-input mt-1 text-center text-base font-black theme-accent-text"
                required
              />
            </div>
          </div>

          <div className="theme-subtle p-3 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold theme-muted">Merma del lote:</span>
              <span
                className={`text-lg font-black ${
                  currentMerma > 22 ? 'theme-danger-text' : 'theme-success-text'
                }`}
              >
                {currentMerma}%
              </span>
            </div>
            {fAction === 'tueste' && outputGrams > 0 && (
              <div className="flex justify-between items-center text-[11px] theme-muted pt-1 border-t theme-border">
                <span>Rinde: {outputBagsEquiv.label}</span>
                <span>Gas est: {formatCOP(gasEstimateCop)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleSaveActive}
              className="theme-info-soft py-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
            >
              <Clock size={15} /> EN CURSO
            </button>
            <button
              type="submit"
              className="theme-accent-bg py-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow"
            >
              <Factory size={15} /> FINALIZAR
            </button>
          </div>
        </form>
      </div>

      {/* Bitácora de lotes */}
      {processHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider theme-muted flex items-center gap-1.5">
            <List size={14} /> Bitácora de Lotes ({processHistory.length})
          </h3>
          {processHistory.slice(0, 15).map((log) => (
            <div
              key={log.id}
              className="theme-card p-3 rounded-xl flex justify-between items-center gap-2"
            >
              <div>
                <p className="text-xs font-extrabold">
                  {log.type === 'trilla' ? 'Trilla' : 'Tueste 🔥'} — {log.producer}
                </p>
                <p className="text-[10px] theme-muted">
                  {log.date} · {formatWeightDual(log.inputGrams)} → {formatWeightDual(log.outputGrams)}
                </p>
                {log.estimatedProfitCop !== undefined && (
                  <p
                    className={`text-[10px] font-bold mt-0.5 ${
                      log.estimatedProfitCop >= 0 ? 'theme-success-text' : 'theme-danger-text'
                    }`}
                  >
                    Ganancia Est: {formatCOP(log.estimatedProfitCop)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-black ${
                    parseFloat(log.mermaPct) > 22 ? 'theme-danger-text' : 'theme-success-text'
                  }`}
                >
                  {log.mermaPct}%
                </span>
                <button
                  type="button"
                  onClick={() => onEditLog(log)}
                  className="theme-muted hover:text-amber-500 p-1"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteLog(log.id)}
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
  );
}
