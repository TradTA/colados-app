import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  DollarSign,
  Minus,
  Package,
  Plus,
  Save,
  Scale,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { formatGrams, formatKg, formatWeightDual, toGrams } from '../utils/grams.js';
import {
  computeCartTotals,
  getClientDebtCop,
  normalizeCartItem,
} from '../utils/ledger.js';
import {
  copToBs,
  copToUsd,
  formatBS,
  formatCOP,
  formatDateDisplay,
  formatMoney,
  formatUSD,
  getTodayISO,
  roundCop,
  toCop,
} from '../utils/money.js';

const PAYMENT_METHODS = [
  'Efectivo COP',
  'Efectivo USD',
  'Efectivo BS',
  'Pago Móvil',
  'Bancolombia',
  'Binance',
];

export default function VentasTab({
  state,
  onUpdateRates,
  onRegisterSale,
  onCreateOrder,
  onDeleteOrder,
  isKeyboardOpen,
  isBottomSheetMinimized,
  onToggleBottomSheet,
  onNotify,
}) {
  const { rates, catalog, clients, sales, orders, inventoryGrams, displayCurrency } = state;
  const todayISO = getTodayISO();

  const [vTab, setVTab] = useState('venta');
  const [vDate, setVDate] = useState(todayISO);
  const [vClient, setVClient] = useState('');
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  // Granel por gramos variables
  const [showGranelBox, setShowGranelBox] = useState(false);
  const [granelGrams, setGranelGrams] = useState('250');
  const [granelPackType, setGranelPackType] = useState('transparente');
  const [granelPriceCop, setGranelPriceCop] = useState('10000');

  // Pago y vuelto
  const [paymentMode, setPaymentMode] = useState('contado'); // 'contado' | 'credito' | 'donacion'
  const [vMethod, setVMethod] = useState('Efectivo COP');
  const [receivedInput, setReceivedInput] = useState('');
  const [receivedCurrency, setReceivedCurrency] = useState('COP');
  const [applyExcessToDebt, setApplyExcessToDebt] = useState(true);

  // Pedidos agendados
  const [orderDate, setOrderDate] = useState(todayISO);
  const [orderProductId, setOrderProductId] = useState('');
  const [orderQty, setOrderQty] = useState(1);
  const [orderRecurring, setOrderRecurring] = useState(false);

  const sortedClients = useMemo(
    () => clients.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [clients]
  );

  const cartTotals = useMemo(() => computeCartTotals(cart), [cart]);
  const previousDebtCop = useMemo(
    () => (vClient.trim() ? getClientDebtCop(sales, vClient) : 0),
    [sales, vClient]
  );

  const baseKgPriceCop = useMemo(() => {
    const kiloItem = catalog.find((c) => c.grams === 1000);
    if (kiloItem && kiloItem.priceCop > 0) return kiloItem.priceCop;
    return 40000;
  }, [catalog]);

  // Cálculos de pago, vuelto y deuda acumulada
  const receivedCop = useMemo(() => {
    if (paymentMode === 'credito' || paymentMode === 'donacion') return 0;
    if (receivedInput === '' || receivedInput === null) return cartTotals.totalCop;
    return toCop(receivedInput, receivedCurrency, rates);
  }, [paymentMode, receivedInput, receivedCurrency, rates, cartTotals.totalCop]);

  const changeCop = useMemo(() => {
    if (paymentMode !== 'contado') return 0;
    return Math.max(0, receivedCop - cartTotals.totalCop);
  }, [paymentMode, receivedCop, cartTotals.totalCop]);

  const balanceDueThisOrderCop = useMemo(() => {
    if (paymentMode === 'donacion') return 0;
    if (paymentMode === 'credito') return cartTotals.totalCop;
    return Math.max(0, cartTotals.totalCop - receivedCop);
  }, [paymentMode, cartTotals.totalCop, receivedCop]);

  const excessForOldDebtCop = useMemo(() => {
    if (paymentMode !== 'contado' || !applyExcessToDebt || previousDebtCop <= 0) return 0;
    return Math.min(previousDebtCop, changeCop);
  }, [paymentMode, applyExcessToDebt, previousDebtCop, changeCop]);

  const finalChangeToCustomerCop = Math.max(0, changeCop - excessForOldDebtCop);
  const totalAccumulatedAfterCop = Math.max(
    0,
    previousDebtCop - excessForOldDebtCop + balanceDueThisOrderCop
  );

  const exceedsRoastedStock = cartTotals.totalGrams > (inventoryGrams?.tostado || 0);

  const addCatalogProduct = (product) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (item) => item.catalogId === product.id && !item.isCustomGranel
      );
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? normalizeCartItem({ ...item, quantity: item.quantity + 1 }) : item
        );
      }
      return [
        ...prev,
        normalizeCartItem({
          catalogId: product.id,
          name: product.name,
          packType: product.packType,
          hasLabel: product.hasLabel,
          gramsPerUnit: product.grams,
          unitPriceCop: product.priceCop,
          quantity: 1,
          stickerType: product.packType === 'especial' ? 'grande' : 'ninguno',
        }),
      ];
    });
  };

  const handleGranelGramsChange = (val) => {
    setGranelGrams(val);
    const g = toGrams(val, 'g');
    if (g > 0) {
      const est = Math.round(((baseKgPriceCop / 1000) * g) / 100) * 100;
      setGranelPriceCop(String(est));
    }
  };

  const handleAddGranelItem = () => {
    const grams = toGrams(granelGrams, 'g');
    const price = roundCop(granelPriceCop);
    if (grams <= 0 || price < 0) {
      onNotify?.('⚠️ Ingresa gramos válidos para el granel');
      return;
    }
    const labelType = granelPackType === 'especial' ? 'Bolsa Especial' : 'Granel';
    setCart((prev) => [
      ...prev,
      normalizeCartItem({
        catalogId: null,
        name: `${grams}g (${labelType})`,
        packType: granelPackType,
        hasLabel: granelPackType === 'especial',
        gramsPerUnit: grams,
        unitPriceCop: price,
        quantity: 1,
        stickerType: granelPackType === 'especial' ? 'grande' : 'ninguno',
        isCustomGranel: true,
      }),
    ]);
    setShowGranelBox(false);
  };

  const updateCartItemQty = (lineId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.lineId !== lineId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return normalizeCartItem({ ...item, quantity: nextQty });
        })
        .filter(Boolean)
    );
  };

  const updateCartItemSticker = (lineId, stickerType) => {
    setCart((prev) =>
      prev.map((item) => (item.lineId === lineId ? { ...item, stickerType } : item))
    );
  };

  const removeCartItem = (lineId) => {
    setCart((prev) => prev.filter((item) => item.lineId !== lineId));
  };

  const handleSubmitSale = (e) => {
    e?.preventDefault();
    if (!vClient.trim()) {
      onNotify?.('⚠️ Selecciona o escribe un cliente');
      return;
    }
    if (cart.length === 0) {
      onNotify?.('⚠️ Agrega al menos un producto al carrito');
      return;
    }

    onRegisterSale({
      dateISO: vDate || todayISO,
      clientName: vClient.trim(),
      items: cart,
      method: paymentMode === 'donacion' ? 'Donación' : vMethod,
      isCredit: paymentMode === 'credito',
      isDonation: paymentMode === 'donacion',
      paidNowCop: paymentMode === 'contado' ? receivedCop : 0,
      excessToDebtCop: excessForOldDebtCop,
      previousDebtCop,
      activeOrder,
    });

    setCart([]);
    setVClient('');
    setReceivedInput('');
    setPaymentMode('contado');
    setActiveOrder(null);
  };

  const handleSubmitOrder = (e) => {
    e.preventDefault();
    const product = catalog.find((c) => String(c.id) === String(orderProductId));
    if (!vClient.trim() || !product) {
      onNotify?.('⚠️ Selecciona cliente y presentación');
      return;
    }
    onCreateOrder({
      clientName: vClient.trim(),
      productId: product.id,
      product: product.name,
      gramsPerUnit: product.grams,
      unitPriceCop: product.priceCop,
      packType: product.packType,
      hasLabel: product.hasLabel,
      quantity: Math.max(1, Math.round(Number(orderQty) || 1)),
      isoDate: orderDate || todayISO,
      isRecurring: orderRecurring,
    });
    setVClient('');
    setOrderProductId('');
    setOrderQty(1);
    setOrderRecurring(false);
    setVTab('pedidos');
  };

  const handleDispatchOrder = (order) => {
    const catalogMatch =
      catalog.find((c) => c.id === order.productId) ||
      catalog.find((c) => c.name === order.product);

    const item = normalizeCartItem({
      catalogId: catalogMatch?.id ?? order.productId ?? null,
      name: catalogMatch?.name || order.product,
      packType: catalogMatch?.packType || order.packType || 'especial',
      hasLabel: catalogMatch?.hasLabel ?? order.hasLabel ?? true,
      gramsPerUnit: catalogMatch?.grams || order.gramsPerUnit || 200,
      unitPriceCop: catalogMatch?.priceCop ?? order.unitPriceCop ?? 15000,
      quantity: Math.max(1, Math.round(Number(order.quantity) || 1)),
      stickerType: (catalogMatch?.packType || order.packType) === 'especial' ? 'grande' : 'ninguno',
    });

    setVClient(order.clientName);
    setCart([item]);
    setActiveOrder(order);
    setPaymentMode('contado');
    setReceivedInput('');
    setVTab('venta');
  };

  const totalOrderGrams = orders.reduce(
    (acc, o) => acc + (Number(o.gramsPerUnit) || 200) * (Number(o.quantity) || 1),
    0
  );

  return (
    <div className="p-4 space-y-4 animate-in fade-in pb-44">
      {/* Sub-tabs */}
      <div className="flex theme-card p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setVTab('venta')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            vTab === 'venta' ? 'theme-accent-bg shadow-sm' : 'theme-muted'
          }`}
        >
          <DollarSign size={14} />
          DESPACHO
        </button>
        <button
          type="button"
          onClick={() => setVTab('pedidos')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg relative transition-all flex items-center justify-center gap-1.5 ${
            vTab === 'pedidos' ? 'theme-accent-bg shadow-sm' : 'theme-muted'
          }`}
        >
          <ClipboardList size={14} />
          PEDIDOS ({orders.length})
          {orders.length > 0 && (
            <span className="absolute top-1.5 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>
      </div>

      {vTab === 'venta' ? (
        <>
          {/* Tasas de cambio */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="theme-card p-2.5 rounded-xl text-center">
              <p className="text-[10px] font-bold theme-muted uppercase">TRM (USD / COP)</p>
              <input
                type="number"
                step="10"
                value={rates.usd_cop}
                onChange={(e) => onUpdateRates({ ...rates, usd_cop: parseFloat(e.target.value) || 0 })}
                className="w-full font-black text-base theme-accent-text bg-transparent outline-none text-center mt-0.5"
              />
            </div>
            <div className="theme-card p-2.5 rounded-xl text-center">
              <p className="text-[10px] font-bold theme-muted uppercase">Tasa (COP / BS)</p>
              <input
                type="number"
                step="0.001"
                value={rates.cop_bs}
                onChange={(e) => onUpdateRates({ ...rates, cop_bs: parseFloat(e.target.value) || 0 })}
                className="w-full font-black text-base theme-accent-text bg-transparent outline-none text-center mt-0.5"
              />
            </div>
          </div>

          {/* Banner pedido agendado */}
          {activeOrder && (
            <div className="theme-accent-soft p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold flex items-center gap-2">
                <CheckSquare size={16} />
                Cumpliendo pedido de {activeOrder.clientName}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveOrder(null);
                  setCart([]);
                  setVClient('');
                }}
                className="text-xs font-black underline"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Fecha y Cliente */}
          <div className="theme-card p-3.5 rounded-2xl space-y-3">
            <div className="grid grid-cols-12 gap-2.5">
              <div className="col-span-5">
                <label className="text-[10px] font-bold uppercase theme-muted block">Fecha</label>
                <input
                  type="date"
                  value={vDate}
                  onChange={(e) => setVDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                />
              </div>
              <div className="col-span-7">
                <label className="text-[10px] font-bold uppercase theme-muted block">Cliente</label>
                <input
                  list="clients-list-v8"
                  value={vClient}
                  onChange={(e) => setVClient(e.target.value)}
                  placeholder="Buscar o escribir cliente..."
                  className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-semibold"
                />
                <datalist id="clients-list-v8">
                  {sortedClients.map((c) => (
                    <option key={c.id} value={c.fullName} />
                  ))}
                  <option value="Cliente Ocasional" />
                </datalist>
              </div>
            </div>

            {/* Tarjeta obligatoria de Deuda Anterior + Pedido Actual */}
            {previousDebtCop > 0 && (
              <div className="p-3 rounded-xl theme-danger-soft border border-red-300/60 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-extrabold">
                  <span>⚠️ Cuenta Acumulada ({vClient.trim()})</span>
                  <span>{formatCOP(previousDebtCop + cartTotals.totalCop)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-red-300/40">
                  <div>
                    <span className="block opacity-80">Deuda Anterior</span>
                    <span className="font-black">{formatCOP(previousDebtCop)}</span>
                  </div>
                  <div>
                    <span className="block opacity-80">Pedido de Hoy</span>
                    <span className="font-black">{formatCOP(cartTotals.totalCop)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block opacity-80">Total Acumulado</span>
                    <span className="font-black">{formatCOP(previousDebtCop + cartTotals.totalCop)}</span>
                  </div>
                </div>
                <p className="text-[10px] opacity-85">
                  Ref: {formatUSD(copToUsd(previousDebtCop + cartTotals.totalCop, rates))} ·{' '}
                  {formatBS(copToBs(previousDebtCop + cartTotals.totalCop, rates))}
                </p>
              </div>
            )}
          </div>

          {/* Catálogo multi-producto */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase tracking-wider theme-muted">
                Catálogo Rápido (Toca para sumar)
              </p>
              <span className="text-[11px] font-bold theme-muted">
                Tostado disp: <strong className="theme-accent-text">{formatWeightDual(inventoryGrams?.tostado || 0)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {catalog.map((p) => {
                const qtyInCart = cart
                  .filter((c) => c.catalogId === p.id && !c.isCustomGranel)
                  .reduce((sum, c) => sum + c.quantity, 0);
                const isEspecial = p.packType === 'especial';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addCatalogProduct(p)}
                    className={`theme-card p-3 rounded-xl text-left transition-all active:scale-[0.98] relative ${
                      qtyInCart > 0 ? 'ring-2 ring-amber-500' : ''
                    }`}
                  >
                    {qtyInCart > 0 && (
                      <span className="absolute -top-2 -right-2 theme-accent-bg text-[11px] font-black px-2 py-0.5 rounded-full shadow">
                        {qtyInCart}x
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          isEspecial ? 'theme-accent-soft' : 'theme-info-soft'
                        }`}
                      >
                        {isEspecial ? 'Especial · Etiqueta' : 'Transparente'}
                      </span>
                      <span className="text-[10px] font-bold theme-muted">{p.grams}g</span>
                    </div>
                    <p className="text-xs font-extrabold leading-tight truncate">{p.name}</p>
                    <p className="text-xs font-black theme-success-text mt-1">
                      {formatCOP(p.priceCop)}
                    </p>
                    {displayCurrency !== 'COP' && (
                      <p className="text-[10px] theme-muted">
                        {formatMoney(p.priceCop, displayCurrency, rates)}
                      </p>
                    )}
                  </button>
                );
              })}

              {/* Botón granel variable */}
              <button
                type="button"
                onClick={() => setShowGranelBox((v) => !v)}
                className="theme-subtle p-3 rounded-xl text-left border-dashed flex flex-col justify-between"
              >
                <span className="text-[9px] font-black uppercase theme-accent-text flex items-center gap-1">
                  <Scale size={12} /> Peso Variable
                </span>
                <p className="text-xs font-extrabold mt-1">Granel por Gramos</p>
                <p className="text-[10px] theme-muted mt-0.5">
                  {showGranelBox ? 'Cerrar formulario ▲' : '+ Ingresar gramos ▼'}
                </p>
              </button>
            </div>

            {/* Formulario rápido de granel */}
            {showGranelBox && (
              <div className="theme-card p-3.5 rounded-xl space-y-3 border-2 border-amber-500/40">
                <p className="text-xs font-extrabold flex items-center gap-1.5">
                  <Scale size={14} className="theme-accent-text" />
                  Venta rápida por gramos
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">Gramos (g)</label>
                    <input
                      type="number"
                      min="1"
                      value={granelGrams}
                      onChange={(e) => handleGranelGramsChange(e.target.value)}
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">Empaque</label>
                    <select
                      value={granelPackType}
                      onChange={(e) => setGranelPackType(e.target.value)}
                      className="w-full p-2 rounded-lg theme-input text-xs font-bold mt-1"
                    >
                      <option value="transparente">Transparente</option>
                      <option value="especial">Bolsa Especial</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted">Precio COP</label>
                    <input
                      type="number"
                      step="100"
                      value={granelPriceCop}
                      onChange={(e) => setGranelPriceCop(e.target.value)}
                      className="w-full p-2 rounded-lg theme-input text-xs font-black mt-1"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddGranelItem}
                  className="w-full theme-accent-bg py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Agregar {granelGrams || 0}g al Carrito
                </button>
              </div>
            )}
          </div>

          {/* Carrito multi-producto */}
          <div className="theme-card p-3.5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingCart size={15} className="theme-accent-text" />
                Carrito ({cartTotals.totalUnits} uds · {formatWeightDual(cartTotals.totalGrams)})
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[11px] font-bold theme-danger-text"
                >
                  Vaciar
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <p className="text-xs theme-muted text-center py-4">
                Toca productos del catálogo para armar el pedido.
              </p>
            ) : (
              <div className="space-y-2.5">
                {cart.map((item) => (
                  <div
                    key={item.lineId}
                    className="theme-subtle p-2.5 rounded-xl space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs font-extrabold">{item.name}</p>
                        <p className="text-[10px] theme-muted">
                          {item.packType === 'especial' ? 'Bolsa Especial (Con Etiqueta)' : 'Transparente / Granel (Sin Etiqueta)'} ·{' '}
                          {formatGrams(item.totalGrams)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black theme-success-text">
                          {formatCOP(item.lineTotalCop)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.lineId)}
                          className="theme-muted hover:text-red-500 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(item.lineId, -1)}
                          className="theme-card w-7 h-7 rounded-lg flex items-center justify-center font-black"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-xs font-black">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(item.lineId, 1)}
                          className="theme-card w-7 h-7 rounded-lg flex items-center justify-center font-black"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {[
                          { key: 'grande', label: 'Sticker G' },
                          { key: 'pequeño', label: 'Sticker P' },
                          { key: 'ninguno', label: 'Sin' },
                        ].map((st) => (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => updateCartItemSticker(item.lineId, st.key)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border ${
                              item.stickerType === st.key
                                ? 'theme-accent-bg border-transparent'
                                : 'theme-card theme-muted'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {exceedsRoastedStock && (
                  <div className="p-2.5 rounded-xl theme-danger-soft text-[11px] font-bold flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>
                      El carrito ({formatKg(cartTotals.totalGrams)}) supera el stock tostado ({formatKg(inventoryGrams?.tostado || 0)}).
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pago, Vuelto y Saldo */}
          {cart.length > 0 && (
            <form onSubmit={handleSubmitSale} className="theme-card p-3.5 rounded-2xl space-y-3">
              <p className="text-xs font-black uppercase tracking-wider theme-muted">
                Pago, Vuelto y Saldo
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'contado', label: 'Pago / Abono' },
                  { id: 'credito', label: 'A Crédito' },
                  { id: 'donacion', label: 'Donación' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMode(m.id)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-extrabold border ${
                      paymentMode === m.id ? 'theme-accent-bg border-transparent' : 'theme-subtle theme-muted'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {paymentMode === 'contado' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase theme-muted block">
                      Forma de Pago
                    </label>
                    <select
                      value={vMethod}
                      onChange={(e) => setVMethod(e.target.value)}
                      className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase theme-muted">
                        Monto Pagado / Recibido
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReceivedCurrency('COP');
                            setReceivedInput(String(cartTotals.totalCop));
                          }}
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded theme-accent-soft"
                        >
                          Exacto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReceivedCurrency('COP');
                            setReceivedInput('0');
                          }}
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded theme-subtle"
                        >
                          $0
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <select
                        value={receivedCurrency}
                        onChange={(e) => setReceivedCurrency(e.target.value)}
                        className="col-span-4 p-2.5 rounded-xl theme-input text-xs font-black"
                      >
                        <option value="COP">COP</option>
                        <option value="USD">USD</option>
                        <option value="BS">BS</option>
                      </select>
                      <input
                        type="number"
                        step="any"
                        value={receivedInput}
                        onChange={(e) => setReceivedInput(e.target.value)}
                        placeholder={
                          receivedCurrency === 'COP'
                            ? String(cartTotals.totalCop)
                            : receivedCurrency === 'USD'
                              ? String(copToUsd(cartTotals.totalCop, rates))
                              : String(copToBs(cartTotals.totalCop, rates))
                        }
                        className="col-span-8 p-2.5 rounded-xl theme-input text-sm font-black"
                      />
                    </div>
                  </div>

                  {/* Resultado Vuelto vs Saldo */}
                  {changeCop > 0 ? (
                    <div className="p-3 rounded-xl theme-success-soft space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-black">
                        <span>Cambio / Vuelto:</span>
                        <span>{formatCOP(finalChangeToCustomerCop)}</span>
                      </div>
                      <p className="text-[10px]">
                        {formatUSD(copToUsd(finalChangeToCustomerCop, rates))} ·{' '}
                        {formatBS(copToBs(finalChangeToCustomerCop, rates))}
                      </p>
                      {previousDebtCop > 0 && (
                        <label className="flex items-center gap-2 text-[11px] font-bold pt-1 border-t border-emerald-400/30 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={applyExcessToDebt}
                            onChange={(e) => setApplyExcessToDebt(e.target.checked)}
                          />
                          Abonar {formatCOP(excessForOldDebtCop)} del excedente a deuda anterior
                        </label>
                      )}
                    </div>
                  ) : balanceDueThisOrderCop > 0 ? (
                    <div className="p-3 rounded-xl theme-danger-soft space-y-1">
                      <div className="flex justify-between items-center text-xs font-black">
                        <span>Saldo Restante a Deuda (hoy):</span>
                        <span>{formatCOP(balanceDueThisOrderCop)}</span>
                      </div>
                      <p className="text-[10px]">
                        {formatUSD(copToUsd(balanceDueThisOrderCop, rates))} ·{' '}
                        {formatBS(copToBs(balanceDueThisOrderCop, rates))}
                      </p>
                    </div>
                  ) : null}
                </>
              )}

              {paymentMode === 'credito' && (
                <div className="p-3 rounded-xl theme-danger-soft text-xs font-bold">
                  Se cargará completo a Por Cobrar: {formatCOP(cartTotals.totalCop)}.
                  {previousDebtCop > 0 && (
                    <span className="block mt-1">
                      Nuevo saldo total del cliente: {formatCOP(totalAccumulatedAfterCop)}
                    </span>
                  )}
                </div>
              )}

              {paymentMode === 'donacion' && (
                <div className="p-3 rounded-xl theme-info-soft text-xs font-bold">
                  Se registrará como cortesía/donación (descuenta café e insumos sin sumar ingresos ni deuda).
                </div>
              )}

              <button
                type="submit"
                className="w-full theme-accent-bg py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow"
              >
                <Plus size={18} />
                REGISTRAR VENTA
              </button>
            </form>
          )}
        </>
      ) : (
        /* SUB-TAB PEDIDOS */
        <div className="space-y-4">
          <div className="theme-card p-4 rounded-2xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text">
              <ClipboardList size={15} /> Agendar Nuevo Pedido
            </h3>
            <form onSubmit={handleSubmitOrder} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted">Fecha entrega</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase theme-muted">Cliente</label>
                  <input
                    list="clients-list-orders-v8"
                    value={vClient}
                    onChange={(e) => setVClient(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs"
                    required
                  />
                  <datalist id="clients-list-orders-v8">
                    {sortedClients.map((c) => (
                      <option key={c.id} value={c.fullName} />
                    ))}
                    <option value="Cliente Ocasional" />
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-8">
                  <label className="text-[10px] font-bold uppercase theme-muted">Presentación</label>
                  <select
                    value={orderProductId}
                    onChange={(e) => setOrderProductId(e.target.value)}
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
                    required
                  >
                    <option value="">Selecciona producto...</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.grams}g)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  <label className="text-[10px] font-bold uppercase theme-muted">Cant.</label>
                  <input
                    type="number"
                    min="1"
                    value={orderQty}
                    onChange={(e) => setOrderQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-black text-center"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={orderRecurring}
                  onChange={(e) => setOrderRecurring(e.target.checked)}
                />
                Repetir semanalmente al despachar
              </label>

              <button
                type="submit"
                className="w-full theme-accent-bg py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              >
                <Save size={15} /> GUARDAR PEDIDO
              </button>
            </form>
          </div>

          {orders.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="theme-card p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold uppercase theme-muted">Café x Procesar</p>
                  <p className="text-sm font-black">{formatWeightDual(totalOrderGrams)}</p>
                </div>
                <div className="theme-card p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold uppercase theme-muted">Total Paquetes</p>
                  <p className="text-sm font-black theme-accent-text">
                    {orders.reduce((acc, o) => acc + (Number(o.quantity) || 1), 0)} uds
                  </p>
                </div>
              </div>

              {orders.map((o) => (
                <div
                  key={o.id}
                  className="theme-card p-3.5 rounded-2xl border-l-4 border-l-amber-500 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-extrabold flex items-center gap-1.5">
                        {o.clientName}
                        {o.isRecurring && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded theme-accent-soft uppercase">
                            Semanal
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] theme-muted">
                        Para: <strong>{o.date || formatDateDisplay(o.isoDate)}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteOrder(o.id)}
                      className="theme-muted hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t theme-border">
                    <p className="text-xs font-black">
                      {o.quantity}x {o.product}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDispatchOrder(o)}
                      className="theme-accent-bg px-3 py-1.5 rounded-lg text-[11px] font-black"
                    >
                      ¡DESPACHAR!
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Panel inferior retráctil (Bottom Sheet) de totales — se oculta al abrir teclado y se minimiza al bajar scroll */}
      {vTab === 'venta' && !isKeyboardOpen && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md px-3 z-20 pointer-events-none">
          <div className="theme-card rounded-2xl border-2 border-amber-500/40 shadow-xl pointer-events-auto transition-all duration-200">
            {isBottomSheetMinimized ? (
              <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onToggleBottomSheet}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  <ChevronUp size={16} className="theme-accent-text shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-black">
                      {formatCOP(cartTotals.totalCop)}
                    </span>
                    <span className="text-[10px] theme-muted ml-2">
                      {cartTotals.totalUnits} uds · {formatKg(cartTotals.totalGrams)}
                    </span>
                  </div>
                </button>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSubmitSale}
                    className="theme-accent-bg px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0"
                  >
                    Registrar
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold theme-muted">
                    <Package size={13} className="theme-accent-text" />
                    <span>
                      {cartTotals.totalUnits} uds · {formatWeightDual(cartTotals.totalGrams)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleBottomSheet}
                    className="theme-muted p-1 rounded-lg"
                    title="Minimizar panel"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="theme-subtle p-1.5 rounded-xl">
                    <span className="text-[9px] font-bold uppercase theme-muted block">COP</span>
                    <span className="text-xs font-black theme-success-text">
                      {formatCOP(cartTotals.totalCop)}
                    </span>
                  </div>
                  <div className="theme-subtle p-1.5 rounded-xl">
                    <span className="text-[9px] font-bold uppercase theme-muted block">USD</span>
                    <span className="text-xs font-black">
                      {formatUSD(copToUsd(cartTotals.totalCop, rates))}
                    </span>
                  </div>
                  <div className="theme-subtle p-1.5 rounded-xl">
                    <span className="text-[9px] font-bold uppercase theme-muted block">BS</span>
                    <span className="text-xs font-black">
                      {formatBS(copToBs(cartTotals.totalCop, rates))}
                    </span>
                  </div>
                </div>

                {previousDebtCop > 0 && (
                  <div className="flex justify-between items-center text-[11px] font-extrabold px-1">
                    <span className="theme-danger-text">Total Acumulado c/Deuda:</span>
                    <span className="theme-danger-text">
                      {formatCOP(totalAccumulatedAfterCop)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
