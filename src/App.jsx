import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Coffee,
  Database,
  DollarSign,
  Factory,
  Moon,
  Settings,
  ShoppingCart,
  Sun,
  Wallet,
  X,
} from 'lucide-react';
import BalanceTab from './components/BalanceTab.jsx';
import ComprasTab from './components/ComprasTab.jsx';
import FabricaTab from './components/FabricaTab.jsx';
import {
  EditProcessModal,
  EditSaleModal,
  PaymentModal,
  ReceiptModal,
} from './components/Modals.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import VentasTab from './components/VentasTab.jsx';
import { useViewportAndScroll } from './hooks/useViewportAndScroll.js';
import { computeCostingAnalysis } from './utils/costing.js';
import { getSaleTotalGrams, recomputeInventoryGrams, toGrams } from './utils/grams.js';
import {
  applyClientPayment,
  applySaleSuppliesDelta,
  applySingleSalePayment,
  createSaleRecord,
  getClientHistorySummary,
  normalizeKey,
  recalculateEditedSale,
} from './utils/ledger.js';
import {
  addDaysISO,
  copToBs,
  copToUsd,
  formatDateDisplay,
  getCurrentMonthKey,
  getCurrentTimeDisplay,
  getTodayISO,
  roundCop,
} from './utils/money.js';
import {
  buildCsvContent,
  exportTextFileNativeOrWeb,
  getLegacyRawString,
  importBackupObject,
  loadInitialState,
  normalizeClients,
  normalizeProducers,
  saveV8State,
} from './utils/storage.js';

const CURRENCIES = ['COP', 'USD', 'BS'];

export default function App() {
  const [boot] = useState(() => loadInitialState());
  const [appState, setAppState] = useState(boot.state);
  const [migrationBanner, setMigrationBanner] = useState(boot.migrationNotice);
  const [activeTab, setActiveTab] = useState('ventas');
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState('');

  // Modales
  const [receiptModal, setReceiptModal] = useState({ isOpen: false, sale: null, statement: null });
  const [paymentModal, setPaymentModal] = useState({ isOpen: false });
  const [editingSale, setEditingSale] = useState(null);
  const [editingLog, setEditingLog] = useState(null);

  const {
    isKeyboardOpen,
    isBottomSheetMinimized,
    setIsBottomSheetMinimized,
    handleMainScroll,
  } = useViewportAndScroll();

  // Aplicar tema claro cálido / modo oscuro
  useEffect(() => {
    const theme = appState.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#09090b' : '#D97706');
    }
  }, [appState.theme]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35);
    }
    import('@capacitor/toast')
      .then(({ Toast }) => Toast.show({ text: msg, duration: 'short' }))
      .catch(() => {});
    setTimeout(() => {
      setToast((curr) => (curr === msg ? '' : curr));
    }, 3200);
  }, []);

  const updateState = useCallback(
    (updater) => {
      setIsSyncing(true);
      setAppState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        const saved = saveV8State(next);
        if (!saved) {
          showToast('⚠️ Memoria llena — exporta un respaldo');
        }
        return next;
      });
      setTimeout(() => setIsSyncing(false), 260);
    },
    [showToast]
  );

  const costing = useMemo(
    () =>
      computeCostingAnalysis(appState.costConfig, appState.catalog, {
        purchases: appState.purchases,
        sales: appState.sales,
        expenses: appState.expenses,
        processHistory: appState.processHistory,
        monthKey: getCurrentMonthKey(),
      }),
    [
      appState.costConfig,
      appState.catalog,
      appState.purchases,
      appState.sales,
      appState.expenses,
      appState.processHistory,
    ]
  );

  // ============================================================
  //  ACCIONES: VENTAS & PEDIDOS
  // ============================================================
  const handleRegisterSale = ({
    dateISO,
    clientName,
    items,
    method,
    isCredit,
    isDonation,
    paidNowCop,
    excessToDebtCop,
    previousDebtCop,
    activeOrder,
  }) => {
    const iso = dateISO || getTodayISO();
    const dateStr = formatDateDisplay(iso);
    const timeStr = getCurrentTimeDisplay();

    updateState((prev) => {
      const sale = createSaleRecord({
        id: Date.now(),
        invoiceCounter: prev.invoiceCounter,
        clientName,
        items,
        method,
        paidNowCop,
        excessToDebtCop,
        isCredit,
        isDonation,
        date: dateStr,
        isoDate: iso,
        time: timeStr,
        rates: prev.rates,
        previousDebtCop,
      });

      let nextSales = [sale, ...prev.sales];
      if (!isDonation && excessToDebtCop > 0) {
        const applied = applyClientPayment(
          nextSales,
          clientName,
          excessToDebtCop,
          method,
          dateStr,
          iso
        );
        nextSales = applied.updatedSales;
      }

      const nextInventory = {
        ...prev.inventoryGrams,
        tostado: Math.max(0, (prev.inventoryGrams?.tostado || 0) - sale.totalGrams),
      };
      const nextSupplies = applySaleSuppliesDelta(prev.supplies, sale.items, -1);

      let nextOrders = prev.orders;
      if (activeOrder) {
        nextOrders = prev.orders.filter((o) => o.id !== activeOrder.id);
        if (activeOrder.isRecurring) {
          const nextIso = addDaysISO(activeOrder.isoDate || iso, 7);
          nextOrders = [
            {
              ...activeOrder,
              id: Date.now() + 2,
              isoDate: nextIso,
              date: formatDateDisplay(nextIso),
            },
            ...nextOrders,
          ];
        }
      }

      const umbral = nextSupplies.alerta_umbral ?? 10;
      if (
        nextSupplies.bolsas_especiales <= umbral ||
        nextSupplies.bolsas_transparentes <= umbral ||
        nextSupplies.etiquetas <= umbral
      ) {
        setTimeout(() => showToast('⚠️ ¡Insumos (bolsas o etiquetas) por agotarse!'), 300);
      }

      return {
        ...prev,
        sales: nextSales,
        inventoryGrams: nextInventory,
        supplies: nextSupplies,
        orders: nextOrders,
        invoiceCounter: prev.invoiceCounter + 1,
      };
    });

    showToast('✅ Venta registrada en V8.0');
  };

  const handleDeleteSale = (saleId) => {
    updateState((prev) => {
      const target = prev.sales.find((s) => s.id === saleId);
      if (!target) return prev;
      const returnedGrams = getSaleTotalGrams(target);
      const nextInventory = {
        ...prev.inventoryGrams,
        tostado: Math.max(0, (prev.inventoryGrams?.tostado || 0) + returnedGrams),
      };
      const nextSupplies = applySaleSuppliesDelta(prev.supplies, target.items || [], +1);
      return {
        ...prev,
        sales: prev.sales.filter((s) => s.id !== saleId),
        inventoryGrams: nextInventory,
        supplies: nextSupplies,
      };
    });
    showToast('Venta eliminada y gramos/insumos devueltos');
  };

  const handleSaveEditedSale = (editedDraft) => {
    updateState((prev) => {
      const oldSale = prev.sales.find((s) => s.id === editedDraft.id);
      if (!oldSale) return prev;
      const { sale, gramsDelta, oldItems, newItems } = recalculateEditedSale(
        oldSale,
        editedDraft,
        prev.rates
      );
      const revertedSupplies = applySaleSuppliesDelta(prev.supplies, oldItems, +1);
      const nextSupplies = applySaleSuppliesDelta(revertedSupplies, newItems, -1);
      const nextInventory = {
        ...prev.inventoryGrams,
        tostado: Math.max(0, (prev.inventoryGrams?.tostado || 0) - gramsDelta),
      };
      return {
        ...prev,
        sales: prev.sales.map((s) => (s.id === sale.id ? sale : s)),
        inventoryGrams: nextInventory,
        supplies: nextSupplies,
      };
    });
    setEditingSale(null);
    showToast('✅ Venta actualizada');
  };

  const handleCreateOrder = (orderPayload) => {
    const iso = orderPayload.isoDate || getTodayISO();
    const newOrder = {
      id: Date.now(),
      ...orderPayload,
      isoDate: iso,
      date: formatDateDisplay(iso),
      status: 'pending',
    };
    updateState((prev) => ({ ...prev, orders: [newOrder, ...prev.orders] }));
    showToast('📅 Pedido agendado');
  };

  const handleDeleteOrder = (orderId) => {
    updateState((prev) => ({
      ...prev,
      orders: prev.orders.filter((o) => o.id !== orderId),
    }));
    showToast('Pedido eliminado');
  };

  // ============================================================
  //  ACCIONES: COMPRAS & OPEX
  // ============================================================
  const handleAddPurchase = ({ isoDate, coffeeType, producer, grams, pricePerKgCop, cop, method, isCredit }) => {
    updateState((prev) => {
      const paidAmountCop = isCredit ? 0 : cop;
      const balanceDueCop = isCredit ? cop : 0;
      const newPurchase = {
        id: Date.now(),
        type: 'Materia Prima',
        coffeeType,
        producer,
        grams,
        pricePerKgCop,
        cop,
        usd: copToUsd(cop, prev.rates),
        bs: copToBs(cop, prev.rates),
        method: isCredit ? 'Crédito' : method,
        isPaid: !isCredit,
        paidAmountCop,
        balanceDueCop,
        payments: !isCredit && cop > 0
          ? [{ id: Date.now() + 1, date: formatDateDisplay(isoDate), isoDate, amountCop: cop, method }]
          : [],
        date: formatDateDisplay(isoDate),
        isoDate,
      };

      const nextInv = { ...prev.inventoryGrams };
      if (coffeeType === 'Pergamino') nextInv.pergamino = (nextInv.pergamino || 0) + grams;
      if (coffeeType === 'Azul') nextInv.azul = (nextInv.azul || 0) + grams;

      return {
        ...prev,
        purchases: [newPurchase, ...prev.purchases],
        inventoryGrams: nextInv,
      };
    });
    showToast('✅ Materia prima sumada en gramos');
  };

  const handleDeletePurchase = (id) => {
    updateState((prev) => {
      const target = prev.purchases.find((p) => p.id === id);
      if (!target) return prev;
      const g = Number.isFinite(Number(target.grams)) ? target.grams : toGrams(target.kg, 'kg');
      const nextInv = { ...prev.inventoryGrams };
      if (target.coffeeType === 'Pergamino') nextInv.pergamino = Math.max(0, (nextInv.pergamino || 0) - g);
      if (target.coffeeType === 'Azul') nextInv.azul = Math.max(0, (nextInv.azul || 0) - g);
      return {
        ...prev,
        purchases: prev.purchases.filter((p) => p.id !== id),
        inventoryGrams: nextInv,
      };
    });
    showToast('Compra eliminada e inventario revertido');
  };

  const handleAddExpense = ({ isoDate, category, isFixed, description, originalAmount, originalCurrency, cop, method }) => {
    updateState((prev) => {
      const newExp = {
        id: Date.now(),
        category,
        isFixed: Boolean(isFixed),
        description,
        originalAmount,
        originalCurrency,
        cop,
        usd: copToUsd(cop, prev.rates),
        bs: copToBs(cop, prev.rates),
        method,
        date: formatDateDisplay(isoDate),
        isoDate,
      };
      return { ...prev, expenses: [newExp, ...prev.expenses] };
    });
    showToast('✅ Gasto operativo registrado');
  };

  const handleDeleteExpense = (id) => {
    updateState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
    showToast('Gasto eliminado');
  };

  // ============================================================
  //  ACCIONES: FÁBRICA (TRILLA & TUESTE)
  // ============================================================
  const handleCompleteProcess = ({
    type,
    producer,
    inputGrams,
    outputGrams,
    mermaPct,
    gasCostCop,
    estimatedProfitCop,
    isoDate,
  }) => {
    updateState((prev) => {
      const nextInv = { ...prev.inventoryGrams };
      if (type === 'trilla') {
        nextInv.pergamino = Math.max(0, (nextInv.pergamino || 0) - inputGrams);
        nextInv.azul = (nextInv.azul || 0) + outputGrams;
      } else {
        nextInv.azul = Math.max(0, (nextInv.azul || 0) - inputGrams);
        nextInv.tostado = (nextInv.tostado || 0) + outputGrams;
      }

      const log = {
        id: Date.now(),
        type,
        producer,
        inputGrams,
        outputGrams,
        mermaPct,
        gasCostCop,
        estimatedProfitCop,
        date: formatDateDisplay(isoDate),
        isoDate,
      };

      return {
        ...prev,
        inventoryGrams: nextInv,
        processHistory: [log, ...prev.processHistory],
      };
    });
    showToast('✅ Lote procesado y sumado al inventario');
  };

  const handleSaveActiveProcess = ({ type, producer, inputGrams, isoDate }) => {
    updateState((prev) => {
      const nextInv = { ...prev.inventoryGrams };
      if (type === 'trilla') nextInv.pergamino = Math.max(0, (nextInv.pergamino || 0) - inputGrams);
      else nextInv.azul = Math.max(0, (nextInv.azul || 0) - inputGrams);

      const active = {
        id: Date.now(),
        type,
        producer,
        inputGrams,
        date: formatDateDisplay(isoDate),
        isoDate,
      };
      return {
        ...prev,
        inventoryGrams: nextInv,
        activeProcesses: [active, ...prev.activeProcesses],
      };
    });
    showToast('⏳ Lote en curso guardado');
  };

  const handleResumeActiveProcess = (activeId) => {
    const target = appState.activeProcesses.find((a) => a.id === activeId);
    if (!target) return null;
    updateState((prev) => {
      const nextInv = { ...prev.inventoryGrams };
      if (target.type === 'trilla') nextInv.pergamino = (nextInv.pergamino || 0) + target.inputGrams;
      else nextInv.azul = (nextInv.azul || 0) + target.inputGrams;
      return {
        ...prev,
        inventoryGrams: nextInv,
        activeProcesses: prev.activeProcesses.filter((a) => a.id !== activeId),
      };
    });
    return target;
  };

  const handleCancelActiveProcess = (activeId) => {
    handleResumeActiveProcess(activeId);
    showToast('Lote en curso cancelado y gramos devueltos');
  };

  const handleSaveEditedLog = (updatedLog) => {
    updateState((prev) => {
      const oldLog = prev.processHistory.find((l) => l.id === updatedLog.id);
      if (!oldLog) return prev;
      const nextInv = { ...prev.inventoryGrams };
      const oldIn = Number(oldLog.inputGrams) || 0;
      const oldOut = Number(oldLog.outputGrams) || 0;
      const newIn = Number(updatedLog.inputGrams) || 0;
      const newOut = Number(updatedLog.outputGrams) || 0;

      if (oldLog.type === 'trilla') {
        nextInv.pergamino = Math.max(0, (nextInv.pergamino || 0) + oldIn - newIn);
        nextInv.azul = Math.max(0, (nextInv.azul || 0) - oldOut + newOut);
      } else {
        nextInv.azul = Math.max(0, (nextInv.azul || 0) + oldIn - newIn);
        nextInv.tostado = Math.max(0, (nextInv.tostado || 0) - oldOut + newOut);
      }

      return {
        ...prev,
        inventoryGrams: nextInv,
        processHistory: prev.processHistory.map((l) => (l.id === updatedLog.id ? updatedLog : l)),
      };
    });
    setEditingLog(null);
    showToast('✅ Lote actualizado');
  };

  const handleDeleteLog = (logId) => {
    updateState((prev) => {
      const target = prev.processHistory.find((l) => l.id === logId);
      if (!target) return prev;
      const nextInv = { ...prev.inventoryGrams };
      if (target.type === 'trilla') {
        nextInv.pergamino = (nextInv.pergamino || 0) + (target.inputGrams || 0);
        nextInv.azul = Math.max(0, (nextInv.azul || 0) - (target.outputGrams || 0));
      } else {
        nextInv.azul = (nextInv.azul || 0) + (target.inputGrams || 0);
        nextInv.tostado = Math.max(0, (nextInv.tostado || 0) - (target.outputGrams || 0));
      }
      return {
        ...prev,
        inventoryGrams: nextInv,
        processHistory: prev.processHistory.filter((l) => l.id !== logId),
      };
    });
    showToast('Proceso revertido y eliminado');
  };

  // ============================================================
  //  ACCIONES: ABONOS, EXPORTACIÓN Y DIRECTORIOS
  // ============================================================
  const handleConfirmPayment = ({ mode, clientName, sale, purchase, amountCop, method, isoDate }) => {
    const pay = roundCop(amountCop);
    if (pay <= 0) {
      showToast('⚠️ Ingresa un monto válido');
      return;
    }
    const dateStr = formatDateDisplay(isoDate);

    if (mode === 'client_fifo') {
      updateState((prev) => {
        const res = applyClientPayment(prev.sales, clientName, pay, method, dateStr, isoDate);
        return { ...prev, sales: res.updatedSales };
      });
      showToast('✅ Abono aplicado a cuenta acumulada');
    } else if (mode === 'cxc_single' && sale) {
      updateState((prev) => ({
        ...prev,
        sales: applySingleSalePayment(prev.sales, sale.id, pay, method, dateStr, isoDate),
      }));
      showToast('✅ Abono registrado');
    } else if (mode === 'cxp_single' && purchase) {
      updateState((prev) => ({
        ...prev,
        purchases: prev.purchases.map((p) => {
          if (p.id !== purchase.id) return p;
          const total = roundCop(p.cop);
          const currentPaid = roundCop(p.paidAmountCop);
          const slice = Math.min(Math.max(0, total - currentPaid), pay);
          const newPaid = currentPaid + slice;
          const newBalance = Math.max(0, total - newPaid);
          return {
            ...p,
            paidAmountCop: newPaid,
            balanceDueCop: newBalance,
            isPaid: newBalance === 0,
            payments: [
              ...(Array.isArray(p.payments) ? p.payments : []),
              { id: Date.now(), date: dateStr, isoDate, amountCop: slice, method },
            ],
          };
        }),
      }));
      showToast('✅ Pago a productor registrado');
    }

    setPaymentModal({ isOpen: false });
  };

  const handleExportCsv = async (type) => {
    let rows = [];
    let fileName = `Colados_${type}_${getTodayISO()}.csv`;

    if (type === 'ventas') {
      rows = appState.sales.map((s) => ({
        Recibo: s.invoiceNum,
        Fecha: s.date,
        Cliente: s.clientName,
        Detalle: (s.items || []).map((i) => `${i.quantity}x ${i.name}`).join(' + '),
        Gramos: getSaleTotalGrams(s),
        TotalCOP: s.cop,
        PagadoCOP: s.paidAmountCop,
        PendienteCOP: s.balanceDueCop,
        Metodo: s.method,
      }));
    } else if (type === 'compras') {
      rows = appState.purchases.map((p) => ({
        Fecha: p.date,
        Productor: p.producer,
        Cafe: p.coffeeType,
        Gramos: p.grams,
        PrecioKgCOP: p.pricePerKgCop,
        TotalCOP: p.cop,
        Metodo: p.method,
        PendienteCOP: p.balanceDueCop,
      }));
    } else if (type === 'gastos') {
      rows = appState.expenses.map((e) => ({
        Fecha: e.date,
        Categoria: e.category,
        Tipo: e.isFixed ? 'Fijo/Indirecto' : 'Directo/Variable',
        Detalle: e.description,
        MontoOriginal: `${e.originalAmount} ${e.originalCurrency}`,
        TotalCOP: e.cop,
        Metodo: e.method,
      }));
    } else if (type === 'procesos') {
      rows = appState.processHistory.map((l) => ({
        Fecha: l.date,
        Tipo: l.type,
        Productor: l.producer,
        EntradaGramos: l.inputGrams,
        SalidaGramos: l.outputGrams,
        MermaPct: l.mermaPct,
      }));
    } else if (type === 'clientes') {
      rows = appState.clients.map((c) => ({
        Nombre: c.fullName,
        Negocio: c.business,
        Sector: c.sector,
        Telefono: c.phone,
      }));
    } else if (type === 'productores') {
      rows = appState.producers.map((p) => ({
        Nombre: p.name,
        Finca: p.finca,
        Sector: p.sector,
        Telefono: p.phone,
      }));
    } else if (type === 'clientes_resumen') {
      rows = appState.clients.map((c) => {
        const sum = getClientHistorySummary(appState.sales, c.fullName);
        return {
          Cliente: c.fullName,
          Visitas: sum.visits,
          Gramos: sum.totalGrams,
          TotalCompradoCOP: sum.totalBoughtCop,
          TotalPagadoCOP: sum.totalPaidCop,
          SaldoPendienteCOP: sum.debtCop,
        };
      });
    } else if (type === 'productores_calidad') {
      rows = appState.producers.map((p) => {
        const logs = appState.processHistory.filter(
          (l) => normalizeKey(l.producer) === normalizeKey(p.name)
        );
        const inG = logs.reduce((a, b) => a + (b.inputGrams || 0), 0);
        const outG = logs.reduce((a, b) => a + (b.outputGrams || 0), 0);
        const avgMerma = inG > 0 ? Math.round(((inG - outG) / inG) * 1000) / 10 : 0;
        return { Productor: p.name, EntradaGramos: inG, SalidaGramos: outG, MermaPct: `${avgMerma}%` };
      });
    }

    if (!rows.length) {
      showToast('No hay registros para exportar');
      return;
    }

    try {
      const csv = buildCsvContent(rows);
      const res = await exportTextFileNativeOrWeb(csv, fileName, 'text/csv;charset=utf-8;');
      showToast(res.native ? `CSV guardado en Documentos: ${fileName}` : `CSV descargado: ${fileName}`);
    } catch {
      showToast('Error exportando CSV');
    }
  };

  const handleExportV8 = async () => {
    const fileName = `Colados_V8_Respaldo_${getTodayISO()}.json`;
    try {
      const res = await exportTextFileNativeOrWeb(
        JSON.stringify(appState, null, 2),
        fileName,
        'application/json'
      );
      showToast(res.native ? `Guardado en Documentos: ${fileName}` : 'Respaldo V8.0 descargado');
    } catch {
      showToast('Error exportando respaldo');
    }
  };

  const handleExportLegacy = async () => {
    const raw = getLegacyRawString();
    if (!raw) {
      showToast('No hay respaldo histórico v6/v7');
      return;
    }
    const fileName = `Colados_Historico_v6_${getTodayISO()}.json`;
    try {
      const res = await exportTextFileNativeOrWeb(raw, fileName, 'application/json');
      showToast(res.native ? `Histórico guardado en Documentos: ${fileName}` : 'Histórico descargado');
    } catch {
      showToast('Error exportando histórico');
    }
  };

  const handleImportJson = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const res = importBackupObject(parsed, appState);
        updateState(res.state);
        if (res.mode === 'v8_full') {
          showToast('✅ Respaldo V8.0 restaurado completo');
        } else {
          showToast(
            `✅ Directorio importado: +${res.addedClients} clientes, +${res.addedProducers} productores`
          );
        }
      } catch {
        showToast('⚠️ Archivo JSON inválido');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const cycleDisplayCurrency = () => {
    const idx = CURRENCIES.indexOf(appState.displayCurrency || 'COP');
    const next = CURRENCIES[(idx + 1) % CURRENCIES.length];
    updateState((prev) => ({ ...prev, displayCurrency: next }));
  };

  const currencyLabel =
    appState.displayCurrency === 'USD'
      ? '🇺🇸 USD'
      : appState.displayCurrency === 'BS'
        ? '🇻🇪 BS'
        : '🇨🇴 COP';

  return (
    <div className="min-h-screen theme-app font-sans flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col relative border-x theme-border shadow-2xl">
        {/* HEADER */}
        <header className="theme-card border-b theme-border px-4 py-3 flex justify-between items-center z-20 sticky top-0 rounded-none">
          <div className="flex items-center gap-2.5">
            <div className="theme-accent-bg p-2 rounded-xl shadow relative">
              {isSyncing && <Database size={11} className="absolute -top-1 -right-1 animate-pulse" />}
              <Coffee size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-widest leading-none">COLADOS</h1>
              <p className="text-[9px] theme-muted font-bold tracking-wider mt-0.5">
                V8.0 · GRAMOS & COSTOS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                updateState((prev) => ({
                  ...prev,
                  theme: prev.theme === 'dark' ? 'light' : 'dark',
                }))
              }
              className="theme-subtle p-2 rounded-full"
              title="Cambiar tema Claro / Oscuro"
            >
              {appState.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={cycleDisplayCurrency}
              className="theme-accent-soft px-2.5 py-1.5 rounded-xl text-[10px] font-black"
              title="Cambiar moneda de visualización"
            >
              {currencyLabel}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="theme-subtle p-2 rounded-full"
              title="Configuración"
            >
              <Settings size={17} />
            </button>
          </div>
        </header>

        {/* Banner de migración V6 -> V8 (solo Clientes y Productores) */}
        {migrationBanner && (
          <div className="theme-info-soft px-4 py-2.5 text-[11px] font-bold flex justify-between items-center gap-2 border-b theme-border">
            <span>{migrationBanner}</span>
            <button
              type="button"
              onClick={() => setMigrationBanner(null)}
              className="p-1 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Alerta de pedidos pendientes */}
        {appState.orders.length > 0 && activeTab !== 'ventas' && (
          <button
            type="button"
            onClick={() => setActiveTab('ventas')}
            className="theme-accent-bg px-4 py-2 text-[10px] font-black uppercase tracking-widest flex justify-between items-center"
          >
            <span className="flex items-center gap-1.5">
              <Bell size={13} className="animate-bounce" />
              ¡{appState.orders.length} pedido{appState.orders.length > 1 ? 's' : ''} pendiente{appState.orders.length > 1 ? 's' : ''}!
            </span>
            <span className="underline">Ir a Ventas →</span>
          </button>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main
          onScroll={handleMainScroll}
          className="flex-1 overflow-y-auto scroll-smooth-android"
        >
          {activeTab === 'ventas' && (
            <VentasTab
              state={appState}
              onUpdateRates={(rates) => updateState((prev) => ({ ...prev, rates }))}
              onRegisterSale={handleRegisterSale}
              onCreateOrder={handleCreateOrder}
              onDeleteOrder={handleDeleteOrder}
              isKeyboardOpen={isKeyboardOpen}
              isBottomSheetMinimized={isBottomSheetMinimized}
              onToggleBottomSheet={() => setIsBottomSheetMinimized((v) => !v)}
              onNotify={showToast}
            />
          )}

          {activeTab === 'compras' && (
            <ComprasTab
              state={appState}
              onAddPurchase={handleAddPurchase}
              onDeletePurchase={handleDeletePurchase}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onNotify={showToast}
            />
          )}

          {activeTab === 'fabrica' && (
            <FabricaTab
              state={appState}
              onCompleteProcess={handleCompleteProcess}
              onSaveActiveProcess={handleSaveActiveProcess}
              onResumeActiveProcess={handleResumeActiveProcess}
              onCancelActiveProcess={handleCancelActiveProcess}
              onEditLog={setEditingLog}
              onDeleteLog={handleDeleteLog}
              onNotify={showToast}
            />
          )}

          {activeTab === 'balance' && (
            <BalanceTab
              state={appState}
              costing={costing}
              onOpenReceipt={({ sale = null, statement = null }) =>
                setReceiptModal({ isOpen: true, sale, statement })
              }
              onOpenPayment={(payload) => setPaymentModal({ isOpen: true, ...payload })}
              onEditSale={setEditingSale}
              onDeleteSale={handleDeleteSale}
              onPayPurchase={(p) =>
                setPaymentModal({
                  isOpen: true,
                  mode: 'cxp_single',
                  purchase: p,
                  maxCop: roundCop(p.balanceDueCop ?? p.cop),
                  initialAmountCop: roundCop(p.balanceDueCop ?? p.cop),
                })
              }
              onUpdateCostConfig={(patch) =>
                updateState((prev) => ({
                  ...prev,
                  costConfig: { ...prev.costConfig, ...patch },
                }))
              }
              onUpdateCatalogPrice={(itemId, suggestedPriceCop) => {
                updateState((prev) => ({
                  ...prev,
                  catalog: prev.catalog.map((c) =>
                    c.id === itemId ? { ...c, priceCop: suggestedPriceCop } : c
                  ),
                }));
                showToast('✅ Precio de catálogo actualizado');
              }}
              onExportCsv={handleExportCsv}
            />
          )}
        </main>

        {/* NAVEGACIÓN INFERIOR (se oculta al abrir teclado móvil para no estorbar) */}
        {!isKeyboardOpen && (
          <nav className="theme-nav flex justify-around px-2 pt-1.5 pb-safe fixed bottom-0 w-full max-w-md z-30">
            {[
              { tab: 'ventas', icon: <DollarSign size={20} strokeWidth={2.5} />, label: 'Ventas' },
              { tab: 'compras', icon: <ShoppingCart size={20} strokeWidth={2.5} />, label: 'Compras' },
              { tab: 'fabrica', icon: <Factory size={20} strokeWidth={2.5} />, label: 'Proceso' },
              { tab: 'balance', icon: <Wallet size={20} strokeWidth={2.5} />, label: 'Balance' },
            ].map(({ tab, icon, label }) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-col items-center gap-0.5 w-16 transition-all ${
                    active ? 'theme-accent-text -translate-y-0.5' : 'theme-muted'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl ${active ? 'theme-accent-soft border-0' : ''}`}>
                    {icon}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* TOAST */}
        {toast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 theme-card border-2 border-amber-500 px-4 py-2 rounded-full shadow-xl z-50 text-xs font-extrabold text-center max-w-xs animate-in slide-in-from-top">
            {toast}
          </div>
        )}

        {/* MODALES */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          state={appState}
          hasLegacyData={boot.hasLegacyData}
          onSetTheme={(theme) => updateState((prev) => ({ ...prev, theme }))}
          onUpdateCatalogItem={(id, patch) => {
            updateState((prev) => ({
              ...prev,
              catalog: prev.catalog.map((c) => (c.id === id ? { ...c, ...patch } : c)),
            }));
            showToast('✅ Presentación actualizada');
          }}
          onAddCatalogItem={(item) => {
            updateState((prev) => ({
              ...prev,
              catalog: [...prev.catalog, { id: Date.now(), ...item }],
            }));
            showToast('✅ Presentación agregada');
          }}
          onDeleteCatalogItem={(id) => {
            updateState((prev) => ({
              ...prev,
              catalog: prev.catalog.filter((c) => c.id !== id),
            }));
            showToast('Presentación eliminada');
          }}
          onUpdateSupplies={(supplies) => updateState((prev) => ({ ...prev, supplies }))}
          onUpdateOpeningInventory={(openingInventoryGrams) => {
            updateState((prev) => ({
              ...prev,
              openingInventoryGrams,
              inventoryGrams: recomputeInventoryGrams({
                openingInventoryGrams,
                purchases: prev.purchases,
                processHistory: prev.processHistory,
                activeProcesses: prev.activeProcesses,
                sales: prev.sales,
              }),
            }));
          }}
          onRecalculateInventory={() => {
            updateState((prev) => ({
              ...prev,
              inventoryGrams: recomputeInventoryGrams(prev),
            }));
            showToast('✅ Inventario recalculado en gramos exactos');
          }}
          onSaveClient={(draft) => {
            updateState((prev) => {
              const list = draft.id
                ? prev.clients.map((c) => (c.id === draft.id ? { ...c, ...draft } : c))
                : [{ id: Date.now(), ...draft }, ...prev.clients];
              return { ...prev, clients: normalizeClients(list) };
            });
            showToast(draft.id ? '✅ Cliente actualizado' : '✅ Cliente registrado');
          }}
          onDeleteClient={(id) => {
            updateState((prev) => ({
              ...prev,
              clients: prev.clients.filter((c) => c.id !== id),
            }));
            showToast('Cliente eliminado');
          }}
          onSaveProducer={(draft) => {
            updateState((prev) => {
              const list = draft.id
                ? prev.producers.map((p) => (p.id === draft.id ? { ...p, ...draft } : p))
                : [{ id: Date.now(), ...draft }, ...prev.producers];
              return { ...prev, producers: normalizeProducers(list) };
            });
            showToast(draft.id ? '✅ Productor actualizado' : '✅ Productor registrado');
          }}
          onDeleteProducer={(id) => {
            updateState((prev) => ({
              ...prev,
              producers: prev.producers.filter((p) => p.id !== id),
            }));
            showToast('Productor eliminado');
          }}
          onExportV8={handleExportV8}
          onExportLegacy={handleExportLegacy}
          onImportJson={handleImportJson}
        />

        <ReceiptModal
          modal={receiptModal}
          sales={appState.sales}
          rates={appState.rates}
          onClose={() => setReceiptModal({ isOpen: false, sale: null, statement: null })}
          onNotify={showToast}
        />

        <PaymentModal
          modal={paymentModal}
          rates={appState.rates}
          onClose={() => setPaymentModal({ isOpen: false })}
          onConfirm={handleConfirmPayment}
        />

        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSave={handleSaveEditedSale}
        />

        <EditProcessModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSave={handleSaveEditedLog}
        />
      </div>
    </div>
  );
}
