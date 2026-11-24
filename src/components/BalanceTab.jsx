import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronUp,
  Coffee,
  Database,
  Download,
  Edit3,
  Flag,
  List,
  PieChart,
  Share2,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatGrams, formatKg, formatWeightDual, getSaleTotalGrams } from '../utils/grams.js';
import {
  getAllClientDebtAccounts,
  getClientHistorySummary,
  normalizeKey,
} from '../utils/ledger.js';
import {
  copToBs,
  copToUsd,
  formatBS,
  formatCOP,
  formatDateDisplay,
  formatMoney,
  formatUSD,
  getLastNDaysISO,
  getLastNMonths,
  getTodayISO,
  roundCop,
} from '../utils/money.js';

export default function BalanceTab({
  state,
  costing,
  onOpenReceipt,
  onOpenPayment,
  onEditSale,
  onDeleteSale,
  onPayPurchase,
  onUpdateCostConfig,
  onUpdateCatalogPrice,
  onExportCsv,
}) {
  const {
    rates,
    displayCurrency,
    supplies,
    sales,
    purchases,
    expenses,
    processHistory,
    clients,
    producers,
  } = state;

  const todayISO = getTodayISO();
  const [subTab, setSubTab] = useState('resumen'); // 'resumen' | 'costos' | 'estadisticas'
  const [visibleSales, setVisibleSales] = useState(10);
  const [expandedDebtKey, setExpandedDebtKey] = useState(null);
  const [expandedClientStatsKey, setExpandedClientStatsKey] = useState(null);
  const [statsRange, setStatsRange] = useState('7D'); // '7D' | '30D' | '1A' | 'HIST'
  const [showCostParams, setShowCostParams] = useState(true);

  const fmt = (cop) => formatMoney(cop, displayCurrency, rates);

  // Métricas financieras globales exactas
  const nonDonationSales = useMemo(() => sales.filter((s) => !s.isDonation), [sales]);

  const totalVendidoBrutoCop = useMemo(
    () => nonDonationSales.reduce((sum, s) => sum + roundCop(s.cop), 0),
    [nonDonationSales]
  );
  const ingresosCobradosCop = useMemo(
    () => nonDonationSales.reduce((sum, s) => sum + roundCop(s.paidAmountCop), 0),
    [nonDonationSales]
  );
  const totalPorCobrarCop = useMemo(
    () => nonDonationSales.reduce((sum, s) => sum + Math.max(0, roundCop(s.balanceDueCop)), 0),
    [nonDonationSales]
  );
  const comprasPagadasCop = useMemo(
    () => purchases.reduce((sum, p) => sum + roundCop(p.paidAmountCop ?? (p.isPaid ? p.cop : 0)), 0),
    [purchases]
  );
  const opexCop = useMemo(
    () => expenses.reduce((sum, e) => sum + roundCop(e.cop), 0),
    [expenses]
  );
  const netCashCop = ingresosCobradosCop - comprasPagadasCop - opexCop;
  const ticketPromedioCop = nonDonationSales.length > 0
    ? roundCop(totalVendidoBrutoCop / nonDonationSales.length)
    : 0;

  const donationSales = useMemo(() => sales.filter((s) => s.isDonation), [sales]);
  const donationGrams = useMemo(
    () => donationSales.reduce((sum, s) => sum + getSaleTotalGrams(s), 0),
    [donationSales]
  );

  // Cuentas por cobrar agrupadas por cliente & cuentas por pagar
  const debtAccounts = useMemo(
    () => getAllClientDebtAccounts(sales, todayISO),
    [sales, todayISO]
  );

  const cxPagar = useMemo(
    () => purchases.filter((p) => !p.isPaid && roundCop(p.balanceDueCop ?? p.cop) > 0),
    [purchases]
  );

  const lowSupplies = useMemo(() => {
    const u = supplies?.alerta_umbral ?? 10;
    const list = [];
    if ((supplies?.bolsas_especiales ?? 0) <= u) list.push(`Bolsas Especiales (${supplies?.bolsas_especiales ?? 0})`);
    if ((supplies?.bolsas_transparentes ?? 0) <= u) list.push(`Bolsas Transparentes (${supplies?.bolsas_transparentes ?? 0})`);
    if ((supplies?.etiquetas ?? 0) <= u) list.push(`Etiquetas (${supplies?.etiquetas ?? 0})`);
    if ((supplies?.stickers_grandes ?? 0) <= u) list.push(`Stickers G (${supplies?.stickers_grandes ?? 0})`);
    if ((supplies?.stickers_pequenos ?? 0) <= u) list.push(`Stickers P (${supplies?.stickers_pequenos ?? 0})`);
    return list;
  }, [supplies]);

  // Estadísticas por período
  const periodStats = useMemo(() => {
    const days7 = new Set(getLastNDaysISO(7));
    const days30 = new Set(getLastNDaysISO(30));
    const yearPrefix = todayISO.slice(0, 4);

    const inPeriod = (isoDate) => {
      if (!isoDate) return statsRange === 'HIST';
      if (statsRange === '7D') return days7.has(isoDate);
      if (statsRange === '30D') return days30.has(isoDate);
      if (statsRange === '1A') return isoDate.startsWith(yearPrefix);
      return true;
    };

    const pSales = nonDonationSales.filter((s) => inPeriod(s.isoDate));
    const pProcesses = processHistory.filter((l) => inPeriod(l.isoDate));

    let especialGrams = 0;
    let transparenteGrams = 0;
    for (const s of pSales) {
      const items = Array.isArray(s.items) ? s.items : [];
      for (const it of items) {
        const g = Math.max(0, Math.round(Number(it.totalGrams) || 0));
        if (it.packType === 'especial') especialGrams += g;
        else transparenteGrams += g;
      }
    }

    const totalTostadoGrams = pProcesses
      .filter((l) => l.type === 'tueste')
      .reduce((sum, l) => sum + (Number(l.outputGrams) || 0), 0);

    const avgMerma = pProcesses.length > 0
      ? (
          pProcesses.reduce((sum, l) => sum + (parseFloat(l.mermaPct) || 0), 0) / pProcesses.length
        ).toFixed(1)
      : '0.0';

    let chartData = [];
    if (statsRange === '7D' || statsRange === '30D') {
      const dates = getLastNDaysISO(statsRange === '7D' ? 7 : 30);
      chartData = dates.map((iso) => ({
        label: formatDateDisplay(iso).slice(0, 5),
        totalCop: nonDonationSales
          .filter((s) => s.isoDate === iso)
          .reduce((sum, s) => sum + roundCop(s.cop), 0),
      }));
    } else {
      const months = getLastNMonths(12);
      chartData = months.map((m) => ({
        label: m.label,
        totalCop: nonDonationSales
          .filter((s) => String(s.isoDate || '').startsWith(m.monthKey))
          .reduce((sum, s) => sum + roundCop(s.cop), 0),
      }));
    }

    return {
      soldCop: pSales.reduce((sum, s) => sum + roundCop(s.cop), 0),
      collectedCop: pSales.reduce((sum, s) => sum + roundCop(s.paidAmountCop), 0),
      dueCop: pSales.reduce((sum, s) => sum + Math.max(0, roundCop(s.balanceDueCop)), 0),
      especialGrams,
      transparenteGrams,
      totalTostadoGrams,
      avgMerma,
      chartData,
    };
  }, [nonDonationSales, processHistory, statsRange, todayISO]);

  const maxChartCop = useMemo(
    () => Math.max(...periodStats.chartData.map((d) => d.totalCop), 1),
    [periodStats.chartData]
  );

  // Ranking e historial por cliente (combina directorio + ventas registradas)
  const clientHistories = useMemo(() => {
    const namesMap = new Map();
    for (const c of clients) {
      namesMap.set(normalizeKey(c.fullName), c.fullName);
    }
    for (const s of nonDonationSales) {
      const k = normalizeKey(s.clientName);
      if (k && !namesMap.has(k)) namesMap.set(k, s.clientName);
    }
    return Array.from(namesMap.values())
      .map((name) => ({
        name,
        ...getClientHistorySummary(sales, name),
      }))
      .filter((c) => c.visits > 0)
      .sort((a, b) => b.totalBoughtCop - a.totalBoughtCop);
  }, [clients, nonDonationSales, sales]);

  // Calidad por productor
  const producerQuality = useMemo(() => {
    const names = new Set(producers.map((p) => p.name));
    processHistory.forEach((l) => {
      if (l.producer && l.producer !== 'Stock General / Mezcla') names.add(l.producer);
    });
    return Array.from(names)
      .map((name) => {
        const logs = processHistory.filter((l) => normalizeKey(l.producer) === normalizeKey(name));
        const inG = logs.reduce((s, l) => s + (Number(l.inputGrams) || 0), 0);
        const outG = logs.reduce((s, l) => s + (Number(l.outputGrams) || 0), 0);
        const avgMerma = inG > 0 ? Math.round(((inG - outG) / inG) * 1000) / 10 : 0;
        return { name, logsCount: logs.length, inG, outG, avgMerma };
      })
      .filter((p) => p.logsCount > 0)
      .sort((a, b) => b.inG - a.inG);
  }, [producers, processHistory]);

  return (
    <div className="p-4 space-y-4 animate-in fade-in pb-28">
      {/* Sub-tabs */}
      <div className="flex theme-card p-1 rounded-xl gap-1">
        {[
          { id: 'resumen', label: 'RESUMEN' },
          { id: 'costos', label: 'COSTOS & PE' },
          { id: 'estadisticas', label: 'ESTADÍSTICAS' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${
              subTab === t.id ? 'theme-accent-bg shadow-sm' : 'theme-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =========================================================
          SUBTAB 1: RESUMEN (CAJA, POR COBRAR, POR PAGAR, VENTAS)
         ========================================================= */}
      {subTab === 'resumen' && (
        <div className="space-y-4">
          {lowSupplies.length > 0 && (
            <div className="theme-danger-soft p-3.5 rounded-2xl border border-red-400/40 flex items-center gap-3">
              <AlertTriangle size={20} className="shrink-0" />
              <div>
                <p className="text-xs font-black uppercase">¡Alerta de Insumos Bajos!</p>
                <p className="text-[11px] font-medium">{lowSupplies.join(' · ')}</p>
              </div>
            </div>
          )}

          {/* Tarjeta Balance Neto */}
          <div className="theme-card p-5 rounded-2xl relative overflow-hidden space-y-3">
            <TrendingUp size={84} className="absolute -bottom-3 -right-3 opacity-5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest theme-muted">
                Balance Neto de Caja ({displayCurrency})
              </p>
              <p
                className={`text-3xl font-black mt-0.5 ${
                  netCashCop >= 0 ? 'theme-success-text' : 'theme-danger-text'
                }`}
              >
                {fmt(netCashCop)}
              </p>
              {displayCurrency !== 'COP' && (
                <p className="text-[11px] theme-muted font-bold">{formatCOP(netCashCop)}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t theme-border">
              <div>
                <p className="text-[9px] uppercase font-bold theme-muted">Cobrado Real</p>
                <p className="text-xs font-black theme-success-text">+{fmt(ingresosCobradosCop)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold theme-muted">Compras MP</p>
                <p className="text-xs font-black theme-danger-text">-{fmt(comprasPagadasCop)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold theme-muted">Gastos OPEX</p>
                <p className="text-xs font-black theme-accent-text">-{fmt(opexCop)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t theme-border">
              <div>
                <p className="text-[9px] uppercase font-bold theme-muted flex items-center gap-1">
                  <PieChart size={10} /> Total Ventas
                </p>
                <p className="text-xs font-black">{fmt(totalVendidoBrutoCop)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold theme-muted flex items-center gap-1">
                  <ArrowRightLeft size={10} /> Por Cobrar
                </p>
                <p className="text-xs font-black theme-danger-text">{fmt(totalPorCobrarCop)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold theme-muted flex items-center gap-1">
                  <Target size={10} /> Ticket Prom.
                </p>
                <p className="text-xs font-black">{fmt(ticketPromedioCop)}</p>
              </div>
            </div>

            <div className="pt-2 border-t theme-border flex justify-between items-center text-[11px]">
              <span className="theme-muted font-bold flex items-center gap-1">
                <Coffee size={12} /> Donaciones / Cortesías
              </span>
              <span className="font-black">
                {donationSales.length} veces ({formatWeightDual(donationGrams)})
              </span>
            </div>
          </div>

          {/* Cuentas Por Cobrar Acumuladas por Cliente */}
          <div className="theme-card p-4 rounded-2xl space-y-3 border-l-4 border-l-amber-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text">
                <ArrowRightLeft size={14} /> Por Cobrar Acumulado ({debtAccounts.length} clientes)
              </h3>
              <span className="text-sm font-black theme-danger-text">{fmt(totalPorCobrarCop)}</span>
            </div>

            {debtAccounts.length === 0 ? (
              <p className="text-xs theme-muted py-2">Sin saldos pendientes por cobrar.</p>
            ) : (
              <div className="space-y-2.5">
                {debtAccounts.map((acc) => {
                  const isOpen = expandedDebtKey === acc.key;
                  return (
                    <div
                      key={acc.key}
                      className={`theme-subtle p-3 rounded-xl space-y-2 border ${
                        acc.isOverdue ? 'border-red-400/70' : 'theme-border'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedDebtKey(isOpen ? null : acc.key)}
                          className="text-left flex-1 min-w-0"
                        >
                          <p className="text-xs font-black flex items-center gap-1.5 truncate">
                            {acc.isOverdue && <Flag size={11} className="text-red-500 shrink-0" />}
                            {acc.clientName}
                            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </p>
                          <p className="text-[10px] theme-muted">
                            {acc.pendingCount} entrega{acc.pendingCount > 1 ? 's' : ''} pendiente{acc.pendingCount > 1 ? 's' : ''} ·
                            desde {formatDateDisplay(acc.oldestIsoDate)}
                          </p>
                        </button>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black theme-danger-text">{fmt(acc.debtCop)}</p>
                          <p className="text-[9px] theme-muted">
                            {formatUSD(copToUsd(acc.debtCop, rates))}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPayment({
                              mode: 'client_fifo',
                              clientName: acc.clientName,
                              maxCop: acc.debtCop,
                              initialAmountCop: '',
                            })
                          }
                          className="theme-accent-bg py-1.5 px-2 rounded-lg text-[10px] font-black"
                        >
                          Abonar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPayment({
                              mode: 'client_fifo',
                              clientName: acc.clientName,
                              maxCop: acc.debtCop,
                              initialAmountCop: acc.debtCop,
                            })
                          }
                          className="theme-success-soft py-1.5 px-2 rounded-lg text-[10px] font-black"
                        >
                          Pagar Todo
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReceipt({ statement: acc })}
                          className="theme-card py-1.5 px-2 rounded-lg text-[10px] font-black flex items-center justify-center gap-1"
                        >
                          <Share2 size={11} /> Resumen
                        </button>
                      </div>

                      {isOpen && (
                        <div className="pt-2 border-t theme-border space-y-2">
                          <p className="text-[10px] font-black uppercase theme-muted">
                            Entregas Pendientes
                          </p>
                          {acc.pendingSales.map((s) => (
                            <div
                              key={s.id}
                              className="theme-card p-2 rounded-lg flex justify-between items-center gap-2 text-[11px]"
                            >
                              <div className="min-w-0">
                                <p className="font-bold truncate">
                                  #{s.invoiceNum} · {s.date} · {s.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                                </p>
                                <p className="text-[10px] theme-muted">
                                  Total {formatCOP(s.cop)} · Pagado {formatCOP(s.paidAmountCop)} ·{' '}
                                  <strong className="theme-danger-text">Resta {formatCOP(s.balanceDueCop)}</strong>
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onEditSale(s)}
                                  className="theme-muted hover:text-amber-500 p-1"
                                  title="Editar pedido"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPayment({
                                      mode: 'cxc_single',
                                      sale: s,
                                      clientName: s.clientName,
                                      maxCop: s.balanceDueCop,
                                      initialAmountCop: s.balanceDueCop,
                                    })
                                  }
                                  className="theme-success-soft px-2 py-1 rounded text-[10px] font-black"
                                >
                                  Abonar
                                </button>
                              </div>
                            </div>
                          ))}

                          {acc.payments.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <p className="text-[10px] font-black uppercase theme-muted">
                                Historial de Abonos
                              </p>
                              {acc.payments.slice(0, 6).map((p) => (
                                <div
                                  key={p.id}
                                  className="flex justify-between text-[10px] theme-muted"
                                >
                                  <span>
                                    {p.date} · #{p.invoiceNum} ({p.method})
                                  </span>
                                  <span className="font-bold theme-success-text">
                                    +{formatCOP(p.amountCop)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cuentas Por Pagar (Productores) */}
          <div className="theme-card p-4 rounded-2xl space-y-2.5 border-l-4 border-l-red-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-danger-text">
                <BookOpen size={14} /> A Pagar (Productores)
              </h3>
              <span className="text-sm font-black">
                {fmt(cxPagar.reduce((s, p) => s + roundCop(p.balanceDueCop ?? p.cop), 0))}
              </span>
            </div>
            {cxPagar.length === 0 ? (
              <p className="text-xs theme-muted">Sin deudas pendientes con productores.</p>
            ) : (
              <div className="space-y-2">
                {cxPagar.map((p) => {
                  const pending = roundCop(p.balanceDueCop ?? p.cop);
                  return (
                    <div
                      key={p.id}
                      className="theme-subtle p-2.5 rounded-xl flex justify-between items-center gap-2"
                    >
                      <div>
                        <p className="text-xs font-extrabold">{p.producer}</p>
                        <p className="text-[10px] theme-muted">
                          {p.date} · {formatWeightDual(p.grams)} {p.coffeeType} · Resta{' '}
                          <strong className="theme-danger-text">{fmt(pending)}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPayPurchase(p)}
                        className="bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black"
                      >
                        Abonar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historial de Ventas */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider theme-muted flex items-center gap-1.5">
              <List size={14} /> Últimas Ventas ({sales.length})
            </h3>
            {sales.length === 0 ? (
              <p className="text-xs theme-muted text-center py-4 theme-card rounded-xl">
                Aún no hay ventas registradas en V8.0.
              </p>
            ) : (
              <>
                {sales.slice(0, visibleSales).map((s) => {
                  const itemsSummary = Array.isArray(s.items) && s.items.length > 0
                    ? s.items.map((i) => `${i.quantity}x ${i.name}`).join(' + ')
                    : 'Pedido';
                  const statusLabel = s.isDonation
                    ? 'Donación'
                    : s.isPaid
                      ? `Pagado (${s.method})`
                      : s.paidAmountCop > 0
                        ? `Abono ${formatCOP(s.paidAmountCop)} · Resta ${formatCOP(s.balanceDueCop)}`
                        : 'A Crédito';

                  return (
                    <div
                      key={s.id}
                      className="theme-card p-3 rounded-xl flex justify-between items-center gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold truncate">{itemsSummary}</p>
                        <p className="text-[10px] theme-muted truncate">
                          #{s.invoiceNum} · {s.date} · {s.clientName} · {formatKg(getSaleTotalGrams(s))}
                        </p>
                        <p
                          className={`text-[10px] font-bold ${
                            s.isDonation
                              ? 'text-blue-600'
                              : s.isPaid
                                ? 'theme-success-text'
                                : 'theme-danger-text'
                          }`}
                        >
                          {statusLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-black">{fmt(s.cop)}</span>
                        <button
                          type="button"
                          onClick={() => onOpenReceipt({ sale: s })}
                          className="theme-accent-text p-1"
                          title="Ver recibo"
                        >
                          <Share2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditSale(s)}
                          className="theme-muted hover:text-amber-500 p-1"
                          title="Editar venta"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSale(s.id)}
                          className="theme-muted hover:text-red-500 p-1"
                          title="Eliminar venta"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {sales.length > visibleSales && (
                  <button
                    type="button"
                    onClick={() => setVisibleSales((v) => v + 10)}
                    className="w-full py-2.5 text-xs font-black theme-card rounded-xl border-dashed"
                  >
                    CARGAR MÁS ({sales.length - visibleSales} restantes)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          SUBTAB 2: COSTOS UNIFICADOS Y PUNTO DE EQUILIBRIO
         ========================================================= */}
      {subTab === 'costos' && (
        <div className="space-y-4">
          {/* Resumen Costo Café Tostado y Mano de Obra */}
          <div className="theme-card p-4 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text">
                <Calculator size={15} /> Costo Real Café Tostado (2 Mermas)
              </h3>
              <button
                type="button"
                onClick={() => setShowCostParams((v) => !v)}
                className="text-[11px] font-bold theme-muted underline"
              >
                {showCostParams ? 'Ocultar parámetros' : 'Editar parámetros'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="theme-subtle p-2.5 rounded-xl">
                <p className="text-[9px] font-bold uppercase theme-muted">Costo Kg Azul</p>
                <p className="text-sm font-black">{fmt(costing.costoKgAzulCop)}</p>
              </div>
              <div className="theme-accent-soft p-2.5 rounded-xl">
                <p className="text-[9px] font-bold uppercase">Costo Kg Tostado</p>
                <p className="text-sm font-black">{fmt(costing.costoKgTostadoCop)}</p>
              </div>
              <div className="theme-subtle p-2.5 rounded-xl">
                <p className="text-[9px] font-bold uppercase theme-muted">Costo x Gramo Tostado</p>
                <p className="text-sm font-black">${costing.costoGramoTostadoCop.toLocaleString('es-CO')} COP/g</p>
              </div>
              <div className="theme-subtle p-2.5 rounded-xl">
                <p className="text-[9px] font-bold uppercase theme-muted">
                  Mano Obra ({costing.horasPorKg} h/kg)
                </p>
                <p className="text-sm font-black">{fmt(costing.costoManoObraKgCop)}/kg</p>
              </div>
            </div>

            {showCostParams && (
              <div className="pt-3 border-t theme-border space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted block mb-1">
                    Base de Materia Prima
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'pergamino', label: 'Pergamino (2 mermas)' },
                      { id: 'azul', label: 'Azul Directo' },
                      { id: 'auto_purchases', label: 'Real Compras' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onUpdateCostConfig({ sourceMode: opt.id })}
                        className={`py-2 px-1.5 rounded-lg text-[10px] font-black border ${
                          costing.config.sourceMode === opt.id
                            ? 'theme-accent-bg border-transparent'
                            : 'theme-subtle theme-muted'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Pergamino ($/kg)
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={costing.config.precioKgPergaminoCop}
                      onChange={(e) =>
                        onUpdateCostConfig({ precioKgPergaminoCop: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Merma Trilla (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={costing.config.mermaTrillaPct}
                      onChange={(e) =>
                        onUpdateCostConfig({ mermaTrillaPct: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Azul Directo ($/kg)
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={costing.config.precioKgAzulCop}
                      onChange={(e) =>
                        onUpdateCostConfig({ precioKgAzulCop: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Merma Tueste (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={costing.config.mermaTuestePct}
                      onChange={(e) =>
                        onUpdateCostConfig({ mermaTuestePct: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Gas Tueste ($/kg)
                    </label>
                    <input
                      type="number"
                      step="50"
                      value={costing.config.costoGasKgTostadoCop}
                      onChange={(e) =>
                        onUpdateCostConfig({ costoGasKgTostadoCop: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Molino/Luz ($/kg)
                    </label>
                    <input
                      type="number"
                      step="50"
                      value={costing.config.costoMolinoKgCop}
                      onChange={(e) =>
                        onUpdateCostConfig({ costoMolinoKgCop: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Bolsa Especial ($)
                    </label>
                    <input
                      type="number"
                      step="50"
                      value={costing.config.costoBolsaEspecialCop}
                      onChange={(e) =>
                        onUpdateCostConfig({ costoBolsaEspecialCop: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Bolsa Transp. ($)
                    </label>
                    <input
                      type="number"
                      step="10"
                      value={costing.config.costoBolsaTransparenteCop}
                      onChange={(e) =>
                        onUpdateCostConfig({
                          costoBolsaTransparenteCop: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Valor Hora ($)
                    </label>
                    <input
                      type="number"
                      step="500"
                      value={costing.config.valorHoraCop}
                      onChange={(e) =>
                        onUpdateCostConfig({ valorHoraCop: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Horas Tanda
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      value={costing.config.horasTanda}
                      onChange={(e) =>
                        onUpdateCostConfig({ horasTanda: parseFloat(e.target.value) || 0.1 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Kg Tanda
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={costing.config.kgTanda}
                      onChange={(e) =>
                        onUpdateCostConfig({ kgTanda: parseFloat(e.target.value) || 0.5 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Fijos Mes ($)
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={costing.config.costosFijosMesCop}
                      onChange={(e) =>
                        onUpdateCostConfig({ costosFijosMesCop: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Meta Mes (kg)
                    </label>
                    <input
                      type="number"
                      step="5"
                      value={costing.config.volumenMensualMetaKg}
                      onChange={(e) =>
                        onUpdateCostConfig({
                          volumenMensualMetaKg: parseFloat(e.target.value) || 1,
                        })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">
                      Margen Obj (%)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={costing.config.margenObjetivoPct}
                      onChange={(e) =>
                        onUpdateCostConfig({
                          margenObjetivoPct: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-[11px] font-bold pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={costing.config.useRealOpexForFixed}
                      onChange={(e) =>
                        onUpdateCostConfig({ useRealOpexForFixed: e.target.checked })
                      }
                    />
                    Usar OPEX fijo real del mes ({formatCOP(costing.realMonthOpexCop)})
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={costing.config.prorrateoMode === 'real'}
                      onChange={(e) =>
                        onUpdateCostConfig({
                          prorrateoMode: e.target.checked ? 'real' : 'projected',
                        })
                      }
                    />
                    Prorratear indirectos sobre ventas reales del mes
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta Punto de Equilibrio Mensual */}
          <div className="theme-card p-4 rounded-2xl space-y-3 border-l-4 border-l-emerald-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-success-text">
                <Target size={15} /> Punto de Equilibrio Mensual
              </h3>
              <span className="text-xs font-black">{costing.progresoEquilibrioPct}%</span>
            </div>

            <div className="w-full h-3 rounded-full theme-subtle overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${Math.min(100, costing.progresoEquilibrioPct)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="theme-subtle p-2.5 rounded-xl">
                <p className="text-[9px] uppercase font-bold theme-muted">Costos Fijos Mes</p>
                <p className="font-black">{fmt(costing.costosFijosMesCop)}</p>
              </div>
              <div className="theme-subtle p-2.5 rounded-xl">
                <p className="text-[9px] uppercase font-bold theme-muted">Margen Contrib. / Kg</p>
                <p className="font-black theme-success-text">
                  {fmt(costing.margenContribucionPromedioKgCop)}
                </p>
              </div>
              <div className="theme-subtle p-2.5 rounded-xl">
                <p className="text-[9px] uppercase font-bold theme-muted">Kilos Equilibrio / Mes</p>
                <p className="font-black theme-accent-text">
                  {costing.kilosTotalesEquilibrio !== null
                    ? `${costing.kilosTotalesEquilibrio} kg`
                    : 'Margen negativo'}
                </p>
              </div>
              <div className="theme-subtle p-2.5 rounded-xl">
                <p className="text-[9px] uppercase font-bold theme-muted">Vendido este Mes</p>
                <p className="font-black">
                  {costing.monthSoldKg} kg{' '}
                  {costing.kilosFaltantesEquilibrio !== null && (
                    <span className="text-[10px] theme-muted font-bold">
                      (Faltan {costing.kilosFaltantesEquilibrio} kg)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Rentabilidad Unificada por Presentación */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider theme-muted">
              Costos y Ganancia Unificados por Presentación
            </h3>
            {costing.itemsAnalysis.map((item) => (
              <div key={item.id} className="theme-card p-3.5 rounded-2xl space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-xs font-black">{item.name}</p>
                    <p className="text-[10px] theme-muted">
                      {item.grams}g · {item.packType === 'especial' ? 'Bolsa Especial' : 'Transparente'} · Venta{' '}
                      <strong>{fmt(item.priceCop)}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-full ${
                        item.gananciaNetaCop >= 0 ? 'theme-success-soft' : 'theme-danger-soft'
                      }`}
                    >
                      {item.margenNetoPct}% margen
                    </span>
                    <p
                      className={`text-xs font-black mt-1 ${
                        item.gananciaNetaCop >= 0 ? 'theme-success-text' : 'theme-danger-text'
                      }`}
                    >
                      {item.gananciaNetaCop >= 0 ? '+' : ''}
                      {fmt(item.gananciaNetaCop)} / ud
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-[10px] theme-subtle p-2 rounded-xl text-center">
                  <div>
                    <span className="block theme-muted">Directo</span>
                    <span className="font-black">{formatCOP(item.costoDirectoCop)}</span>
                  </div>
                  <div>
                    <span className="block theme-muted">Mano Obra</span>
                    <span className="font-black">{formatCOP(item.costoManoObraCop)}</span>
                  </div>
                  <div>
                    <span className="block theme-muted">Indirecto</span>
                    <span className="font-black">{formatCOP(item.costoIndirectoCop)}</span>
                  </div>
                  <div>
                    <span className="block theme-muted">Costo Total</span>
                    <span className="font-black theme-danger-text">{formatCOP(item.costoTotalCop)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] pt-1 border-t theme-border">
                  <span className="theme-muted">
                    Equilibrio solo este ítem:{' '}
                    <strong>
                      {item.unidadesEquilibrio !== null
                        ? `${item.unidadesEquilibrio} uds (${item.kilosEquilibrio} kg)`
                        : 'N/A'}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateCatalogPrice(item.id, item.precioSugeridoCop)}
                    className="theme-accent-soft px-2 py-0.5 rounded font-black"
                  >
                    Sugerido: {formatCOP(item.precioSugeridoCop)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          SUBTAB 3: ESTADÍSTICAS EMPRESARIALES
         ========================================================= */}
      {subTab === 'estadisticas' && (
        <div className="space-y-4">
          {/* Selector de Período */}
          <div className="flex theme-card p-1 rounded-xl gap-1">
            {[
              { id: '7D', label: 'Semanal' },
              { id: '30D', label: 'Mensual' },
              { id: '1A', label: 'Anual' },
              { id: 'HIST', label: 'Histórico' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setStatsRange(r.id)}
                className={`flex-1 py-2 text-[10px] font-black rounded-lg ${
                  statsRange === r.id ? 'theme-accent-bg' : 'theme-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Gráfico de Ventas */}
          <div className="theme-card p-4 rounded-2xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text">
              <BarChart3 size={15} /> Tendencia de Ventas ({displayCurrency})
            </h3>
            <div className="flex items-end justify-between h-28 gap-1 overflow-x-auto no-scrollbar pt-5 pb-1">
              {periodStats.chartData.map((d, i) => {
                const h = Math.round((d.totalCop / maxChartCop) * 100);
                const valText = displayCurrency === 'USD'
                  ? `$${copToUsd(d.totalCop, rates).toFixed(0)}`
                  : displayCurrency === 'BS'
                    ? `${Math.round(copToBs(d.totalCop, rates))}`
                    : `$${Math.round(d.totalCop / 1000)}k`;
                return (
                  <div key={i} className="flex flex-col items-center flex-1 min-w-[22px] relative group">
                    {d.totalCop > 0 && (
                      <span className="text-[8px] font-bold theme-muted opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 whitespace-nowrap">
                        {valText}
                      </span>
                    )}
                    <div className="w-full h-20 rounded-t theme-subtle flex items-end overflow-hidden">
                      <div
                        className="w-full theme-accent-bg rounded-t transition-all duration-500"
                        style={{ height: `${h}%`, minHeight: d.totalCop > 0 ? '4px' : '0px' }}
                      />
                    </div>
                    <span className="text-[8px] font-bold theme-muted mt-1 truncate max-w-full">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPIs del Período */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="theme-card p-3 rounded-xl">
              <p className="text-[10px] font-bold uppercase theme-muted">Total Vendido</p>
              <p className="text-sm font-black mt-0.5">{fmt(periodStats.soldCop)}</p>
              <p className="text-[10px] theme-success-text font-bold">
                Cobrado: {fmt(periodStats.collectedCop)}
              </p>
            </div>
            <div className="theme-card p-3 rounded-xl">
              <p className="text-[10px] font-bold uppercase theme-muted">Por Cobrar (Período)</p>
              <p className="text-sm font-black theme-danger-text mt-0.5">{fmt(periodStats.dueCop)}</p>
              <p className="text-[10px] theme-muted font-bold">
                Tostado: {formatWeightDual(periodStats.totalTostadoGrams)}
              </p>
            </div>
            <div className="theme-card p-3 rounded-xl">
              <p className="text-[10px] font-bold uppercase theme-muted">Bolsa Especial (c/Etiq.)</p>
              <p className="text-sm font-black theme-accent-text mt-0.5">
                {formatWeightDual(periodStats.especialGrams)}
              </p>
            </div>
            <div className="theme-card p-3 rounded-xl">
              <p className="text-[10px] font-bold uppercase theme-muted">Transparente / Granel</p>
              <p className="text-sm font-black mt-0.5">
                {formatWeightDual(periodStats.transparenteGrams)}
              </p>
              <p className="text-[10px] theme-muted font-bold">Merma prom: {periodStats.avgMerma}%</p>
            </div>
          </div>

          {/* Calidad por Productor */}
          <div className="theme-card p-4 rounded-2xl space-y-2.5">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider theme-accent-text">
                Calidad por Productor
              </h3>
              <button
                type="button"
                onClick={() => onExportCsv('productores_calidad')}
                className="theme-muted hover:text-amber-500 p-1"
              >
                <Download size={14} />
              </button>
            </div>
            {producerQuality.length === 0 ? (
              <p className="text-xs theme-muted">Sin lotes procesados aún.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {producerQuality.map((p) => (
                  <div
                    key={p.name}
                    className="theme-subtle p-2.5 rounded-xl flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-extrabold">{p.name}</p>
                      <p className="text-[10px] theme-muted">
                        {formatKg(p.inG)} → {formatKg(p.outG)} ({p.logsCount} lotes)
                      </p>
                    </div>
                    <span
                      className={`font-black ${
                        p.avgMerma > 22 ? 'theme-danger-text' : 'theme-success-text'
                      }`}
                    >
                      {p.avgMerma}% merma
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historial de Compras y Abonos por Cliente */}
          <div className="theme-card p-4 rounded-2xl space-y-2.5">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider theme-success-text flex items-center gap-1.5">
                <Users size={14} /> Historial Compras y Abonos x Cliente
              </h3>
              <button
                type="button"
                onClick={() => onExportCsv('clientes_resumen')}
                className="theme-muted hover:text-amber-500 p-1"
              >
                <Download size={14} />
              </button>
            </div>

            {clientHistories.length === 0 ? (
              <p className="text-xs theme-muted">Sin compras registradas aún.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {clientHistories.map((c) => {
                  const isOpen = expandedClientStatsKey === normalizeKey(c.name);
                  return (
                    <div key={c.name} className="theme-subtle p-2.5 rounded-xl space-y-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedClientStatsKey(isOpen ? null : normalizeKey(c.name))
                        }
                        className="w-full flex justify-between items-center text-left gap-2"
                      >
                        <div>
                          <p className="text-xs font-extrabold">{c.name}</p>
                          <p className="text-[10px] theme-muted">
                            {c.visits} compras · {formatWeightDual(c.totalGrams)} · Pagado {fmt(c.totalPaidCop)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black theme-success-text">
                            {fmt(c.totalBoughtCop)}
                          </p>
                          {c.debtCop > 0 && (
                            <p className="text-[10px] font-black theme-danger-text">
                              Debe: {fmt(c.debtCop)}
                            </p>
                          )}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="pt-2 border-t theme-border space-y-1 text-[10px]">
                          {c.clientSales.slice(0, 6).map((s) => (
                            <div key={s.id} className="flex justify-between theme-muted">
                              <span>
                                #{s.invoiceNum} {s.date} ({formatGrams(getSaleTotalGrams(s))})
                              </span>
                              <span className="font-bold">
                                {formatCOP(s.cop)} ({s.isPaid ? 'Pagado' : `Debe ${formatCOP(s.balanceDueCop)}`})
                              </span>
                            </div>
                          ))}
                          {c.allPayments.length > 0 && (
                            <div className="pt-1 border-t theme-border">
                              <p className="font-black uppercase theme-muted">Abonos:</p>
                              {c.allPayments.slice(0, 5).map((p) => (
                                <div key={p.id} className="flex justify-between theme-success-text">
                                  <span>
                                    {p.date} · {p.method}
                                  </span>
                                  <span className="font-bold">+{formatCOP(p.amountCop)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Exportar Reportes CSV */}
          <div className="theme-card p-4 rounded-2xl space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider theme-muted flex items-center gap-1.5">
              <Database size={14} /> Reportes Completos (CSV / Excel)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'ventas', label: 'VENTAS.csv' },
                { key: 'compras', label: 'COMPRAS.csv' },
                { key: 'gastos', label: 'GASTOS.csv' },
                { key: 'procesos', label: 'PROCESOS.csv' },
                { key: 'clientes', label: 'CLIENTES.csv' },
                { key: 'productores', label: 'PRODUCTORES.csv' },
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => onExportCsv(btn.key)}
                  className="theme-subtle py-2.5 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5"
                >
                  <Download size={12} /> {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
