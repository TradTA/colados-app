import React, { useEffect, useState } from 'react';
import { Copy, Download, Edit3, Factory, Share2, X } from 'lucide-react';
import { logoBase64 } from '../assets/logoBase64.js';
import { calcMermaPct, formatWeightDual, toGrams } from '../utils/grams.js';
import { getClientDebtCop, normalizeCartItem } from '../utils/ledger.js';
import {
  copToBs,
  copToUsd,
  formatBS,
  formatCOP,
  formatDateDisplay,
  formatUSD,
  getTodayISO,
  roundCop,
  toCop,
} from '../utils/money.js';
import {
  buildClientStatementWhatsAppText,
  buildSaleWhatsAppText,
  downloadOrShareReceiptImage,
  shareTextToWhatsAppOrClipboard,
} from '../utils/receipt.js';

const PAYMENT_METHODS = [
  'Efectivo COP',
  'Efectivo USD',
  'Efectivo BS',
  'Pago Móvil',
  'Bancolombia',
  'Binance',
];

export function ReceiptModal({ modal, sales, rates, onClose, onNotify }) {
  if (!modal?.isOpen) return null;
  const { sale, statement } = modal;
  const isStatement = Boolean(statement);

  const currentClientDebtCop = !isStatement && sale
    ? getClientDebtCop(sales, sale.clientName)
    : roundCop(statement?.debtCop);

  const textSummary = isStatement
    ? buildClientStatementWhatsAppText(statement, rates)
    : buildSaleWhatsAppText(sale, currentClientDebtCop, rates);

  const handleShareText = async () => {
    try {
      const res = await shareTextToWhatsAppOrClipboard(
        textSummary,
        isStatement ? 'Estado de Cuenta Colados' : 'Recibo Colados'
      );
      onNotify?.(
        res.method === 'clipboard'
          ? '¡Resumen copiado! Pégalo en WhatsApp.'
          : '¡Resumen compartido!'
      );
    } catch {
      onNotify?.('No se pudo compartir ni copiar el resumen.');
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(textSummary);
      onNotify?.('¡Resumen copiado para WhatsApp!');
    } catch {
      onNotify?.('No se pudo copiar al portapapeles.');
    }
  };

  const handleDownloadImage = async () => {
    try {
      const res = await downloadOrShareReceiptImage({
        sale,
        statement,
        rates,
        currentClientDebtCop,
      });
      onNotify?.(res.native ? 'Imagen lista para compartir' : 'Imagen descargada');
    } catch {
      onNotify?.('Error generando imagen del recibo');
    }
  };

  const items = isStatement
    ? (statement.pendingSales || [])
    : (Array.isArray(sale?.items) && sale.items.length > 0 ? sale.items : []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-sm space-y-3 my-auto">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="theme-card p-2 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-[#FBF9F5] text-[#2C1E16] border-4 border-[#D97706] rounded-2xl p-5 shadow-2xl space-y-3">
          <div className="flex justify-center">
            <img
              src={logoBase64}
              alt="Colados"
              className="w-16 h-16 rounded-full border-2 border-[#D97706] object-cover"
            />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black tracking-widest">COLADOS</h2>
            <p className="text-xs italic text-[#6E5A4F]">
              {isStatement ? 'Estado de Cuenta por Cobrar' : '"Con el rico aroma al amanecer"'}
            </p>
          </div>

          <div className="border-t border-dashed border-[#D6CBBF] pt-2.5 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[#6E5A4F]">{isStatement ? 'Tipo:' : 'Recibo:'}</span>
              <span className="font-bold">
                {isStatement ? 'RESUMEN ACUMULADO' : `#${sale.invoiceNum}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6E5A4F]">Fecha:</span>
              <span className="font-bold">
                {isStatement ? formatDateDisplay(getTodayISO()) : sale.date}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6E5A4F]">Cliente:</span>
              <span className="font-black text-[#B45309]">
                {isStatement ? statement.clientName : sale.clientName}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-[#D6CBBF] pt-2.5 space-y-1.5">
            {isStatement
              ? items.map((s) => (
                  <div key={s.id} className="flex justify-between text-xs gap-2">
                    <span className="truncate">
                      #{s.invoiceNum} ({s.date})
                    </span>
                    <span className="font-black shrink-0">{formatCOP(s.balanceDueCop)}</span>
                  </div>
                ))
              : items.map((it, idx) => (
                  <div key={it.lineId || idx} className="flex justify-between text-xs gap-2">
                    <span>
                      {it.quantity}x {it.name}
                    </span>
                    <span className="font-black shrink-0">{formatCOP(it.lineTotalCop)}</span>
                  </div>
                ))}
          </div>

          <div className="border-t border-dashed border-[#D6CBBF] pt-2.5 space-y-1 text-xs">
            {!isStatement && roundCop(sale.previousDebtCop) > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-[#6E5A4F]">Deuda Anterior:</span>
                  <span className="font-bold text-red-600">{formatCOP(sale.previousDebtCop)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E5A4F]">Pedido Hoy:</span>
                  <span className="font-bold">{formatCOP(sale.cop)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center text-sm font-black">
              <span>{isStatement ? 'TOTAL POR COBRAR:' : 'TOTAL PEDIDO:'}</span>
              <span className="text-[#059669] text-lg">
                {formatCOP(isStatement ? statement.debtCop : sale.cop)}
              </span>
            </div>

            {!isStatement && roundCop(sale.paidAmountCop) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#6E5A4F]">Pagado / Abono hoy:</span>
                <span className="font-bold text-[#059669]">{formatCOP(sale.paidAmountCop)}</span>
              </div>
            )}

            {!isStatement && !sale.isDonation && (
              <div className="flex justify-between font-black">
                <span>Saldo pendiente total:</span>
                <span className={currentClientDebtCop > 0 ? 'text-red-600' : 'text-[#059669]'}>
                  {formatCOP(currentClientDebtCop)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-[11px] text-[#6E5A4F] pt-1">
              <span>Ref USD / BS:</span>
              <span className="font-bold">
                {formatUSD(copToUsd(isStatement ? statement.debtCop : (currentClientDebtCop || sale.cop), rates))} ·{' '}
                {formatBS(copToBs(isStatement ? statement.debtCop : (currentClientDebtCop || sale.cop), rates))}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            className="theme-card py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1"
          >
            <Copy size={14} /> Copiar
          </button>
          <button
            type="button"
            onClick={handleShareText}
            className="theme-accent-bg py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1"
          >
            <Share2 size={14} /> WhatsApp
          </button>
          <button
            type="button"
            onClick={handleDownloadImage}
            className="bg-emerald-600 text-white py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1"
          >
            <Download size={14} /> Imagen
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentModal({ modal, rates, onClose, onConfirm }) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [method, setMethod] = useState('Efectivo COP');
  const [isoDate, setIsoDate] = useState(getTodayISO());

  useEffect(() => {
    if (modal?.isOpen) {
      setCurrency('COP');
      setMethod('Efectivo COP');
      setIsoDate(getTodayISO());
      setAmount(
        modal.initialAmountCop !== undefined
          ? String(modal.initialAmountCop)
          : String(modal.maxCop || 0)
      );
    }
  }, [modal]);

  if (!modal?.isOpen) return null;

  const copAmount = Math.min(modal.maxCop || 0, Math.max(0, toCop(amount, currency, rates)));

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="theme-card w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black uppercase theme-accent-text">
            {modal.mode === 'cxp_single' ? 'Registrar Pago a Productor' : 'Registrar Abono / Pago'}
          </h3>
          <button type="button" onClick={onClose} className="theme-subtle p-1.5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="theme-subtle p-3 rounded-xl space-y-1 text-xs">
          <p className="font-extrabold">
            {modal.clientName || modal.purchase?.producer}
          </p>
          <p className="theme-muted">
            Saldo Pendiente: <strong className="theme-danger-text">{formatCOP(modal.maxCop)}</strong>
          </p>
          <p className="text-[10px] theme-muted">
            {formatUSD(copToUsd(modal.maxCop, rates))} · {formatBS(copToBs(modal.maxCop, rates))}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase theme-muted">Fecha del Abono</label>
            <input
              type="date"
              value={isoDate}
              onChange={(e) => setIsoDate(e.target.value)}
              className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
            />
          </div>

          <div className="grid grid-cols-12 gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="col-span-4 p-2.5 rounded-xl theme-input text-xs font-black"
            >
              <option value="COP">COP</option>
              <option value="USD">USD</option>
              <option value="BS">BS</option>
            </select>
            <input
              type="number"
              step="any"
              value={amount}
              placeholder={String(modal.maxCop || 0)}
              onChange={(e) => setAmount(e.target.value)}
              className="col-span-8 p-2.5 rounded-xl theme-input text-sm font-black text-center"
            />
          </div>

          <p className="text-[11px] font-bold text-center theme-success-text">
            Aplicará: {formatCOP(copAmount)}
          </p>

          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full p-2.5 rounded-xl theme-input text-xs font-bold"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="theme-subtle py-3 rounded-xl text-xs font-bold"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ ...modal, amountCop: copAmount, method, isoDate })}
            className="theme-accent-bg py-3 rounded-xl text-xs font-black"
          >
            CONFIRMAR
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditSaleModal({ sale, onClose, onSave }) {
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (sale) {
      setDraft({
        ...sale,
        items: (sale.items || []).map(normalizeCartItem),
      });
    } else {
      setDraft(null);
    }
  }, [sale]);

  if (!draft) return null;

  const totalCop = (draft.items || []).reduce((sum, i) => sum + roundCop(i.unitPriceCop) * i.quantity, 0);

  const updateLine = (idx, patch) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? normalizeCartItem({ ...it, ...patch }) : it)),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="theme-card w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl my-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black uppercase flex items-center gap-2">
            <Edit3 size={16} className="theme-accent-text" /> Editar Venta #{draft.invoiceNum}
          </h3>
          <button type="button" onClick={onClose} className="theme-subtle p-1.5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase theme-muted">Cliente</label>
            <input
              type="text"
              value={draft.clientName}
              onChange={(e) => setDraft({ ...draft, clientName: e.target.value })}
              className="w-full p-2.5 rounded-xl theme-input mt-1 text-xs font-bold"
            />
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {(draft.items || []).map((it, idx) => (
              <div key={it.lineId || idx} className="theme-subtle p-2.5 rounded-xl space-y-1.5">
                <p className="text-xs font-extrabold">{it.name}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-bold uppercase theme-muted">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) =>
                        updateLine(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                      }
                      className="w-full p-1.5 rounded-lg theme-card text-xs font-black text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase theme-muted">g/ud</label>
                    <input
                      type="number"
                      min="1"
                      value={it.gramsPerUnit}
                      onChange={(e) =>
                        updateLine(idx, { gramsPerUnit: Math.max(1, parseInt(e.target.value, 10) || 1) })
                      }
                      className="w-full p-1.5 rounded-lg theme-card text-xs font-black text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase theme-muted">$ COP/ud</label>
                    <input
                      type="number"
                      step="100"
                      value={it.unitPriceCop}
                      onChange={(e) =>
                        updateLine(idx, { unitPriceCop: Math.max(0, parseInt(e.target.value, 10) || 0) })
                      }
                      className="w-full p-1.5 rounded-lg theme-card text-xs font-black text-center"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase theme-muted">
              Monto Pagado / Abonado (COP) — Total: {formatCOP(totalCop)}
            </label>
            <input
              type="number"
              value={draft.paidAmountCop}
              onChange={(e) =>
                setDraft({ ...draft, paidAmountCop: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="w-full p-2.5 rounded-xl theme-input mt-1 text-sm font-black"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSave(draft)}
          className="w-full theme-accent-bg py-3.5 rounded-xl text-xs font-black"
        >
          GUARDAR CAMBIOS
        </button>
      </div>
    </div>
  );
}

export function EditProcessModal({ log, onClose, onSave }) {
  const [inG, setInG] = useState(0);
  const [outG, setOutG] = useState(0);

  useEffect(() => {
    if (log) {
      setInG(Number.isFinite(Number(log.inputGrams)) ? log.inputGrams : toGrams(log.input, 'kg'));
      setOutG(Number.isFinite(Number(log.outputGrams)) ? log.outputGrams : toGrams(log.output, 'kg'));
    }
  }, [log]);

  if (!log) return null;

  const mermaPct = calcMermaPct(inG, outG);

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="theme-card w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black uppercase flex items-center gap-2">
            <Factory size={16} className="theme-accent-text" /> Editar Lote ({log.type})
          </h3>
          <button type="button" onClick={onClose} className="theme-subtle p-1.5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase theme-muted">
              Entrada (Gramos) — {formatWeightDual(inG)}
            </label>
            <input
              type="number"
              min="1"
              value={inG}
              onChange={(e) => setInG(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full p-2.5 rounded-xl theme-input mt-1 text-sm font-black"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase theme-muted">
              Salida (Gramos) — {formatWeightDual(outG)}
            </label>
            <input
              type="number"
              min="1"
              value={outG}
              onChange={(e) => setOutG(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full p-2.5 rounded-xl theme-input mt-1 text-sm font-black"
            />
          </div>
          <div className="theme-subtle p-3 rounded-xl flex justify-between items-center">
            <span className="text-xs font-bold theme-muted">Merma Calculada</span>
            <span className={`text-lg font-black ${mermaPct > 22 ? 'theme-danger-text' : 'theme-success-text'}`}>
              {mermaPct}%
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSave({ ...log, inputGrams: inG, outputGrams: outG, mermaPct })}
          className="w-full theme-accent-bg py-3.5 rounded-xl text-xs font-black"
        >
          GUARDAR CAMBIOS
        </button>
      </div>
    </div>
  );
}
