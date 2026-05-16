import React, { useState, useEffect, useCallback } from 'react';
import {
  Coffee, DollarSign, Plus, List, TrendingUp, Trash2,
  Wallet, PieChart, Package, ArrowRightLeft, CreditCard, Banknote,
  AlertTriangle, BookOpen, Flame, UserCheck, CheckCircle, Edit3, Save, Factory,
  Download, MinusCircle, Settings, Share2, ShoppingCart, X, Calendar,
  BarChart3, Target, Clock, Flag, Bell, ClipboardList, CheckSquare, Database
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Toast as NativeToast } from '@capacitor/toast';

import { logoBase64 } from './assets/logoBase64';

const round2 = (n) => Math.round(n * 100) / 100;

export default function App() {
  const [activeTab, setActiveTab] = useState('ventas');
  const [showSettings, setShowSettings] = useState(false);

  // --- TASAS Y MONEDAS ---
  // Base principal: COP (Pesos Colombianos)
  const [rates, setRates] = useState({ 
    usd_cop: 4100,  // Cuantos COP por 1 USD
    usd_bs: 45.50,  // Cuantos BS por 1 USD (Paralelo)
    cop_bs: 0.011,  // Cuantos BS por 1 COP (Calculado o manual)
  });

  // --- INVENTARIO & INSUMOS ---
  const [inventory, setInventory] = useState({ pergamino: 0, azul: 0, tostado: 0 });
  const [supplies, setSupplies] = useState({ 
    bolsas_kraft: 0, 
    bolsas_granel: 0,
    etiquetas: 0,
    alerta_umbral: 10 
  });
  const [donations, setDonations] = useState([]);
  const [invoiceCounter, setInvoiceCounter] = useState(1);

  // --- CATÁLOGO ---
  const [catalog, setCatalog] = useState([
    { id: 1, name: '1 Kg (Granel)',    price: 40000, deductKg: 1.0,  bagType: 'bolsas_granel' },
    { id: 2, name: '500g (Granel)',    price: 20000, deductKg: 0.5,  bagType: 'bolsas_granel' },
    { id: 3, name: '250g (Granel)',    price: 10000, deductKg: 0.25, bagType: 'bolsas_granel' },
    { id: 4, name: '400g (Empacado)',  price: 25000, deductKg: 0.4,  bagType: 'bolsas_kraft' },
    { id: 5, name: '200g (Empacado)',  price: 15000, deductKg: 0.2,  bagType: 'bolsas_kraft' },
  ]);

  // --- DIRECTORIO ---
  const [clients,   setClients]   = useState([]);
  const [producers, setProducers] = useState([]);

  // --- HISTORIALES ---
  const [sales,          setSales]          = useState([]);
  const [purchases,      setPurchases]      = useState([]);
  const [expenses,       setExpenses]       = useState([]);
  const [processHistory, setProcessHistory] = useState([]);
  const [orders,         setOrders]         = useState([]);

  // --- PAGINACIÓN ---
  const [visibleSales, setVisibleSales] = useState(10);

  // --- UI TABS ---
  const getLocalTime = () => {
    const now = new Date();
    // Offset para Venezuela/Colombia (UTC-4 / UTC-5)
    // Para asegurar precisión usamos el offset manual de -4 horas para Vzla
    const vzlaOffset = -4 * 60; // en minutos
    const localTime = new Date(now.getTime() + (vzlaOffset + now.getTimezoneOffset()) * 60000);
    return localTime;
  };
  
  const todayISO = getLocalTime().toISOString().split('T')[0];
  const [vTab,         setVTab]         = useState('venta');
  const [activeOrderId,setActiveOrderId]= useState(null);
  const [orderDate,    setOrderDate]    = useState(todayISO);
  const [vDate,        setVDate]        = useState(todayISO);
  const [vClient,      setVClient]      = useState('');
  const [vProduct,     setVProduct]     = useState('');
  const [vQuantity,    setVQuantity]    = useState(1);
  const [vAmountUSD,   setVAmountUSD]   = useState('');
  const [vMethod,      setVMethod]      = useState('Efectivo COP');
  const [vSelectedKg,  setVSelectedKg]  = useState(0);

  // Compras
  const [cTab,      setCTab]      = useState('materia_prima');
  const [cDate,     setCDate]     = useState(todayISO);
  const [cProdType, setCProdType] = useState('Pergamino');
  const [cProducer, setCProducer] = useState('');
  const [cKg,       setCKg]       = useState('');
  const [cPriceCOP, setCPriceCOP] = useState('');
  const [cMethod,   setCMethod]   = useState('Efectivo COP');
  const [showBuyHistory,  setShowBuyHistory]  = useState(false);
  const [showOpexHistory, setShowOpexHistory] = useState(false);

  const [oDate,     setODate]     = useState(todayISO);
  const [oCategory, setOCategory] = useState('Empaques/Bolsas');
  const [oDesc,     setODesc]     = useState('');
  const [oAmount,   setOAmount]   = useState('');
  const [oCurrency, setOCurrency] = useState('COP');
  const [oMethod,   setOMethod]   = useState('Efectivo COP');
  const [oIsRecurring, setOIsRecurring] = useState(false);

  const [filterClient, setFilterClient] = useState('');
  const [filterProducer, setFilterProducer] = useState('');

  const [vStickerType, setVStickerType] = useState('grande');
  const [balanceSubTab, setBalanceSubTab] = useState('general');
  const [editingSale, setEditingSale] = useState(null);
  const [editingLog, setEditingLog] = useState(null);

  // Fábrica
  const [fAction,       setFAction]       = useState('trilla');
  const [fDate,         setFDate]         = useState(todayISO);
  const [producerInput, setProducerInput] = useState('');
  const [fKgIn,         setFKgIn]         = useState('');
  const [fKgOut,        setFKgOut]        = useState('');

  // Config
  const [editingCatId,       setEditingCatId]       = useState(null);
  const [editPrice,          setEditPrice]           = useState('');
  const [showNewClientForm,  setShowNewClientForm]   = useState(false);
  const [newClientData,      setNewClientData]       = useState({ fullName: '', business: '', sector: '', phone: '' });
  const [showNewProducerForm,setShowNewProducerForm] = useState(false);
  const [newProducerData,    setNewProducerData]     = useState({ name: '', finca: '', sector: '', phone: '' });

  // Modales
  const [toast,       setToast]       = useState('');
  const [promptModal, setPromptModal] = useState({ isOpen: false, id: null, type: null, method: 'Efectivo COP', amount: 0, maxAmount: 0 });
  const [invoiceModal,setInvoiceModal]= useState({ isOpen: false, sale: null });
  const [isSyncing,   setIsSyncing]   = useState(false);

  // ============================================================
  //  LOCAL STORAGE ENGINE
  // ============================================================
  useEffect(() => {
    try {
      const saved = localStorage.getItem('colados_app_v6');
      if (saved) {
        const d = JSON.parse(saved);
        if (d.rates)          setRates(d.rates);
        if (d.inventory)      setInventory(d.inventory);
        if (d.supplies)       setSupplies(d.supplies);
        if (d.donations)      setDonations(d.donations);
        if (d.invoiceCounter) setInvoiceCounter(d.invoiceCounter);
        if (d.catalog?.length) setCatalog(d.catalog);
        if (d.clients)        setClients(d.clients);
        if (d.producers)      setProducers(d.producers);
        if (d.sales)          setSales(d.sales);
        if (d.purchases)      setPurchases(d.purchases);
        if (d.expenses)       setExpenses(d.expenses);
        if (d.processHistory) setProcessHistory(d.processHistory);
        if (d.orders)         setOrders(d.orders);
      }
    } catch (e) {
      console.error('Error cargando datos:', e);
    }
  }, []);

  const guardarLocal = useCallback((patch) => {
    setIsSyncing(true);
    try {
      const existing = localStorage.getItem('colados_app_v6');
      const current  = existing ? JSON.parse(existing) : {};
      localStorage.setItem('colados_app_v6', JSON.stringify({ ...current, ...patch }));
    } catch (e) {
      console.error('Error guardando:', e);
      showToast('⚠️ Memoria llena — libera espacio');
    }
    setTimeout(() => setIsSyncing(false), 300);
  }, []);

  // ============================================================
  //  EXPORTAR / IMPORTAR
  // ============================================================
  const exportData = async () => {
    const data = localStorage.getItem('colados_app_v6');
    if (!data) { showToast('No hay datos para exportar'); return; }
    const fileName = `Colados_Respaldo_${formatDate(todayISO).replace(/\//g, '-')}.json`;
    
    try {
      const result = await Filesystem.writeFile({
        path: fileName,
        data: data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      showToast(`¡Guardado en carpeta Documentos!\n${fileName}`);
    } catch (e) {
      console.error('Error nativo:', e);
      // Fallback a descarga web
      const blob = new Blob([data], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      showToast('¡Respaldo descargado!');
    }
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json && typeof json === 'object') {
          localStorage.setItem('colados_app_v6', JSON.stringify(json));
          showToast('¡Datos restaurados! Reiniciando...');
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch { showToast('Error: Archivo de respaldo inválido'); }
    };
    reader.readAsText(file);
  };

  const exportToCSV = (data, fileName) => {
    if (!data || data.length === 0) { showToast('No hay datos para exportar'); return; }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v).join(','));
    const csvContent = "\uFEFF" + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName}.csv`);
    link.click();
    showToast('Reporte CSV generado');
  };

  // ============================================================
  //  UTILIDADES
  // ============================================================  // --- UI HELPERS ---
  const formatDate = (iso) => {
    if(!iso) return '';
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const showToast = (msg) => {
    setToast(msg);
    if (navigator.vibrate) navigator.vibrate(40);
    // Usar Toast nativo si está disponible
    NativeToast.show({ text: msg, duration: 'short' }).catch(()=>{});
    setTimeout(() => setToast(''), 3000);
  };

  const openInvoice = (sale) => setInvoiceModal({ isOpen: true, sale });

  const isOverdue = (isoDate) => {
    if (!isoDate) return false;
    return (Date.now() - new Date(isoDate).getTime()) / 86400000 > 7;
  };

  const expenseCategories = ['Empaques/Bolsas','Etiquetas','Gas','Electricidad/Agua','Mantenimiento/Equipos','Transporte/Envíos','Insumos','Otros'];
  const paymentMethods    = ['Efectivo COP','Efectivo USD','Efectivo BS','Pago Móvil','Bancolombia','Binance', 'Donación'];

  // ============================================================
  //  FACTURA — CANVAS IMAGE
  // ============================================================
  const downloadInvoiceImage = (sale) => {
    const canvas = document.createElement('canvas');
    canvas.width  = 400; canvas.height = 620;
    const ctx = canvas.getContext('2d');

    const logo = new Image();
    logo.src = logoBase64; 
    logo.onload = async () => {
      // ... (Lógica de dibujo igual que antes) ...
      ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, 400, 620);
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 380, 600);
      ctx.save();
      ctx.beginPath(); ctx.arc(200, 70, 45, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(logo, 155, 25, 90, 90);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15'; ctx.font = '900 32px sans-serif'; ctx.fillText('COLADOS', 200, 140);
      ctx.fillStyle = '#a1a1aa'; ctx.font = 'italic 13px sans-serif'; ctx.fillText('"Con el rico aroma al amanecer"', 200, 160);
      const dashedLine = (y) => { ctx.setLineDash([5,5]); ctx.strokeStyle='#3f3f46'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(370,y); ctx.stroke(); ctx.setLineDash([]); };
      dashedLine(180);
      ctx.textAlign='left'; ctx.font='14px sans-serif'; ctx.fillStyle='#a1a1aa';
      ctx.fillText('Recibo:', 40, 210); ctx.fillText('Fecha:', 40, 240); ctx.fillText('Cliente:', 40, 270);
      ctx.textAlign='right'; ctx.fillStyle='#f4f4f5'; ctx.font='bold 14px sans-serif';
      ctx.fillText(`#${sale.invoiceNum || sale.id.toString().slice(-4)}`, 360, 210);
      ctx.fillText(sale.date, 360, 240);
      ctx.fillStyle='#facc15'; ctx.fillText(sale.clientName, 360, 270);
      dashedLine(290);
      ctx.textAlign='left'; ctx.fillStyle='#a1a1aa'; ctx.font='12px sans-serif';
      ctx.fillText('CANT.  PRODUCTO', 40, 320);
      ctx.fillStyle='#f4f4f5'; ctx.font='bold 16px sans-serif';
      ctx.fillText(`${sale.quantity||1}x  ${sale.product}`, 40, 345);
      dashedLine(370);
      ctx.fillStyle='#a1a1aa'; ctx.font='14px sans-serif';
      ctx.fillText('Total COP:', 40, 400); ctx.fillText('Ref USD:', 40, 430); ctx.fillText('Ref BS:', 40, 460);
      ctx.textAlign='right';
      ctx.fillStyle='#4ade80'; ctx.font='900 24px sans-serif'; ctx.fillText(`$${(sale.cop||0).toLocaleString('es-CO')}`, 360, 400);
      ctx.fillStyle='#f4f4f5'; ctx.font='bold 14px sans-serif';
      ctx.fillText(`USD ${(sale.usd||0).toFixed(2)}`, 360, 430);
      ctx.fillText(`Bs ${(sale.bs||0).toFixed(2)}`, 360, 460);
      dashedLine(485);
      ctx.fillStyle = sale.isPaid ? '#166534' : '#9a3412';
      ctx.fillRect(50, 500, 300, 34);
      ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 13px sans-serif';
      let st = 'CRÉDITO PENDIENTE';
      if (sale.method === 'Donación') st = 'DONACIÓN / CORTESÍA';
      else if (sale.isPaid) st = `PAGADO — ${sale.method}`;
      else if (sale.paidAmount > 0) st = `ABONO $${sale.paidAmount.toLocaleString('es-CO')}`;
      ctx.fillText(st, 200, 522);
      ctx.fillStyle='#52525b'; ctx.font='bold 10px sans-serif';
      ctx.fillText('App hecha por Harvey Cárdenas', 200, 570);
      ctx.font='8px sans-serif';
      ctx.fillText('colados.app — offline-first ERP', 200, 585);

      const fileName = `Factura_Colados_${sale.invoiceNum || sale.id}.png`;
      const base64Data = canvas.toDataURL('image/png').split(',')[1];

      try {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });
        await Share.share({
          title: 'Factura Colados',
          url: result.uri
        });
      } catch (e) {
        console.error('Error nativo:', e);
        const a = document.createElement('a');
        a.href     = canvas.toDataURL('image/png');
        a.download = fileName;
        a.click();
      }
    };
    logo.onerror = () => showToast('Error cargando logo');
  };

  // ============================================================
  //  COMPARTIR — FIX: usar Clipboard API moderna
  // ============================================================
  const shareInvoiceText = async (sale) => {
    let st = 'CRÉDITO PENDIENTE';
    if (sale.isPaid) st = `PAGADO (${sale.method})`;
    else if (sale.paidAmount > 0) st = `ABONO PARCIAL ($${sale.paidAmount.toFixed(2)})`;

    const text = `☕ *COLADOS CAFÉ* ☕\n_"Con el rico aroma al amanecer"_\n\n*Recibo:* #${sale.invoiceNum || sale.id.toString().slice(-4)}\n*Fecha:* ${sale.date}\n*Cliente:* ${sale.clientName}\n\n*Detalle:* ${sale.quantity||1}x ${sale.product}\n*Total:* $${(sale.cop||0).toLocaleString('es-CO')} COP / USD ${sale.usd.toFixed(2)}\n*Estado:* ${st}\n\n_¡Gracias por preferir la calidad de nuestros andes!_\n\n_App hecha por Harvey Cárdenas_`;

    // Web Share API (Android nativo) o Clipboard API
    if (navigator.share) {
      try { await navigator.share({ title: 'Factura Colados', text }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('¡Texto copiado! Pégalo en WhatsApp.');
    } catch {
      showToast('Error al copiar texto.');
    }
  };

  // ============================================================
  //  DELETE helpers
  // ============================================================
  const deleteSale = (id) => {
    const saleToDelete = sales.find(s => s.id === id);
    if (saleToDelete) {
      const totalKgToReturn = (saleToDelete.kgSold || 0) * (saleToDelete.quantity || 1);
      const newInv = { ...inventory, tostado: round2(inventory.tostado + totalKgToReturn) };
      
      const catItem = catalog.find(p => p.name === saleToDelete.product);
      const newSupplies = { ...supplies };
      if (catItem && catItem.bagType) {
        newSupplies[catItem.bagType] += (saleToDelete.quantity || 1);
        if (catItem.bagType === 'bolsas_kraft') newSupplies.etiquetas += (saleToDelete.quantity || 1);
      }
      
      setInventory(newInv); setSupplies(newSupplies);
      const n = sales.filter(s => s.id !== id);
      setSales(n);
      guardarLocal({ sales: n, inventory: newInv, supplies: newSupplies });
      showToast('Venta eliminada y stock devuelto');
    }
  };
  const deleteExpense = (id) => {
    const n = expenses.filter(e => e.id !== id);
    setExpenses(n); guardarLocal({ expenses: n }); showToast('Gasto eliminado');
  };
  const deletePurchase = (id) => {
    const pToDelete = purchases.find(p => p.id === id);
    if (pToDelete) {
      const newInv = { ...inventory };
      const kgToRemove = pToDelete.kg || 0;
      if (pToDelete.coffeeType === 'Pergamino') newInv.pergamino = round2(Math.max(0, newInv.pergamino - kgToRemove));
      if (pToDelete.coffeeType === 'Azul')      newInv.azul      = round2(Math.max(0, newInv.azul - kgToRemove));
      
      setInventory(newInv);
      const n = purchases.filter(p => p.id !== id);
      setPurchases(n);
      guardarLocal({ purchases: n, inventory: newInv });
      showToast('Compra eliminada e inventario revertido');
    }
  };

  // ============================================================
  //  RENDER: VENTAS & PEDIDOS
  // ============================================================
  const deleteLog = (id) => {
    const log = processHistory.find(l => l.id === id);
    if (!log) return;
    const newInv = { ...inventory };
    if (log.type === 'trilla') {
      newInv.pergamino = round2(newInv.pergamino + log.input);
      newInv.azul = round2(Math.max(0, newInv.azul - log.output));
    } else {
      newInv.azul = round2(newInv.azul + log.input);
      newInv.tostado = round2(Math.max(0, newInv.tostado - log.output));
    }
    const n = processHistory.filter(l => l.id !== id);
    setProcessHistory(n); setInventory(newInv);
    guardarLocal({ processHistory: n, inventory: newInv });
    showToast('Proceso revertido y eliminado');
  };

  const updateSale = (updated) => {
    const old = sales.find(s => s.id === updated.id);
    if(!old) return;
    const revInv = { ...inventory };
    if(old.kgSold > 0) {
      if(old.product.toLowerCase().includes('tostado')) revInv.tostado = round2(revInv.tostado + (old.kgSold * old.quantity));
      else if(old.product.toLowerCase().includes('azul')) revInv.azul = round2(revInv.azul + (old.kgSold * old.quantity));
    }
    const revSup = { ...supplies };
    if(old.bagType === 'kraft') revSup.bolsas_kraft += old.quantity;
    if(old.bagType === 'granel') revSup.bolsas_granel += old.quantity;
    revSup.etiquetas += old.quantity;
    if(old.stickerType === 'grande') revSup.stickers_grandes += old.quantity;
    if(old.stickerType === 'pequeño') revSup.stickers_pequenos += old.quantity;

    if(updated.kgSold > 0) {
      if(updated.product.toLowerCase().includes('tostado')) revInv.tostado = round2(revInv.tostado - (updated.kgSold * updated.quantity));
      else if(updated.product.toLowerCase().includes('azul')) revInv.azul = round2(revInv.azul - (updated.kgSold * updated.quantity));
    }
    if(updated.bagType === 'kraft') revSup.bolsas_kraft -= updated.quantity;
    if(updated.bagType === 'granel') revSup.bolsas_granel -= updated.quantity;
    revSup.etiquetas -= updated.quantity;
    if(updated.stickerType === 'grande') revSup.stickers_grandes -= updated.quantity;
    if(updated.stickerType === 'pequeño') revSup.stickers_pequenos -= updated.quantity;

    const newSales = sales.map(s => s.id === updated.id ? updated : s);
    setSales(newSales); setInventory(revInv); setSupplies(revSup);
    guardarLocal({ sales: newSales, inventory: revInv, supplies: revSup });
    setEditingSale(null);
    showToast('Venta actualizada');
  };

  const updateLog = (updated) => {
    const old = processHistory.find(l => l.id === updated.id);
    if(!old) return;
    const revInv = { ...inventory };
    if (old.type === 'trilla') {
      revInv.pergamino = round2(revInv.pergamino + old.input);
      revInv.azul = round2(Math.max(0, revInv.azul - old.output));
    } else {
      revInv.azul = round2(revInv.azul + old.input);
      revInv.tostado = round2(Math.max(0, revInv.tostado - old.output));
    }
    if (updated.type === 'trilla') {
      revInv.pergamino = round2(revInv.pergamino - updated.input);
      revInv.azul = round2(revInv.azul + updated.output);
    } else {
      revInv.azul = round2(revInv.azul - updated.input);
      revInv.tostado = round2(revInv.tostado + updated.output);
    }
    const newHistory = processHistory.map(l => l.id === updated.id ? updated : l);
    setProcessHistory(newHistory); setInventory(revInv);
    guardarLocal({ processHistory: newHistory, inventory: revInv });
    setEditingLog(null);
    showToast('Lote actualizado');
  };

  const renderVentas = () => {
    const bs  = vAmountUSD ? (parseFloat(vAmountUSD) * rates.bs).toFixed(2)  : '0.00';
    const cop = vAmountUSD ? (parseFloat(vAmountUSD) * rates.cop).toFixed(0) : '0';

    const handleQuickProduct = (p) => {
      setVProduct(p.name);
      setVQuantity(1);
      setVAmountUSD(p.price.toString());
      setVSelectedKg(p.deductKg);
    };

    const handleSell = (e) => {
      e.preventDefault();
      if (!vClient || !vProduct || !vAmountUSD) return;
      const isCredit  = vMethod === 'Crédito';
      const copAmount = parseFloat(vAmountUSD);
      const usdAmount = copAmount / rates.usd_cop;
      const bsAmount  = copAmount * rates.cop_bs;
      
      const catItem   = catalog.find(p => p.name === vProduct);
      
      const newSale   = {
        id: Date.now(), 
        invoiceNum: invoiceCounter.toString().padStart(4, '0'),
        clientName: vClient, product: vProduct,
        quantity: parseInt(vQuantity) || 1, kgSold: vSelectedKg,
        cop: copAmount, usd: usdAmount, bs: bsAmount,
        method: vMethod, date: formatDate(vDate), isoDate: vDate,
        time: new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
        isPaid: !isCredit, paidAmount: isCredit ? 0 : copAmount,
      };

      // Descontar Inventario de Café
      const newInv  = { ...inventory, tostado: round2(Math.max(0, inventory.tostado - (vSelectedKg * (parseInt(vQuantity) || 1)))) };
      
      // Descontar Insumos (Bolsas)
      const newSupplies = { ...supplies };
      if (catItem && catItem.bagType) {
        newSupplies[catItem.bagType] = Math.max(0, newSupplies[catItem.bagType] - (parseInt(vQuantity) || 1));
        
        // Descuento de etiquetas
        if (catItem.bagType === 'bolsas_kraft') {
          newSupplies.etiquetas = Math.max(0, newSupplies.etiquetas - (parseInt(vQuantity) || 1));
        }

        if (vStickerType === 'grande') newSupplies.stickers_grandes = Math.max(0, newSupplies.stickers_grandes - (parseInt(vQuantity) || 1));
        else if (vStickerType === 'pequeño') newSupplies.stickers_pequenos = Math.max(0, newSupplies.stickers_pequenos - (parseInt(vQuantity) || 1));

        if (newSupplies[catItem.bagType] <= supplies.alerta_umbral || newSupplies.etiquetas <= supplies.alerta_umbral) {
          showToast(`⚠️ ¡Quedan pocas ${catItem.bagType.replace('_',' ')} o Etiquetas!`);
        }
      }

      const newSales = [newSale, ...sales];
      const nextInvoice = invoiceCounter + 1;
      
      let nOrders  = orders;
      if (activeOrderId) {
        nOrders = orders.filter(o => o.id !== activeOrderId);
        setOrders(nOrders); setActiveOrderId(null);
      }

      setSales(newSales); 
      setInventory(newInv);
      setSupplies(newSupplies);
      setInvoiceCounter(nextInvoice);

      guardarLocal({ 
        sales: newSales, 
        inventory: newInv, 
        supplies: newSupplies, 
        invoiceCounter: nextInvoice,
        orders: nOrders 
      });

      setVClient(''); setVProduct(''); setVQuantity(1); setVAmountUSD(''); setVSelectedKg(0);
      showToast('✅ Venta registrada con éxito');
    };

    const handleCreateOrder = (e) => {
      e.preventDefault();
      if (!vClient || !vProduct) return;
      const newOrder = {
        id: Date.now(), clientName: vClient, product: vProduct,
        quantity: parseInt(vQuantity) || 1, date: formatDate(orderDate),
        isoDate: orderDate, status: 'pending', isRecurring: oIsRecurring
      };
      const nOrders = [newOrder, ...orders];
      setOrders(nOrders); guardarLocal({ orders: nOrders });
      setVClient(''); setVProduct(''); setVQuantity(1); setVAmountUSD(''); setVSelectedKg(0); setOIsRecurring(false);
      showToast('¡Pedido agendado!'); setVTab('pedidos');
    };

    const dispatchOrder = (order) => {
      setVClient(order.clientName); setVProduct(order.product); setVQuantity(order.quantity);
      const catItem = catalog.find(p => p.name === order.product);
      if (catItem) { setVAmountUSD((catItem.price * order.quantity).toFixed(2)); setVSelectedKg(catItem.deductKg * order.quantity); }
      setActiveOrderId(order.id); setVTab('venta');
    };
    const deleteOrder = (id) => {
      const n = orders.filter(o => o.id !== id);
      setOrders(n); guardarLocal({ orders: n }); showToast('Pedido eliminado');
    };

    return (
      <div className="p-4 space-y-4 animate-in fade-in duration-300">
        {/* SUB-TABS */}
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button onClick={() => setVTab('venta')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${vTab==='venta' ? 'bg-yellow-400 text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <DollarSign size={14} className="inline mr-1"/>DESPACHO
          </button>
          <button onClick={() => setVTab('pedidos')} className={`flex-1 py-2 text-xs font-bold rounded-lg relative transition-all ${vTab==='pedidos' ? 'bg-zinc-800 text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <ClipboardList size={14} className="inline mr-1"/>PEDIDOS
            {orders.length > 0 && <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-zinc-900"/>}
          </button>
        </div>

        {vTab === 'venta' ? (
          <>
            {/* TASAS */}
            <div className="flex gap-2">
              <div className="flex-1 bg-zinc-900 p-2 rounded-xl border border-zinc-800 text-center">
                <p className="text-[9px] font-bold text-zinc-500 mb-1">TRM (USD/COP)</p>
                <input type="number" value={rates.usd_cop} onChange={(e)=>{const v=parseFloat(e.target.value)||0; const r={...rates,usd_cop:v}; setRates(r); guardarLocal({rates:r});}} className="w-full font-black text-lg text-yellow-400 bg-transparent outline-none text-center" step="10"/>
              </div>
              <div className="flex-1 bg-zinc-900 p-2 rounded-xl border border-zinc-800 text-center">
                <p className="text-[9px] font-bold text-zinc-500 mb-1">Tasa (COP/BS)</p>
                <input type="number" value={rates.cop_bs} onChange={(e)=>{const v=parseFloat(e.target.value)||0; const r={...rates,cop_bs:v}; setRates(r); guardarLocal({rates:r});}} className="w-full font-black text-lg text-yellow-400 bg-transparent outline-none text-center" step="0.001"/>
              </div>
            </div>
            {/* CATÁLOGO */}
            <div>
              <p className="text-xs font-bold text-zinc-400 mb-2">CATÁLOGO RÁPIDO</p>
              <div className="grid grid-cols-2 gap-2">
                {catalog.map(p=>(
                  <button key={p.id} type="button" onClick={()=>handleQuickProduct(p)} className="bg-zinc-900 border border-zinc-800 hover:border-yellow-400 text-zinc-300 text-[10px] font-bold py-2 px-2 rounded-lg flex justify-between items-center">
                    <span className="truncate mr-1">{p.name}</span><span className="bg-yellow-400 text-zinc-900 px-1 rounded font-black">${p.price}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* BANNER PEDIDO ACTIVO */}
            {activeOrderId && (
              <div className="bg-yellow-400/20 border border-yellow-400/50 p-3 rounded-xl flex justify-between items-center">
                <span className="text-xs font-bold text-yellow-400 flex items-center gap-2"><CheckSquare size={16}/>Cumpliendo Pedido Agendado</span>
                <button onClick={()=>{setActiveOrderId(null);setVClient('');setVProduct('');setVQuantity(1);setVAmountUSD('');}} className="text-[10px] text-zinc-400 hover:text-white underline font-bold">CANCELAR</button>
              </div>
            )}
            {/* FORMULARIO VENTA */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-lg">
              <form onSubmit={handleSell} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Fecha</label><input type="date" value={vDate} onChange={e=>setVDate(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm font-bold" required/></div>
                  <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Cliente</label>
                    <select value={vClient} onChange={e=>setVClient(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm" required>
                      <option value="">Seleccione...</option>
                      {clients.map(c=><option key={c.id} value={c.fullName}>{c.fullName}</option>)}
                      <option value="Cliente Ocasional">Cliente Ocasional</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-8"><label className="text-[10px] text-zinc-400 font-bold uppercase">Producto</label><input type="text" value={vProduct} onChange={e=>setVProduct(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm" required placeholder="Ej. 1Kg Granel"/></div>
                  <div className="col-span-4"><label className="text-[10px] text-zinc-400 font-bold uppercase">Cant.</label>
                    <input type="number" min="1" value={vQuantity} onChange={e=>{const q=parseInt(e.target.value)||1; setVQuantity(q); const c=catalog.find(p=>p.name===vProduct); if(c){setVAmountUSD((c.price*q).toFixed(2));setVSelectedKg(c.deductKg*q);}}} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-bold mt-1 text-sm text-center" required/>
                  </div>
                </div>
                <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Monto (COP)</label><input type="number" step="50" value={vAmountUSD} onChange={e=>setVAmountUSD(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-yellow-400 font-black mt-1 text-lg" required placeholder="0"/></div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-zinc-950 p-2 rounded-lg text-center border border-zinc-800"><span className="text-[10px] text-zinc-500 block">USD</span><span className="text-white text-xs font-bold">${vAmountUSD ? (parseFloat(vAmountUSD) / rates.usd_cop).toFixed(2) : '0.00'}</span></div>
                  <div className="flex-1 bg-zinc-950 p-2 rounded-lg text-center border border-zinc-800"><span className="text-[10px] text-zinc-500 block">BS</span><span className="text-white text-xs font-bold">{vAmountUSD ? (parseFloat(vAmountUSD) * rates.cop_bs).toFixed(2) : '0.00'}</span></div>
                </div>
                <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Forma de Pago</label>
                  <select value={vMethod} onChange={e=>setVMethod(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 font-bold text-sm">
                    {paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}
                    <option value="Crédito">A CRÉDITO (FIADO)</option>
                  </select>
                </div>

                {/* SELECCIÓN DE STICKER */}
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Tipo de Sticker</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setVStickerType('grande')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all ${vStickerType==='grande'?'bg-yellow-400 text-zinc-900 border-yellow-400 shadow-lg shadow-yellow-400/20':'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>STICKER G</button>
                    <button type="button" onClick={()=>setVStickerType('pequeño')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all ${vStickerType==='pequeño'?'bg-yellow-400 text-zinc-900 border-yellow-400 shadow-lg shadow-yellow-400/20':'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>STICKER P</button>
                  </div>
                </div>

                <button type="submit" className="w-full bg-yellow-400 text-zinc-900 font-black py-4 rounded-lg flex justify-center items-center gap-2 hover:bg-yellow-300 transition-colors shadow-lg">
                  <Plus size={18}/>REGISTRAR VENTA
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            {/* FORMULARIO PEDIDO */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-lg">
              <h3 className="text-xs font-bold text-yellow-400 mb-3 uppercase tracking-wider flex items-center gap-2"><ClipboardList size={14}/>Nuevo Pedido</h3>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Para el (Fecha)</label><input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm font-bold" required/></div>
                  <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Cliente</label>
                    <select value={vClient} onChange={e=>setVClient(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm" required>
                      <option value="">Seleccione...</option>
                      {clients.map(c=><option key={c.id} value={c.fullName}>{c.fullName}</option>)}
                      <option value="Cliente Ocasional">Cliente Ocasional</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-8"><label className="text-[10px] text-zinc-400 font-bold uppercase">Producto</label>
                    <select value={vProduct} onChange={e=>setVProduct(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm" required>
                      <option value="">Tipo de café...</option>
                      {catalog.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-4"><label className="text-[10px] text-zinc-400 font-bold uppercase">Cant.</label><input type="number" min="1" value={vQuantity} onChange={e=>setVQuantity(parseInt(e.target.value)||1)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-bold mt-1 text-sm text-center" required/></div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="recurring" checked={oIsRecurring} onChange={(e) => setOIsRecurring(e.target.checked)} className="w-4 h-4 text-yellow-400 bg-zinc-950 border-zinc-800 rounded focus:ring-yellow-400 focus:ring-2" />
                  <label htmlFor="recurring" className="text-xs font-bold text-zinc-300">Entregar Semanalmente</label>
                </div>
                <button type="submit" className="w-full bg-zinc-800 border border-yellow-400 text-yellow-400 font-black py-3 rounded-lg flex justify-center items-center gap-2 hover:bg-zinc-700 transition-colors">
                  <Save size={18}/>GUARDAR PEDIDO
                </button>
              </form>
            </div>
            {/* LISTA PEDIDOS */}
            {orders.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-yellow-400 mb-2 uppercase tracking-wider flex items-center gap-2 mt-4"><Bell size={14}/>Agenda Activa ({orders.length})</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 text-center">
                    <p className="text-[8px] text-zinc-500 uppercase font-bold">Kilos x Procesar</p>
                    <p className="text-sm font-black text-white">{round2(orders.reduce((acc, o) => {
                      const c = catalog.find(cat => cat.name === o.product);
                      return acc + (c ? c.deductKg * o.quantity : 0);
                    }, 0))} kg</p>
                  </div>
                  <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 text-center">
                    <p className="text-[8px] text-zinc-500 uppercase font-bold">Total Paquetes</p>
                    <p className="text-sm font-black text-yellow-400">{orders.reduce((acc, o) => acc + o.quantity, 0)} uds</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {orders.map(o=>(
                    <div key={o.id} className="bg-zinc-950 p-3 rounded-xl border-l-4 border-l-yellow-400 border-y border-r border-zinc-800 shadow-md">
                      <div className="flex justify-between items-start mb-2">
                        <div><p className="font-bold text-white text-sm flex items-center gap-2">{o.clientName} {o.isRecurring && <span className="bg-yellow-400 text-zinc-900 text-[8px] px-1 rounded uppercase">Semanal</span>}</p><p className="text-[10px] text-zinc-400">Para: <span className="text-yellow-400 font-bold">{o.date}</span></p></div>
                        <button onClick={()=>deleteOrder(o.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                      <div className="flex justify-between items-end border-t border-zinc-800 pt-2 mt-2">
                        <p className="font-black text-zinc-300 text-sm">{o.quantity}x {o.product}</p>
                        <button onClick={()=>{
                          dispatchOrder(o);
                          if (o.isRecurring) {
                            // Crear el próximo pedido para la siguiente semana
                            const nextDate = new Date(o.isoDate);
                            nextDate.setDate(nextDate.getDate() + 7);
                            const nextDateStr = nextDate.toISOString().split('T')[0];
                            const newOrder = { ...o, id: Date.now(), date: formatDate(nextDateStr), isoDate: nextDateStr };
                            const nOrders = [newOrder, ...orders.filter(ord=>ord.id!==o.id)];
                            setOrders(nOrders); guardarLocal({ orders: nOrders });
                            showToast('Siguiente pedido semanal programado');
                          }
                        }} className="text-[10px] bg-yellow-400 text-zinc-900 px-3 py-1.5 rounded font-black hover:bg-yellow-300">¡DESPACHAR!</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ============================================================
  //  RENDER: COMPRAS (MATERIA PRIMA + OPEX)
  // ============================================================
  const renderCompras = () => {
    const totalCOP = (cKg && cPriceCOP) ? (parseFloat(cKg) * parseFloat(cPriceCOP)).toFixed(0) : 0;

    const handleBuyMP = (e) => {
      e.preventDefault();
      if (!cKg || !cPriceCOP || !cProducer) return;
      const isCredit     = cMethod === 'Crédito';
      const copTotal     = parseFloat(totalCOP);
      const usdCalc      = copTotal / rates.usd_cop;
      const newPurchase  = {
        id: Date.now(), type: 'Materia Prima', coffeeType: cProdType,
        producer: cProducer, kg: parseFloat(cKg),
        pricePerKgCop: parseFloat(cPriceCOP), cop: copTotal,
        usd: usdCalc, method: cMethod, isPaid: !isCredit,
        paidAmount: isCredit ? 0 : copTotal,
        date: formatDate(cDate), isoDate: cDate,
      };
      const newInv = { ...inventory };
      if (cProdType === 'Pergamino') newInv.pergamino = round2(newInv.pergamino + parseFloat(cKg));
      if (cProdType === 'Azul')      newInv.azul      = round2(newInv.azul + parseFloat(cKg));
      const newPurchases = [newPurchase, ...purchases];
      setPurchases(newPurchases); setInventory(newInv);
      guardarLocal({ purchases: newPurchases, inventory: newInv });
      setCKg(''); setCPriceCOP(''); setCProducer('');
      showToast('✅ Materia prima registrada');
    };

    const handleBuyOpex = (e) => {
      e.preventDefault();
      if (!oAmount) return;
      let copCalc = parseFloat(oAmount);
      if (oCurrency === 'USD') copCalc = parseFloat(oAmount) * rates.usd_cop;
      if (oCurrency === 'BS')  copCalc = parseFloat(oAmount) / rates.cop_bs;
      const newExp = {
        id: Date.now(), category: oCategory, description: oDesc,
        cop: copCalc, usd: copCalc / rates.usd_cop, originalAmount: parseFloat(oAmount),
        originalCurrency: oCurrency, method: oMethod,
        date: formatDate(oDate), isoDate: oDate,
      };
      const newExpenses = [newExp, ...expenses];
      setExpenses(newExpenses); guardarLocal({ expenses: newExpenses });
      setOAmount(''); setODesc('');
      showToast('✅ Gasto operativo registrado');
    };

    return (
      <div className="p-4 space-y-4 animate-in fade-in duration-300">
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button onClick={()=>setCTab('materia_prima')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${cTab==='materia_prima'?'bg-zinc-800 text-yellow-400':'text-zinc-500'}`}><Package size={14} className="inline mr-1"/>MATERIA PRIMA</button>
          <button onClick={()=>setCTab('opex')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${cTab==='opex'?'bg-red-900/30 text-red-400':'text-zinc-500'}`}><MinusCircle size={14} className="inline mr-1"/>GASTOS (OPEX)</button>
        </div>

        {cTab === 'materia_prima' ? (
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-lg">
            <form onSubmit={handleBuyMP} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Fecha</label><input type="date" value={cDate} onChange={e=>setCDate(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm font-bold" required/></div>
                <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Tipo de Café</label>
                  <select value={cProdType} onChange={e=>setCProdType(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 font-bold text-sm">
                    <option value="Pergamino">Pergamino</option>
                    <option value="Azul">Azul (Lavado)</option>
                  </select>
                </div>
              </div>
              <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Productor / Finca</label>
                <select value={cProducer} onChange={e=>setCProducer(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm" required>
                  <option value="">Seleccione...</option>
                  {producers.map(p=>{const n=typeof p==='string'?p:p.name; const f=typeof p==='string'?'':p.finca; return <option key={typeof p==='string'?p:p.id} value={n}>{n}{f?` (${f})`:''}</option>;})}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-950 rounded-lg border border-yellow-400/30">
                <div><label className="text-[10px] text-yellow-400 font-bold uppercase">Kilos (KG)</label><input type="number" step="0.01" value={cKg} onChange={e=>setCKg(e.target.value)} className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-black mt-1" required placeholder="0.00"/></div>
                <div><label className="text-[10px] text-yellow-400 font-bold uppercase">Precio x KG (COP)</label><input type="number" step="100" value={cPriceCOP} onChange={e=>setCPriceCOP(e.target.value)} className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-black mt-1" required placeholder="0"/></div>
              </div>
              <div className="bg-yellow-400/10 p-3 rounded-lg border border-yellow-400/20 text-center">
                <p className="text-[10px] text-zinc-400 font-bold uppercase">Monto Total</p>
                <p className="text-2xl font-black text-yellow-400">${Number(totalCOP).toLocaleString('es-CO')} COP</p>
              </div>
              <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Método de Pago</label>
                <select value={cMethod} onChange={e=>setCMethod(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 font-bold text-sm">
                  {paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}
                  <option value="Crédito">A CRÉDITO</option>
                </select>
              </div>
              <button type="submit" className="w-full font-black py-4 rounded-lg flex justify-center items-center gap-2 bg-yellow-400 text-zinc-900 hover:bg-yellow-300 shadow-lg"><ShoppingCart size={18}/>REGISTRAR COMPRA</button>
            </form>
          </div>
        ) : (
          <div className="bg-red-950/20 border border-red-900/30 p-4 rounded-xl shadow-lg">
            <form onSubmit={handleBuyOpex} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-red-400 font-bold uppercase">Fecha</label><input type="date" value={oDate} onChange={e=>setODate(e.target.value)} className="w-full p-3 bg-zinc-950 border border-red-900/50 rounded-lg text-white mt-1 text-sm font-bold" required/></div>
                <div><label className="text-[10px] text-red-400 font-bold uppercase">Categoría</label>
                  <select value={oCategory} onChange={e=>setOCategory(e.target.value)} className="w-full p-3 bg-zinc-950 border border-red-900/50 rounded-lg text-white mt-1 text-sm font-bold">
                    {expenseCategories.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="text-[10px] text-red-400 font-bold uppercase">Detalle</label><input type="text" value={oDesc} onChange={e=>setODesc(e.target.value)} className="w-full p-3 bg-zinc-950 border border-red-900/50 rounded-lg text-white mt-1 text-sm" placeholder="Ej. 100 Bolsas Kraft" required/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-red-400 font-bold uppercase">Moneda</label>
                  <select value={oCurrency} onChange={e=>setOCurrency(e.target.value)} className="w-full p-3 bg-zinc-950 border border-red-900/50 rounded-lg text-white mt-1 font-black text-sm">
                    <option value="COP">Pesos (COP)</option><option value="USD">Dólares (USD)</option><option value="BS">Bolívares (BS)</option>
                  </select>
                </div>
                <div><label className="text-[10px] text-red-400 font-bold uppercase">Monto</label><input type="number" step="0.01" value={oAmount} onChange={e=>setOAmount(e.target.value)} className="w-full p-3 bg-zinc-950 border border-red-900/50 rounded-lg text-red-400 font-black mt-1 text-lg" required placeholder="0.00"/></div>
              </div>
              <div><label className="text-[10px] text-red-400 font-bold uppercase">Pago con</label>
                <select value={oMethod} onChange={e=>setOMethod(e.target.value)} className="w-full p-3 bg-zinc-950 border border-red-900/50 rounded-lg text-white mt-1 font-bold text-sm">
                  {paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full font-black py-4 rounded-lg flex justify-center items-center gap-2 bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/50"><MinusCircle size={18}/>REGISTRAR GASTO</button>
            </form>
          </div>
        )}

        {/* HISTORIAL COMPRAS MP */}
        {cTab === 'materia_prima' && purchases.length > 0 && (
          <div>
            <button onClick={()=>setShowBuyHistory(v=>!v)} className="w-full flex justify-between items-center text-xs font-bold text-zinc-400 py-2 border border-dashed border-zinc-800 rounded-lg px-3 hover:border-yellow-400/30 hover:text-yellow-400 transition-colors">
              <span><List size={12} className="inline mr-1"/>HISTORIAL COMPRAS ({purchases.length})</span>
              <span>{showBuyHistory?'▲':'▼'}</span>
            </button>
            {showBuyHistory && (
              <div className="space-y-2 mt-2">
                {purchases.slice(0,20).map(p=>(
                  <div key={p.id} className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-zinc-200 text-xs">{p.kg}kg {p.coffeeType} — {p.producer}</p>
                      <p className="text-[9px] text-zinc-500">{p.date} • {p.method} • <span className={p.isPaid?'text-green-400':'text-orange-400'}>{p.isPaid?'Pagado':'Crédito'}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-red-400">-${p.usd.toFixed(2)}</span>
                      <button onClick={()=>deletePurchase(p.id)} className="text-zinc-700 hover:text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORIAL GASTOS OPEX */}
        {cTab === 'opex' && expenses.length > 0 && (
          <div>
            <button onClick={()=>setShowOpexHistory(v=>!v)} className="w-full flex justify-between items-center text-xs font-bold text-zinc-400 py-2 border border-dashed border-red-900/30 rounded-lg px-3 hover:text-red-400 transition-colors">
              <span><List size={12} className="inline mr-1"/>HISTORIAL GASTOS ({expenses.length})</span>
              <span>{showOpexHistory?'▲':'▼'}</span>
            </button>
            {showOpexHistory && (
              <div className="space-y-2 mt-2">
                {expenses.slice(0,20).map(e=>(
                  <div key={e.id} className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-zinc-200 text-xs">{e.category} — {e.description}</p>
                      <p className="text-[9px] text-zinc-500">{e.date} • {e.originalAmount} {e.originalCurrency}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-red-400">-${e.usd.toFixed(2)}</span>
                      <button onClick={()=>deleteExpense(e.id)} className="text-zinc-700 hover:text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  //  RENDER: FÁBRICA (TRILLA + TUESTE)
  // ============================================================
  const renderFabrica = () => {
    const currentMerma = (fKgIn && fKgOut && parseFloat(fKgIn) > 0)
      ? (((parseFloat(fKgIn) - parseFloat(fKgOut)) / parseFloat(fKgIn)) * 100).toFixed(1)
      : '0.0';

    const handleProcess = (e) => {
      e.preventDefault();
      const input = parseFloat(fKgIn); const output = parseFloat(fKgOut);
      if (input <= 0 || output <= 0 || output > input) { showToast('⚠️ Pesos inválidos'); return; }
      const newInv = { ...inventory };
      if (fAction === 'trilla') {
        if (input > newInv.pergamino) { showToast('⚠️ Stock insuficiente'); return; }
        newInv.pergamino = round2(newInv.pergamino - input); 
        newInv.azul = round2(newInv.azul + output);
      } else {
        if (input > newInv.azul) { showToast('⚠️ Stock insuficiente'); return; }
        newInv.azul = round2(newInv.azul - input); 
        newInv.tostado = round2(newInv.tostado + output);
      }
      let costPerKg = 0;
      const lastPurchase = purchases.find(p => p.coffeeType === (fAction === 'trilla' ? 'Pergamino' : 'Azul'));
      if (lastPurchase) costPerKg = lastPurchase.pricePerKgCop;
      
      const cat1kg = catalog.find(c => c.deductKg === 1) || { price: 40000 };
      const estimatedRevenue = output * cat1kg.price;
      const totalCost = input * costPerKg;
      const estimatedProfit = estimatedRevenue - totalCost;

      const prodName = typeof producerInput === 'string' ? producerInput : producerInput.name;
      const log = { id: Date.now(), type: fAction, producer: prodName || 'N/A', input, output, merma: currentMerma, date: formatDate(fDate), estimatedProfit };
      const newHistory = [log, ...processHistory];
      setProcessHistory(newHistory); setInventory(newInv);
      guardarLocal({ inventory: newInv, processHistory: newHistory });
      setFKgIn(''); setFKgOut(''); setProducerInput('');
      showToast('✅ Lote procesado');
    };

    return (
      <div className="p-4 space-y-4 animate-in fade-in duration-300">
        {/* STOCK CARDS */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-center shadow-lg">
            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Pergamino</p>
            <p className="text-xl font-black text-zinc-300">{inventory.pergamino.toFixed(1)}<span className="text-[10px]">kg</span></p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-center shadow-lg">
            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Azul</p>
            <p className="text-xl font-black text-blue-400">{inventory.azul.toFixed(1)}<span className="text-[10px]">kg</span></p>
          </div>
          <div className="bg-yellow-400 p-3 rounded-xl text-center shadow-[0_0_15px_rgba(250,204,21,0.2)]">
            <p className="text-[8px] font-bold text-zinc-800 uppercase tracking-widest">Tostado</p>
            <p className="text-2xl font-black text-zinc-900">{inventory.tostado.toFixed(1)}<span className="text-[10px]">kg</span></p>
          </div>
        </div>

        {/* TABS TRILLA/TUESTE */}
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button onClick={()=>setFAction('trilla')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${fAction==='trilla'?'bg-zinc-800 text-white':'text-zinc-500'}`}>1. TRILLAR</button>
          <button onClick={()=>setFAction('tueste')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${fAction==='tueste'?'bg-orange-900/40 text-orange-400':'text-zinc-500'}`}>2. TOSTAR 🔥</button>
        </div>

        {/* FORMULARIO */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
          <form onSubmit={handleProcess} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Fecha Proceso</label><input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm font-bold" required/></div>
              <div><label className="text-[10px] text-zinc-400 font-bold uppercase">Productor / Lote</label>
                <select value={producerInput} onChange={e=>setProducerInput(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white mt-1 text-sm" required>
                  <option value="">Seleccione...</option>
                  {producers.map(p=>{const n=typeof p==='string'?p:p.name; return <option key={typeof p==='string'?p:p.id} value={n}>{n}</option>;})}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1"><label className="text-[10px] text-zinc-400 font-bold uppercase">Peso Bruto (kg)</label><input type="number" step="0.01" value={fKgIn} onChange={e=>setFKgIn(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-black mt-1 text-center text-lg" required/></div>
              <ArrowRightLeft size={24} className="text-zinc-600 mt-5"/>
              <div className="flex-1"><label className="text-[10px] text-zinc-400 font-bold uppercase">Peso Neto (kg)</label><input type="number" step="0.01" value={fKgOut} onChange={e=>setFKgOut(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-yellow-400 font-black mt-1 text-center text-lg" required/></div>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-medium">Merma del lote:</span>
              <span className={`text-xl font-black ${parseFloat(currentMerma)>22?'text-red-500':'text-green-400'}`}>{currentMerma}%</span>
            </div>
            <button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-black py-4 rounded-xl flex justify-center items-center gap-2 text-sm tracking-widest">
              <Factory size={18}/>PROCESAR LOTE
            </button>
          </form>
        </div>

        {/* HISTORIAL DE PROCESOS */}
        {processHistory.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider flex items-center gap-2"><List size={12}/>Bitácora de Lotes ({processHistory.length})</h3>
            <div className="space-y-2">
              {processHistory.slice(0,10).map(log=>(
                <div key={log.id} className={`p-3 rounded-xl border flex justify-between items-center ${log.type==='tueste'?'bg-orange-950/20 border-orange-900/30':'bg-zinc-900 border-zinc-800'}`}>
                  <div>
                    <p className="font-bold text-zinc-200 text-xs">{log.type==='trilla'?'Trilla':'Tueste 🔥'} — {log.producer}</p>
                    <p className="text-[9px] text-zinc-500">{log.date} • {log.input}kg → {log.output}kg</p>
                    {log.estimatedProfit !== undefined && (
                      <p className={`text-[9px] font-bold mt-1 ${log.estimatedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Ganancia Est: ${log.estimatedProfit.toLocaleString('es-CO')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-black text-sm ${parseFloat(log.merma)>22?'text-red-400':'text-green-400'}`}>{log.merma}%</span>
                    <div className="flex gap-2">
                      <button onClick={()=>setEditingLog(log)} className="text-zinc-700 hover:text-yellow-400 p-1"><Edit3 size={13}/></button>
                      <button onClick={()=>deleteLog(log.id)} className="text-zinc-700 hover:text-red-500 p-1"><Trash2 size={13}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  //  RENDER: BALANCE
  // ============================================================
  const renderBalance = () => {
    const ingresosCOP   = sales.filter(s=>(s.isPaid||(s.paidAmount>0)) && s.method !== 'Donación').reduce((a,s)=>a+(s.paidAmount||s.cop),0);
    const opexCOP       = expenses.reduce((a,e)=>a+e.cop,0);
    const comprasMPCOP  = purchases.filter(p=>p.isPaid||(p.paidAmount>0)).reduce((a,p)=>a+(p.paidAmount||p.cop),0);
    const netPnL        = ingresosCOP - opexCOP - comprasMPCOP;
    const cxCobrar      = sales.filter(s=>!s.isPaid && s.cop>(s.paidAmount||0));
    const cxPagar       = purchases.filter(p=>!p.isPaid && p.cop>(p.paidAmount||0));
    const ticketPromedio= sales.filter(s=>s.method !== 'Donación').length>0 ? sales.filter(s=>s.method !== 'Donación').reduce((a,b)=>a+b.cop,0)/sales.filter(s=>s.method !== 'Donación').length : 0;
    
    const donationsCount = sales.filter(s => s.method === 'Donación').length;
    const kgDonated = sales.filter(s => s.method === 'Donación').reduce((a,s) => a + (s.kgSold || 0), 0);

    const last7 = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return formatDate(d.toISOString().split('T')[0]);}).reverse();
    const chartData = last7.map(date=>({date:date.substring(0,5), total:sales.filter(s=>s.date===date).reduce((a,b)=>a+b.usd,0)}));
    const maxChart  = Math.max(...chartData.map(d=>d.total),1);

    const markPaid = (item,type) => {
      const pending = item.usd-(item.paidAmount||0);
      setPromptModal({isOpen:true,id:item.id,type,method:'Efectivo COP',amount:pending,maxAmount:pending});
    };

    return (
      <div className="p-4 space-y-4 animate-in fade-in duration-300">
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button onClick={()=>setBalanceSubTab('general')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${balanceSubTab==='general'?'bg-zinc-800 text-yellow-400':'text-zinc-500'}`}>RESUMEN</button>
          <button onClick={()=>setBalanceSubTab('analytics')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${balanceSubTab==='analytics'?'bg-zinc-800 text-yellow-400':'text-zinc-500'}`}>ESTADÍSTICAS PRO</button>
        </div>

        {balanceSubTab === 'general' ? (
          <>
            {/* ALERTAS DE STOCK */}
            {(supplies.bolsas_kraft <= supplies.alerta_umbral || supplies.bolsas_granel <= supplies.alerta_umbral || supplies.etiquetas <= supplies.alerta_umbral) && (
              <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-2xl flex items-center gap-3">
                <AlertTriangle className="text-red-500 animate-pulse" size={24}/>
                <div>
                  <p className="text-xs font-black text-red-500 uppercase">¡Alerta de Insumos!</p>
                  <p className="text-[10px] text-zinc-400">
                    {supplies.bolsas_kraft <= supplies.alerta_umbral && `Bolsas Kraft (${supplies.bolsas_kraft}) `}
                    {supplies.bolsas_granel <= supplies.alerta_umbral && `Bolsas Granel (${supplies.bolsas_granel}) `}
                    {supplies.etiquetas <= supplies.alerta_umbral && `Etiquetas (${supplies.etiquetas}) `}
                    bajas.
                  </p>
                </div>
              </div>
            )}

            {/* GRÁFICO 7 DÍAS */}
            <div className="bg-zinc-900 rounded-2xl p-5 shadow-xl border border-zinc-800">
              <h3 className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-4 flex items-center gap-1"><BarChart3 size={14}/>Tendencia (7 Días)</h3>
              <div className="flex items-end justify-between h-28 gap-1">
                {chartData.map((data,i)=>{
                  const h=(data.total/maxChart)*100;
                  return (
                    <div key={i} className="flex flex-col items-center w-full group">
                      <div className="text-[8px] text-zinc-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">${data.total.toFixed(0)}</div>
                      <div className="w-full bg-yellow-400/20 rounded-t-sm" style={{height:'80px',display:'flex',alignItems:'flex-end'}}>
                        <div className="w-full bg-yellow-400 rounded-t-sm transition-all duration-500" style={{height:`${h}%`,minHeight:data.total>0?'4px':'0px'}}/>
                      </div>
                      <div className="text-[8px] text-zinc-500 mt-1 font-bold">{data.date}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PnL CARD */}
            <div className="bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-800 relative overflow-hidden">
              <TrendingUp size={100} className="absolute -bottom-4 -right-4 text-yellow-400 opacity-5"/>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Balance Neto (Base COP)</p>
              <div className={`text-4xl font-black mt-1 ${netPnL>=0?'text-white':'text-red-400'}`}>${netPnL.toLocaleString('es-CO')}</div>
              <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3 mt-3">
                <div><p className="text-[8px] text-zinc-500 uppercase">Ingresos</p><p className="font-bold text-green-400 text-xs">+{ingresosCOP.toLocaleString('es-CO')}</p></div>
                <div><p className="text-[8px] text-zinc-500 uppercase">Compras MP</p><p className="font-bold text-red-400 text-xs">-{comprasMPCOP.toLocaleString('es-CO')}</p></div>
                <div><p className="text-[8px] text-zinc-500 uppercase">OPEX</p><p className="font-bold text-orange-400 text-xs">-{opexCOP.toLocaleString('es-CO')}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 mt-3">
                <div><p className="text-[8px] text-zinc-500 uppercase flex items-center gap-1"><Target size={10}/>Ticket Prom.</p><p className="font-bold text-yellow-400 text-xs">${ticketPromedio.toLocaleString('es-CO')}</p></div>
                <div><p className="text-[8px] text-zinc-500 uppercase flex items-center gap-1"><PieChart size={10}/>Total Ventas</p><p className="font-bold text-green-400 text-xs">+{sales.reduce((a,b)=>a+b.cop,0).toLocaleString('es-CO')}</p></div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between items-center">
                <p className="text-[8px] text-zinc-500 uppercase flex items-center gap-1"><Coffee size={10}/>Donaciones</p>
                <p className="font-bold text-blue-400 text-xs">{donationsCount} veces ({kgDonated.toFixed(1)}kg)</p>
              </div>
            </div>

            {/* CXC / CXP */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-orange-500/30 rounded-xl p-4">
                <h3 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-1"><ArrowRightLeft size={12}/>A COBRAR</h3>
                <div className="text-xl font-black text-white mb-2">${cxCobrar.reduce((a,c)=>a+(c.cop-(c.paidAmount||0)),0).toLocaleString('es-CO')}</div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {cxCobrar.length===0 && <p className="text-[10px] text-zinc-600">Sin cuentas pendientes</p>}
                  {cxCobrar.map(c=>{
                    const pending=c.cop-(c.paidAmount||0); const over=isOverdue(c.isoDate);
                    return (
                      <div key={c.id} className={`bg-zinc-950 p-2 rounded border flex justify-between items-center ${over?'border-red-900/50':'border-zinc-800'}`}>
                        <div><p className="text-[10px] font-bold text-zinc-300 truncate w-20 flex items-center gap-1">{over&&<Flag size={8} className="text-red-500"/>}{c.clientName}</p><p className="text-[8px] text-orange-400">${pending.toLocaleString('es-CO')}</p></div>
                        <button onClick={()=>markPaid(c,'cxc')} className="text-[8px] bg-green-900/30 text-green-400 px-2 py-1 rounded font-bold">ABONAR</button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-4">
                <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1"><BookOpen size={12}/>A PAGAR</h3>
                <div className="text-xl font-black text-white mb-2">${cxPagar.reduce((a,p)=>a+(p.cop-(p.paidAmount||0)),0).toLocaleString('es-CO')}</div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {cxPagar.length===0 && <p className="text-[10px] text-zinc-600">Sin deudas pendientes</p>}
                  {cxPagar.map(p=>{
                    const pending=p.cop-(p.paidAmount||0);
                    return (
                      <div key={p.id} className="bg-zinc-950 p-2 rounded border border-zinc-800 flex justify-between items-center">
                        <div><p className="text-[10px] font-bold text-zinc-300 truncate w-20">{p.producer}</p><p className="text-[8px] text-red-400">${pending.toLocaleString('es-CO')}</p></div>
                        <button onClick={()=>markPaid(p,'cxp')} className="text-[8px] bg-red-900/30 text-red-400 px-2 py-1 rounded font-bold">ABONAR</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* HISTORIAL VENTAS */}
            <div>
              <h3 className="text-xs font-bold text-yellow-400 mb-2 uppercase tracking-wider flex items-center gap-2 mt-4"><List size={14}/>Últimas Ventas</h3>
              {sales.length===0 && <p className="text-xs text-zinc-600 text-center py-4">Aún no hay ventas registradas</p>}
              <div className="space-y-2">
                {sales.slice(0,visibleSales).map(s=>{
                  const statusText = s.isPaid ? 'Pagado' : (s.paidAmount>0 ? `Abonó $${s.paidAmount.toFixed(2)}` : 'Fiado');
                  return (
                    <div key={s.id} className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
                      <div><p className="font-bold text-zinc-200 text-xs">{s.quantity||1}x {s.product}</p><p className="text-[9px] text-zinc-500">{s.date} • {s.clientName} • {statusText}</p></div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-sm ${s.isPaid?'text-green-400':'text-orange-400'}`}>+${s.usd.toFixed(2)}</span>
                        <button onClick={()=>openInvoice(s)} className="text-yellow-400/50 hover:text-yellow-400"><Share2 size={15}/></button>
                        <button onClick={()=>setEditingSale(s)} className="text-zinc-700 hover:text-yellow-400"><Edit3 size={13}/></button>
                        <button onClick={()=>deleteSale(s.id)} className="text-zinc-700 hover:text-red-500"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  );
                })}
                {sales.length>visibleSales && <button onClick={()=>setVisibleSales(p=>p+10)} className="w-full text-xs font-bold text-zinc-500 py-2 border border-dashed border-zinc-800 rounded-lg hover:text-yellow-400 hover:border-yellow-400/30">CARGAR MÁS ({sales.length-visibleSales} restantes)</button>}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {/* PRODUCER QUALITY */}
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-bold text-yellow-400 mb-3 uppercase tracking-widest flex items-center justify-between">
                <span>Calidad por Productor</span>
                <button onClick={()=>exportToCSV(producers.map(p=>{
                  const n=typeof p==='string'?p:p.name;
                  const logs=processHistory.filter(l=>l.producer===n);
                  const totalIn=logs.reduce((a,b)=>a+b.input,0);
                  const totalOut=logs.reduce((a,b)=>a+b.output,0);
                  const avgMerma=totalIn>0?((totalIn-totalOut)/totalIn*100).toFixed(1):0;
                  return {Productor:n, Entregado:totalIn, Procesado:totalOut, MermaPromedio:avgMerma+'%'};
                }), 'Calidad_Productores')} className="text-[10px] text-zinc-500 hover:text-white"><Download size={12}/></button>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {producers.length === 0 ? <p className="text-[10px] text-zinc-600">Sin datos de fábrica aún.</p> : producers.map(p=>{
                  const n=typeof p==='string'?p:p.name;
                  const logs=processHistory.filter(l=>l.producer===n);
                  if(logs.length===0) return null;
                  const totalIn=logs.reduce((a,b)=>a+b.input,0);
                  const totalOut=logs.reduce((a,b)=>a+b.output,0);
                  const avgMerma=totalIn>0?((totalIn-totalOut)/totalIn*100).toFixed(1):0;
                  return (
                    <div key={n} className="bg-zinc-950 p-2 rounded border border-zinc-800 flex justify-between items-center text-[10px]">
                      <div><p className="font-bold text-white">{n}</p><p className="text-zinc-500">{totalIn}kg ➔ {totalOut}kg</p></div>
                      <div className={`font-black ${parseFloat(avgMerma)>22?'text-red-400':'text-green-400'}`}>{avgMerma}% merma</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TOP BUYERS */}
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-bold text-green-400 mb-3 uppercase tracking-widest flex items-center justify-between">
                <span>Mayores Compradores</span>
                <button onClick={()=>exportToCSV(clients.map(c=>{
                  const s=sales.filter(sl=>sl.clientName===c.fullName);
                  const total=s.reduce((a,b)=>a+b.cop,0);
                  const kgs=s.reduce((a,b)=>a+(b.kgSold*b.quantity),0);
                  return {Cliente:c.fullName, TotalCOP:total, Kilos:kgs, Visitas:s.length};
                }), 'Mayores_Compradores')} className="text-[10px] text-zinc-500 hover:text-white"><Download size={12}/></button>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {clients.length === 0 ? <p className="text-[10px] text-zinc-600">Sin ventas registradas aún.</p> : clients
                  .map(c => {
                    const s=sales.filter(sl=>sl.clientName===c.fullName);
                    const total=s.reduce((a,b)=>a+b.cop,0);
                    const kgs=s.reduce((a,b)=>a+(b.kgSold*b.quantity),0);
                    return { ...c, totalSales: total, totalKgs: kgs, visits: s.length };
                  })
                  .filter(c => c.visits > 0)
                  .sort((a,b) => b.totalSales - a.totalSales)
                  .map(c=>(
                    <div key={c.id} className="bg-zinc-950 p-2 rounded border border-zinc-800 flex justify-between items-center text-[10px]">
                      <div><p className="font-bold text-white">{c.fullName}</p><p className="text-zinc-500">{c.visits} compras • {c.totalKgs.toFixed(1)}kg</p></div>
                      <div className="font-black text-green-400">${c.totalSales.toLocaleString('es-CO')}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* CONVERSION HISTORY */}
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-bold text-blue-400 mb-3 uppercase tracking-widest flex items-center justify-between">
                <span>Historial de Conversión</span>
                <button onClick={()=>exportToCSV(processHistory, 'Historial_Procesos')} className="text-[10px] text-zinc-500 hover:text-white"><Download size={12}/></button>
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                   <div className="flex-1 bg-zinc-950 p-3 rounded-lg text-center border border-zinc-800">
                     <p className="text-[8px] text-zinc-500 uppercase">Trillado Total</p>
                     <p className="text-sm font-black text-white">{round2(processHistory.filter(l=>l.type==='trilla').reduce((a,b)=>a+b.input,0))}kg</p>
                   </div>
                   <div className="flex-1 bg-zinc-950 p-3 rounded-lg text-center border border-zinc-800">
                     <p className="text-[8px] text-zinc-500 uppercase">Tostado Total</p>
                     <p className="text-sm font-black text-white">{round2(processHistory.filter(l=>l.type==='tueste').reduce((a,b)=>a+b.output,0))}kg</p>
                   </div>
                </div>
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-400">Merma Promedio General:</span>
                  <span className="text-sm font-black text-white">
                    {processHistory.length > 0 ? (processHistory.reduce((acc, l) => acc + parseFloat(l.merma), 0) / processHistory.length).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* EXPORT ALL DATA */}
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-widest flex items-center gap-2"><Database size={12}/>Reportes Completos (Excel)</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={()=>exportToCSV(sales, 'Ventas_Completas')} className="bg-zinc-950 text-white p-2 rounded text-[10px] font-bold border border-zinc-800 hover:border-yellow-400/50">VENTAS.csv</button>
                <button onClick={()=>exportToCSV(purchases, 'Compras_Completas')} className="bg-zinc-950 text-white p-2 rounded text-[10px] font-bold border border-zinc-800 hover:border-yellow-400/50">COMPRAS.csv</button>
                <button onClick={()=>exportToCSV(expenses, 'Gastos_Completas')} className="bg-zinc-950 text-white p-2 rounded text-[10px] font-bold border border-zinc-800 hover:border-yellow-400/50">GASTOS.csv</button>
                <button onClick={()=>exportToCSV(processHistory, 'Procesos_Completas')} className="bg-zinc-950 text-white p-2 rounded text-[10px] font-bold border border-zinc-800 hover:border-yellow-400/50">PROCESOS.csv</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  //  MAIN RETURN
  // ============================================================
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 flex justify-center">
      <div className="w-full max-w-md bg-zinc-950 min-h-screen shadow-2xl flex flex-col relative border-x border-zinc-900">

        {/* HEADER */}
        <header className="bg-zinc-900 border-b border-yellow-500/30 p-4 flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded-xl shadow-[0_0_15px_rgba(250,204,21,0.3)] relative">
              {isSyncing && <Database size={12} className="absolute -top-1 -right-1 text-white animate-pulse"/>}
              <Coffee size={24} className="text-zinc-900"/>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-widest leading-none text-white">COLADOS</h1>
              <p className="text-[9px] text-zinc-400 tracking-[0.2em] mt-0.5 font-bold">BY HARVEY CÁRDENAS</p>
              <p className="text-[9px] text-yellow-400 tracking-[0.2em] font-bold">V7.2 · OFFLINE-FIRST PWA</p>
            </div>
          </div>
          <button onClick={()=>setShowSettings(true)} className="p-2 text-zinc-400 hover:text-yellow-400 bg-zinc-800 rounded-full transition-colors"><Settings size={20}/></button>
        </header>

        {/* ALERTA PEDIDOS */}
        {orders.length>0 && activeTab!=='ventas' && (
          <div onClick={()=>{setActiveTab('ventas');setVTab('pedidos');}} className="bg-yellow-400 text-zinc-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest flex justify-between items-center cursor-pointer z-10">
            <span className="flex items-center gap-2"><Bell size={13} className="animate-bounce"/>¡{orders.length} pedido{orders.length>1?'s':''} pendiente{orders.length>1?'s':''}!</span>
            <span className="underline">Revisar →</span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-24 bg-zinc-950">
          {activeTab==='ventas'  && renderVentas()}
          {activeTab==='compras' && renderCompras()}
          {activeTab==='fabrica' && renderFabrica()}
          {activeTab==='balance' && renderBalance()}
        </main>

        {/* TAB BAR */}
        <nav className="bg-zinc-950 border-t border-zinc-900 flex justify-around p-2 absolute bottom-0 w-full z-10" style={{paddingBottom:'max(0.5rem, env(safe-area-inset-bottom))'}}>
          {[{tab:'ventas',icon:<DollarSign size={22} strokeWidth={2.5}/>,label:'Ventas'},{tab:'compras',icon:<ShoppingCart size={22} strokeWidth={2.5}/>,label:'Compras'},{tab:'fabrica',icon:<Factory size={22} strokeWidth={2.5}/>,label:'Proceso'},{tab:'balance',icon:<Wallet size={22} strokeWidth={2.5}/>,label:'Balance'}].map(({tab,icon,label})=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} className={`flex flex-col items-center gap-1 w-16 transition-all duration-200 ${activeTab===tab?'text-yellow-400 -translate-y-1':'text-zinc-600'}`}>
              <div className={`p-1.5 rounded-xl ${activeTab===tab?'bg-yellow-400/10':''}`}>{icon}</div>
              <span className="text-[8px] font-bold tracking-wider uppercase">{label}</span>
            </button>
          ))}
        </nav>

        {/* MODAL CONFIGURACIÓN */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto p-4 pb-20 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-6 mt-4">
              <h2 className="text-lg font-black text-white tracking-widest flex items-center gap-2"><Settings size={20} className="text-yellow-400"/>CONFIGURACIÓN</h2>
              <button onClick={()=>setShowSettings(false)} className="bg-zinc-800 p-2 rounded-full text-white"><X size={20}/></button>
            </div>
            <div className="space-y-6">
              <div className="bg-zinc-900 p-4 rounded-xl border border-yellow-400/50">
                <h3 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2"><Database size={16}/>Respaldo Offline</h3>
                <p className="text-[10px] text-zinc-400 mb-4">Tu información vive en este dispositivo. Exporta un respaldo regularmente.</p>
                <div className="flex gap-3">
                  <button onClick={exportData} className="flex-1 bg-zinc-800 text-yellow-400 p-3 rounded-lg text-[10px] font-black border border-yellow-400/30 flex justify-center items-center gap-1"><Download size={14}/>EXPORTAR</button>
                  <label className="flex-1 bg-yellow-400 text-zinc-900 p-3 rounded-lg text-[10px] font-black flex justify-center items-center gap-1 cursor-pointer"><Save size={14}/>IMPORTAR<input type="file" accept=".json" className="hidden" onChange={importData}/></label>
                </div>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2"><Package size={16}/>Precios ($)</h3>
                {catalog.map(p=>(
                  <div key={p.id} className="flex justify-between items-center border-b border-zinc-800 py-2 last:border-0">
                    <span className="text-sm text-zinc-300">{p.name}</span>
                    {editingCatId===p.id?(
                      <div className="flex gap-2"><input type="number" step="0.01" value={editPrice} onChange={e=>setEditPrice(e.target.value)} className="w-16 bg-zinc-950 text-white border border-yellow-400 rounded px-1 text-sm text-center font-bold outline-none"/><button onClick={()=>{if(!editPrice)return;const nC=catalog.map(x=>x.id===p.id?{...x,price:parseFloat(editPrice)}:x);setCatalog(nC);guardarLocal({catalog:nC});setEditingCatId(null);setEditPrice('');}} className="bg-yellow-400 text-black px-3 rounded text-xs font-bold">✔</button></div>
                    ):(
                      <div className="flex items-center gap-3"><span className="text-sm font-bold text-white">${p.price}</span><button onClick={()=>{setEditingCatId(p.id);setEditPrice(p.price);}} className="text-zinc-500 hover:text-yellow-400"><Edit3 size={14}/></button></div>
                    )}
                  </div>
                ))}
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2"><Package size={16}/>Insumos Rápidos</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col"><label className="text-[9px] text-zinc-500 uppercase">Bolsas Kraft</label><input type="number" value={supplies.bolsas_kraft} onChange={e=>{const ns={...supplies,bolsas_kraft:parseInt(e.target.value)||0}; setSupplies(ns); guardarLocal({supplies:ns});}} className="p-2 bg-zinc-950 border border-zinc-800 rounded text-white font-bold text-sm text-center"/></div>
                  <div className="flex flex-col"><label className="text-[9px] text-zinc-500 uppercase">Bolsas Granel</label><input type="number" value={supplies.bolsas_granel} onChange={e=>{const ns={...supplies,bolsas_granel:parseInt(e.target.value)||0}; setSupplies(ns); guardarLocal({supplies:ns});}} className="p-2 bg-zinc-950 border border-zinc-800 rounded text-white font-bold text-sm text-center"/></div>
                  <div className="flex flex-col"><label className="text-[9px] text-zinc-500 uppercase">Etiquetas</label><input type="number" value={supplies.etiquetas||0} onChange={e=>{const ns={...supplies,etiquetas:parseInt(e.target.value)||0}; setSupplies(ns); guardarLocal({supplies:ns});}} className="p-2 bg-zinc-950 border border-zinc-800 rounded text-white font-bold text-sm text-center"/></div>
                </div>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2"><UserCheck size={16}/>Clientes</h3>
                {!showNewClientForm?(
                  <><button onClick={()=>setShowNewClientForm(true)} className="w-full mb-3 bg-zinc-800 text-yellow-400 text-xs font-bold p-3 rounded-lg border border-yellow-400/30 flex justify-center items-center gap-2"><Plus size={14}/>NUEVO CLIENTE</button>
                  <input type="text" placeholder="Buscar cliente..." value={filterClient} onChange={e=>setFilterClient(e.target.value)} className="w-full mb-3 p-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-white outline-none focus:border-yellow-400/50"/>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {clients.length===0?<p className="text-xs text-zinc-600">Sin clientes aún.</p>:clients
                      .filter(c => c.fullName.toLowerCase().includes(filterClient.toLowerCase()) || (c.business && c.business.toLowerCase().includes(filterClient.toLowerCase())))
                      .sort((a,b) => a.fullName.localeCompare(b.fullName))
                      .map(c=>{
                      const t=sales.filter(s=>s.clientName===c.fullName).reduce((a,b)=>a+b.cop,0);
                      return(
                        <div key={c.id} className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-white text-xs">{c.fullName}</p>
                            <p className="text-[9px] text-zinc-400">{c.business && `${c.business} • `}{c.sector} {c.phone && `• ${c.phone}`}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-yellow-400 mr-1">${t.toLocaleString('es-CO')}</p>
                            <button onClick={()=>{setNewClientData(c);setShowNewClientForm(true);}} className="text-zinc-600 hover:text-yellow-400"><Edit3 size={12}/></button>
                            <button onClick={()=>{const n=clients.filter(x=>x.id!==c.id);setClients(n);guardarLocal({clients:n});showToast('Cliente eliminado');}} className="text-zinc-800 hover:text-red-500"><Trash2 size={12}/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div></>
                ):(
                  <form onSubmit={e=>{
                    e.preventDefault();
                    if(!newClientData.fullName)return;
                    let nl;
                    if(newClientData.id){
                      nl = clients.map(x=>x.id===newClientData.id?newClientData:x);
                    } else {
                      nl = [{id:Date.now(),...newClientData}, ...clients];
                    }
                    setClients(nl); guardarLocal({clients:nl});
                    setNewClientData({fullName:'',business:'',sector:'',phone:''});
                    setShowNewClientForm(false); showToast(newClientData.id?'Cliente actualizado':'Cliente registrado');
                  }} className="space-y-2">
                    <input type="text" placeholder="Nombre *" required value={newClientData.fullName} onChange={e=>setNewClientData({...newClientData,fullName:e.target.value})} className="w-full p-2 bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none rounded text-sm text-white"/>
                    <input type="text" placeholder="Empresa/Local" value={newClientData.business} onChange={e=>setNewClientData({...newClientData,business:e.target.value})} className="w-full p-2 bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none rounded text-sm text-white"/>
                    <input type="text" placeholder="Sector *" required value={newClientData.sector} onChange={e=>setNewClientData({...newClientData,sector:e.target.value})} className="w-full p-2 bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none rounded text-sm text-white"/>
                    <input type="text" placeholder="Teléfono" value={newClientData.phone} onChange={e=>setNewClientData({...newClientData,phone:e.target.value})} className="w-full p-2 bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none rounded text-sm text-white"/>
                    <div className="flex gap-2"><button type="button" onClick={()=>{setShowNewClientForm(false);setNewClientData({fullName:'',business:'',sector:'',phone:''});}} className="flex-1 bg-zinc-800 text-white p-2 rounded text-xs font-bold">CANCELAR</button><button type="submit" className="flex-1 bg-yellow-400 text-black p-2 rounded text-xs font-bold">GUARDAR</button></div>
                  </form>
                )}
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2"><Flame size={16}/>Productores</h3>
                {!showNewProducerForm?(
                  <><button onClick={()=>setShowNewProducerForm(true)} className="w-full mb-3 bg-zinc-800 text-yellow-400 text-xs font-bold p-3 rounded-lg border border-yellow-400/30 flex justify-center items-center gap-2"><Plus size={14}/>NUEVO PRODUCTOR</button>
                  <input type="text" placeholder="Buscar productor..." value={filterProducer} onChange={e=>setFilterProducer(e.target.value)} className="w-full mb-3 p-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-white outline-none focus:border-yellow-400/50"/>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {producers.length===0?<p className="text-xs text-zinc-600">Sin productores aún.</p>:producers
                      .filter(p => {
                        const n=typeof p==='string'?p:p.name;
                        const f=typeof p==='string'?'':p.finca;
                        const s=typeof p==='string'?'':p.sector;
                        return n.toLowerCase().includes(filterProducer.toLowerCase()) || f.toLowerCase().includes(filterProducer.toLowerCase()) || (s && s.toLowerCase().includes(filterProducer.toLowerCase()));
                      })
                      .sort((a,b) => {
                        const nA=typeof a==='string'?a:a.name;
                        const nB=typeof b==='string'?b:b.name;
                        return nA.localeCompare(nB);
                      })
                      .map(p=>{
                      const n=typeof p==='string'?p:p.name;
                      const f=typeof p==='string'?'':p.finca;
                      return(
                        <div key={typeof p==='string'?p:p.id} className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 flex justify-between items-center">
                          <div><p className="font-bold text-white text-xs">{n}</p><p className="text-[9px] text-zinc-400">{f} {p.sector && `• ${p.sector}`} {p.phone && `• ${p.phone}`}</p></div>
                          <div className="flex gap-2">
                            <button onClick={()=>{setNewProducerData(p);setShowNewProducerForm(true);}} className="text-zinc-600 hover:text-yellow-400"><Edit3 size={12}/></button>
                            <button onClick={()=>{const n=producers.filter(x=>x.id!==p.id);setProducers(n);guardarLocal({producers:n});showToast('Productor eliminado');}} className="text-zinc-800 hover:text-red-500"><Trash2 size={12}/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div></>
                ):(
                  <form onSubmit={e=>{
                    e.preventDefault();
                    if(!newProducerData.name)return;
                    let nl;
                    if(newProducerData.id){
                      nl = producers.map(x=>x.id===newProducerData.id?newProducerData:x);
                    } else {
                      nl = [{id:Date.now(),...newProducerData}, ...producers];
                    }
                    setProducers(nl); guardarLocal({producers:nl});
                    setNewProducerData({name:'',finca:'',sector:'',phone:''});
                    setShowNewProducerForm(false); showToast(newProducerData.id?'Productor actualizado':'Productor registrado');
                  }} className="space-y-2">
                    <input type="text" placeholder="Nombre *" required value={newProducerData.name} onChange={e=>setNewProducerData({...newProducerData,name:e.target.value})} className="w-full p-2 bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none rounded text-sm text-white"/>
                    <input type="text" placeholder="Finca/Hacienda" value={newProducerData.finca} onChange={e=>setNewProducerData({...newProducerData,finca:e.target.value})} className="w-full p-2 bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none rounded text-sm text-white"/>
                    <input type="text" placeholder="Sector *" required value={newProducerData.sector} onChange={e=>setNewProducerData({...newProducerData,sector:e.target.value})} className="w-full p-2 bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none rounded text-sm text-white"/>
                    <input type="text" placeholder="Teléfono" value={newProducerData.phone} onChange={e=>setNewProducerData({...newProducerData,phone:e.target.value})} className="w-full p-2 bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none rounded text-sm text-white"/>
                    <div className="flex gap-2"><button type="button" onClick={()=>{setShowNewProducerForm(false);setNewProducerData({name:'',finca:'',sector:'',phone:''});}} className="flex-1 bg-zinc-800 text-white p-2 rounded text-xs font-bold">CANCELAR</button><button type="submit" className="flex-1 bg-yellow-400 text-black p-2 rounded text-xs font-bold">GUARDAR</button></div>
                  </form>
                )}
              </div>

              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2"><Package size={16}/>Inventario de Insumos</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 uppercase font-bold">Bolsas Kraft</p>
                    <input type="number" value={supplies.bolsas_kraft} onChange={e=>{const s={...supplies,bolsas_kraft:parseInt(e.target.value)||0}; setSupplies(s); guardarLocal({supplies:s});}} className="w-full bg-transparent text-white font-black text-lg outline-none"/>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 uppercase font-bold">Bolsas Granel</p>
                    <input type="number" value={supplies.bolsas_granel} onChange={e=>{const s={...supplies,bolsas_granel:parseInt(e.target.value)||0}; setSupplies(s); guardarLocal({supplies:s});}} className="w-full bg-transparent text-white font-black text-lg outline-none"/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 uppercase font-bold">Stickers G</p>
                    <input type="number" value={supplies.stickers_grandes} onChange={e=>{const s={...supplies,stickers_grandes:parseInt(e.target.value)||0}; setSupplies(s); guardarLocal({supplies:s});}} className="w-full bg-transparent text-white font-black text-lg outline-none"/>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 uppercase font-bold">Stickers P</p>
                    <input type="number" value={supplies.stickers_pequenos} onChange={e=>{const s={...supplies,stickers_pequenos:parseInt(e.target.value)||0}; setSupplies(s); guardarLocal({supplies:s});}} className="w-full bg-transparent text-white font-black text-lg outline-none"/>
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 mb-3">
                  <p className="text-[8px] text-zinc-500 uppercase font-bold text-center">Etiquetas de Lote</p>
                  <input type="number" value={supplies.etiquetas} onChange={e=>{const s={...supplies,etiquetas:parseInt(e.target.value)||0}; setSupplies(s); guardarLocal({supplies:s});}} className="w-full bg-transparent text-white font-black text-center text-sm outline-none"/>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <p className="text-[8px] text-zinc-500 uppercase font-bold text-center">Umbral de Alerta</p>
                  <input type="number" value={supplies.alerta_umbral} onChange={e=>{const s={...supplies,alerta_umbral:parseInt(e.target.value)||0}; setSupplies(s); guardarLocal({supplies:s});}} className="w-full bg-transparent text-yellow-400 font-black text-center text-sm outline-none"/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ABONAR */}
        {promptModal.isOpen && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl w-full max-w-sm shadow-2xl">
              <h3 className="text-yellow-400 font-bold mb-1 uppercase text-sm">Registrar Pago</h3>
              <p className="text-xs text-zinc-400 mb-4">Pendiente: <span className="font-bold text-white">${promptModal.maxAmount.toFixed(2)}</span></p>
              <input type="number" step="0.01" max={promptModal.maxAmount} value={promptModal.amount} onChange={e=>setPromptModal({...promptModal,amount:parseFloat(e.target.value)||0})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-bold text-lg mb-3 outline-none focus:border-yellow-400 text-center"/>
              <select value={promptModal.method} onChange={e=>setPromptModal({...promptModal,method:e.target.value})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-bold text-sm mb-4 outline-none">
                {paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={()=>setPromptModal({isOpen:false,id:null,type:null,method:'Efectivo COP',amount:0,maxAmount:0})} className="flex-1 bg-zinc-800 text-white p-3 rounded-lg text-xs font-bold">CANCELAR</button>
                <button onClick={()=>{
                  const {id,type,method,amount,maxAmount}=promptModal;
                  const pay=Math.min(isNaN(amount)||amount<=0?0:amount,maxAmount);
                  if(pay<=0){showToast('Monto inválido');return;}
                  if(type==='cxc'){const n=sales.map(s=>s.id===id?{...s,paidAmount:(s.paidAmount||0)+pay,isPaid:(s.paidAmount||0)+pay>=s.usd,method}:s);setSales(n);guardarLocal({sales:n});}
                  else{const n=purchases.map(p=>p.id===id?{...p,paidAmount:(p.paidAmount||0)+pay,isPaid:(p.paidAmount||0)+pay>=p.usd,method}:p);setPurchases(n);guardarLocal({purchases:n});}
                  setPromptModal({isOpen:false,id:null,type:null,method:'Efectivo COP',amount:0,maxAmount:0});
                  showToast(pay>=maxAmount?'✅ Deuda liquidada':'✅ Abono registrado');
                }} className="flex-1 bg-yellow-400 text-black p-3 rounded-lg text-xs font-bold hover:bg-yellow-300">CONFIRMAR</button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-zinc-800 border border-yellow-400 text-yellow-400 px-4 py-2 rounded-full shadow-lg z-50 text-xs font-bold text-center w-11/12 max-w-sm animate-in slide-in-from-top">
            {toast}
          </div>
        )}

        {/* MODAL FACTURA */}
        {invoiceModal.isOpen && invoiceModal.sale && (
          <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4 animate-in fade-in pb-10">
            <button onClick={()=>setInvoiceModal({isOpen:false,sale:null})} className="absolute top-6 right-6 text-zinc-400 hover:text-white bg-zinc-800 p-2 rounded-full"><X size={24}/></button>
            <div className="bg-[#09090b] border-4 border-yellow-400 rounded-2xl w-full max-w-sm p-6 shadow-[0_0_30px_rgba(250,204,21,0.2)]">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-zinc-950 rounded-full border-2 border-yellow-400 p-1">
                  <img src={logoBase64} alt="logo" className="w-full h-full rounded-full object-cover"/>
                </div>
              </div>
              <h2 className="text-yellow-400 text-3xl font-black tracking-widest text-center">COLADOS</h2>
              <p className="text-zinc-400 text-sm italic text-center mb-4">"Con el rico aroma al amanecer"</p>
              <div className="border-t-2 border-dashed border-zinc-700 my-3"/>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">Recibo:</span><span className="text-white font-bold">#{invoiceModal.sale.invoiceNum || invoiceModal.sale.id.toString().slice(-4)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Fecha:</span><span className="text-white font-bold">{invoiceModal.sale.date}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Cliente:</span><span className="text-yellow-400 font-bold">{invoiceModal.sale.clientName}</span></div>
              </div>
              <div className="border-t-2 border-dashed border-zinc-700 my-3"/>
              <div className="flex gap-2 text-white font-bold text-lg mb-3"><span>{invoiceModal.sale.quantity||1}x</span><span>{invoiceModal.sale.product}</span></div>
              <div className="border-t-2 border-dashed border-zinc-700 my-3"/>
              <div className="flex justify-between items-center mb-1"><span className="text-zinc-400 text-sm">TOTAL:</span><span className="text-green-400 text-2xl font-black">${invoiceModal.sale.cop.toLocaleString('es-CO')}</span></div>
              <div className="flex justify-between mb-1"><span className="text-zinc-400 text-sm">Ref USD:</span><span className="text-white font-bold">USD {invoiceModal.sale.usd.toFixed(2)}</span></div>
              <div className="flex justify-between mb-4"><span className="text-zinc-400 text-sm">Ref BS:</span><span className="text-white font-bold">Bs {invoiceModal.sale.bs.toFixed(2)}</span></div>
              <div className={`w-full py-2 rounded-lg text-center font-bold text-white text-sm ${invoiceModal.sale.isPaid?'bg-green-800':'bg-red-800'}`}>
                {invoiceModal.sale.method === 'Donación' ? 'DONACIÓN / CORTESÍA' : (invoiceModal.sale.isPaid?`PAGADO (${invoiceModal.sale.method})`:(invoiceModal.sale.paidAmount>0?`ABONO $${invoiceModal.sale.paidAmount.toLocaleString('es-CO')}`:'CRÉDITO PENDIENTE'))}
              </div>
              <p className="text-center text-[10px] text-zinc-600 mt-4 font-bold">App hecha por Harvey Cárdenas</p>
            </div>
            <div className="flex gap-3 w-full max-w-sm mt-5">
              <button onClick={()=>shareInvoiceText(invoiceModal.sale)} className="flex-1 bg-zinc-800 border border-yellow-400 text-yellow-400 p-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm"><Share2 size={16}/>Compartir</button>
              <button onClick={()=>downloadInvoiceImage(invoiceModal.sale)} className="flex-1 bg-yellow-400 text-zinc-900 p-3 rounded-xl font-black flex items-center justify-center gap-2 text-sm"><Download size={16}/>Guardar</button>
            </div>
          </div>
        )}

        {/* EDIT SALES MODAL */}
        {editingSale && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-zinc-900 w-full max-w-sm rounded-2xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><Edit3 size={18} className="text-yellow-400"/>Editar Venta</h3>
                <button onClick={()=>setEditingSale(null)} className="text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full"><X size={18}/></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Cliente</label>
                  <input type="text" value={editingSale.clientName} onChange={e=>setEditingSale({...editingSale, clientName: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-3 text-sm focus:border-yellow-400 outline-none transition-colors"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Cantidad</label>
                    <input type="number" value={editingSale.quantity} onChange={e=>setEditingSale({...editingSale, quantity: parseInt(e.target.value)||0})} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-3 text-sm outline-none"/>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Kilos/Unid</label>
                    <input type="number" step="0.01" value={editingSale.kgSold} onChange={e=>setEditingSale({...editingSale, kgSold: parseFloat(e.target.value)||0})} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-3 text-sm outline-none"/>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total COP</label>
                  <input type="number" value={editingSale.cop} onChange={e=>setEditingSale({...editingSale, cop: parseInt(e.target.value)||0, usd: (parseInt(e.target.value)||0)/rates.cop, bs: ((parseInt(e.target.value)||0)/rates.cop)*rates.bs})} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-3 text-sm outline-none"/>
                </div>
              </div>
              <button onClick={()=>updateSale(editingSale)} className="w-full bg-yellow-400 text-zinc-900 font-black p-4 rounded-xl text-sm tracking-widest hover:bg-yellow-300 transition-colors shadow-lg">GUARDAR CAMBIOS</button>
            </div>
          </div>
        )}

        {/* EDIT LOG MODAL */}
        {editingLog && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-zinc-900 w-full max-w-sm rounded-2xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><Factory size={18} className="text-blue-400"/>Editar Lote</h3>
                <button onClick={()=>setEditingLog(null)} className="text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full"><X size={18}/></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Entrada (Kg)</label>
                  <input type="number" step="0.01" value={editingLog.input} onChange={e=>{const i=parseFloat(e.target.value)||0; const m=i>0?((i-editingLog.output)/i*100).toFixed(1):0; setEditingLog({...editingLog, input: i, merma: m})}} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-3 text-sm outline-none transition-colors focus:border-blue-500"/>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Salida (Kg)</label>
                  <input type="number" step="0.01" value={editingLog.output} onChange={e=>{const o=parseFloat(e.target.value)||0; const m=editingLog.input>0?((editingLog.input-o)/editingLog.input*100).toFixed(1):0; setEditingLog({...editingLog, output: o, merma: m})}} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-3 text-sm outline-none transition-colors focus:border-blue-500"/>
                </div>
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">Nueva Merma Calculada</span>
                  <span className={`text-xl font-black ${parseFloat(editingLog.merma)>22?'text-red-500':'text-green-400'}`}>{editingLog.merma}%</span>
                </div>
              </div>
              <button onClick={()=>updateLog(editingLog)} className="w-full bg-blue-500 text-white font-black p-4 rounded-xl text-sm tracking-widest hover:bg-blue-400 transition-colors shadow-lg">GUARDAR CAMBIOS</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
