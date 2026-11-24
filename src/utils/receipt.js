/**
 * Generación de recibos y estados de cuenta para WhatsApp (texto e imagen PNG)
 * para COLADOS V8.0.
 */
import { logoBase64 } from '../assets/logoBase64.js';
import { formatWeightDual } from './grams.js';
import { copToBs, copToUsd, formatBS, formatCOP, formatDateDisplay, formatUSD, getTodayISO, roundCop } from './money.js';

export function buildSaleWhatsAppText(sale, currentClientDebtCop = 0, rates) {
  if (!sale) return '';
  const items = Array.isArray(sale.items) && sale.items.length > 0
    ? sale.items
    : [{ quantity: 1, name: sale.product || 'Café Tostado', lineTotalCop: sale.cop }];

  const itemLines = items
    .map((it) => `• ${it.quantity}x ${it.name} — ${formatCOP(it.lineTotalCop ?? 0)}`)
    .join('\n');

  const prevDebt = Math.max(0, roundCop(sale.previousDebtCop));
  const subtotal = roundCop(sale.cop);
  const paidToday = roundCop(sale.paidAmountCop);
  const totalAcumulado = prevDebt + subtotal;
  const saldoDespues = Math.max(0, roundCop(currentClientDebtCop));

  let statusLine = '⏳ *Estado:* CRÉDITO PENDIENTE';
  if (sale.isDonation || sale.method === 'Donación') {
    statusLine = '🎁 *Estado:* DONACIÓN / CORTESÍA';
  } else if (sale.isPaid && saldoDespues === 0) {
    statusLine = `✅ *Estado:* PAGADO (${sale.method})`;
  } else if (paidToday > 0) {
    statusLine = `💵 *Abono hoy:* ${formatCOP(paidToday)} (${sale.method})`;
  }

  const lines = [
    '☕ *COLADOS CAFÉ* ☕',
    '_"Con el rico aroma al amanecer"_',
    '',
    `*Recibo:* #${sale.invoiceNum || String(sale.id).slice(-4)}`,
    `*Fecha:* ${sale.date || formatDateDisplay(sale.isoDate)}`,
    `*Cliente:* ${sale.clientName}`,
    '',
    '*Detalle del pedido:*',
    itemLines,
    `*Peso total:* ${formatWeightDual(sale.totalGrams || 0)}`,
    `*Pedido de hoy:* ${formatCOP(subtotal)}`,
  ];

  if (prevDebt > 0) {
    lines.push(`*Deuda anterior:* ${formatCOP(prevDebt)}`);
    lines.push(`*Total acumulado:* ${formatCOP(totalAcumulado)}`);
  }

  lines.push(statusLine);
  if (roundCop(sale.appliedToOldDebtCop) > 0) {
    lines.push(`*Abono a deuda anterior:* ${formatCOP(sale.appliedToOldDebtCop)}`);
  }
  if (roundCop(sale.changeCop) > 0) {
    lines.push(`*Vuelto:* ${formatCOP(sale.changeCop)}`);
  }

  if (!sale.isDonation) {
    lines.push('');
    lines.push(`*Saldo pendiente total:* ${formatCOP(saldoDespues)}`);
    lines.push(`Ref: ${formatUSD(copToUsd(saldoDespues, rates))} | ${formatBS(copToBs(saldoDespues, rates))}`);
    if (saldoDespues === 0 && subtotal > 0) {
      lines.push(`(Pedido equivalente: ${formatUSD(copToUsd(subtotal, rates))} | ${formatBS(copToBs(subtotal, rates))})`);
    }
  }

  lines.push('', '_¡Gracias por preferir la calidad de nuestros andes!_');
  return lines.join('\n');
}

export function buildClientStatementWhatsAppText(account, rates) {
  if (!account) return '';
  const todayStr = formatDateDisplay(getTodayISO());
  const pendingSales = Array.isArray(account.pendingSales) ? account.pendingSales : [];
  const payments = Array.isArray(account.payments) ? account.payments : [];

  const deliveryLines = pendingSales.map((s) => {
    const desc = Array.isArray(s.items) && s.items.length > 0
      ? s.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
      : 'Pedido';
    return `• #${s.invoiceNum} (${s.date}): ${desc} | Total ${formatCOP(s.cop)} → Resta ${formatCOP(s.balanceDueCop)}`;
  });

  const paymentLines = payments.slice(0, 6).map(
    (p) => `• ${p.date}: ${formatCOP(p.amountCop)} (${p.method})`
  );

  const debtCop = roundCop(account.debtCop);
  const lines = [
    '☕ *COLADOS CAFÉ — ESTADO DE CUENTA* ☕',
    `*Cliente:* ${account.clientName}`,
    `*Fecha corte:* ${todayStr}`,
    '',
    '*Entregas con saldo pendiente:*',
    ...(deliveryLines.length ? deliveryLines : ['• Sin entregas pendientes']),
  ];

  if (paymentLines.length > 0) {
    lines.push('', '*Últimos abonos registrados:*', ...paymentLines);
  }

  lines.push(
    '',
    `*SALDO TOTAL POR COBRAR:* ${formatCOP(debtCop)}`,
    `*Ref USD:* ${formatUSD(copToUsd(debtCop, rates))}`,
    `*Ref BS:* ${formatBS(copToBs(debtCop, rates))}`,
    '',
    '_¡Gracias por su preferencia y confianza!_'
  );

  return lines.join('\n');
}

export async function shareTextToWhatsAppOrClipboard(text, title = 'Colados Café') {
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text });
    return { method: 'capacitor' };
  } catch {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text });
        return { method: 'web_share' };
      } catch {
        // continúa al portapapeles
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { method: 'clipboard' };
    }
    throw new Error('No fue posible copiar o compartir el texto');
  }
}

export async function downloadOrShareReceiptImage({ sale = null, statement = null, rates, currentClientDebtCop = 0 }) {
  if (typeof document === 'undefined') {
    throw new Error('Canvas no disponible fuera del navegador');
  }

  const isStatement = Boolean(statement);
  const items = isStatement
    ? (statement.pendingSales || []).map((s) => {
        const summary = Array.isArray(s.items) && s.items.length > 0
          ? s.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
          : 'Pedido';
        return {
          left: `#${s.invoiceNum} ${s.date} · ${summary}`,
          right: formatCOP(s.balanceDueCop),
        };
      })
    : ((Array.isArray(sale?.items) && sale.items.length > 0
        ? sale.items
        : [{ quantity: 1, name: sale?.product || 'Café Tostado', lineTotalCop: sale?.cop }]
      ).map((it) => ({
        left: `${it.quantity}x ${it.name}`,
        right: formatCOP(it.lineTotalCop ?? 0),
      })));

  const lineHeight = 24;
  const extraHeight = Math.max(0, items.length - 1) * lineHeight + (sale?.previousDebtCop > 0 ? 48 : 0);
  const logicalWidth = 420;
  const logicalHeight = 620 + extraHeight;
  const scale = 3;

  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * scale;
  canvas.height = logicalHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const logo = new Image();
  logo.src = logoBase64;

  await new Promise((resolve, reject) => {
    logo.onload = resolve;
    logo.onerror = () => reject(new Error('Error cargando logo'));
  });

  // Fondo crema cálido y marco ámbar tostado
  ctx.fillStyle = '#FBF9F5';
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, logicalWidth - 24, logicalHeight - 24);

  // Logo circular
  ctx.save();
  ctx.beginPath();
  ctx.arc(logicalWidth / 2, 68, 40, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logo, logicalWidth / 2 - 40, 28, 80, 80);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#2C1E16';
  ctx.font = '900 28px sans-serif';
  ctx.fillText('COLADOS', logicalWidth / 2, 136);
  ctx.fillStyle = '#6E5A4F';
  ctx.font = 'italic 12px sans-serif';
  ctx.fillText(isStatement ? 'Estado de Cuenta por Cobrar' : '"Con el rico aroma al amanecer"', logicalWidth / 2, 156);

  const dashedLine = (y) => {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#D6CBBF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(logicalWidth - 28, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  dashedLine(174);

  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6E5A4F';
  ctx.fillText(isStatement ? 'Tipo:' : 'Recibo:', 36, 202);
  ctx.fillText('Fecha:', 36, 228);
  ctx.fillText('Cliente:', 36, 254);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#2C1E16';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(
    isStatement ? 'RESUMEN DE CUENTA' : `#${sale.invoiceNum || String(sale.id).slice(-4)}`,
    logicalWidth - 36,
    202
  );
  ctx.fillText(
    isStatement ? formatDateDisplay(getTodayISO()) : (sale.date || formatDateDisplay(sale.isoDate)),
    logicalWidth - 36,
    228
  );
  ctx.fillStyle = '#B45309';
  ctx.fillText(
    isStatement ? statement.clientName : sale.clientName,
    logicalWidth - 36,
    254
  );

  dashedLine(272);

  let y = 296;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6E5A4F';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(isStatement ? 'ENTREGAS PENDIENTES' : 'DETALLE DEL PEDIDO', 36, y);
  y += 22;

  ctx.font = 'bold 13px sans-serif';
  for (const row of items) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2C1E16';
    const clippedLeft = row.left.length > 32 ? `${row.left.slice(0, 31)}…` : row.left;
    ctx.fillText(clippedLeft, 36, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2C1E16';
    ctx.fillText(row.right, logicalWidth - 36, y);
    y += lineHeight;
  }

  dashedLine(y + 4);
  y += 28;

  const mainCop = isStatement ? roundCop(statement.debtCop) : roundCop(sale.cop);
  if (!isStatement && roundCop(sale.previousDebtCop) > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6E5A4F';
    ctx.font = '13px sans-serif';
    ctx.fillText('Deuda Anterior:', 36, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(formatCOP(sale.previousDebtCop), logicalWidth - 36, y);
    y += 24;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#6E5A4F';
    ctx.font = '13px sans-serif';
    ctx.fillText('Acumulado Total:', 36, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2C1E16';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(formatCOP(roundCop(sale.previousDebtCop) + mainCop), logicalWidth - 36, y);
    y += 24;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#6E5A4F';
  ctx.font = '13px sans-serif';
  ctx.fillText(isStatement ? 'Saldo por Cobrar:' : 'Total Pedido:', 36, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#059669';
  ctx.font = '900 20px sans-serif';
  ctx.fillText(formatCOP(mainCop), logicalWidth - 36, y);
  y += 26;

  const refCop = isStatement ? mainCop : (currentClientDebtCop > 0 ? currentClientDebtCop : mainCop);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6E5A4F';
  ctx.font = '12px sans-serif';
  ctx.fillText('Ref USD:', 36, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#2C1E16';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(formatUSD(copToUsd(refCop, rates)), logicalWidth - 36, y);
  y += 22;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#6E5A4F';
  ctx.font = '12px sans-serif';
  ctx.fillText('Ref BS:', 36, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#2C1E16';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(formatBS(copToBs(refCop, rates)), logicalWidth - 36, y);
  y += 26;

  let badgeColor = '#059669';
  let badgeText = 'PAGADO';
  if (isStatement) {
    badgeColor = '#D97706';
    badgeText = `PENDIENTE: ${formatCOP(mainCop)}`;
  } else if (sale.isDonation || sale.method === 'Donación') {
    badgeColor = '#2563EB';
    badgeText = 'DONACIÓN / CORTESÍA';
  } else if (sale.isPaid && currentClientDebtCop <= 0) {
    badgeColor = '#059669';
    badgeText = `PAGADO — ${sale.method}`;
  } else {
    badgeColor = '#D97706';
    badgeText = `SALDO PENDIENTE: ${formatCOP(currentClientDebtCop || sale.balanceDueCop)}`;
  }

  ctx.fillStyle = badgeColor;
  ctx.fillRect(36, y, logicalWidth - 72, 34);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(badgeText, logicalWidth / 2, y + 21);

  ctx.fillStyle = '#6E5A4F';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('Colados Café · V8.0 Offline-First ERP', logicalWidth / 2, logicalHeight - 36);
  ctx.font = '9px sans-serif';
  ctx.fillText('App hecha por Harvey Cárdenas', logicalWidth / 2, logicalHeight - 22);

  const fileName = isStatement
    ? `Estado_Cuenta_${statement.clientName.replace(/\s+/g, '_')}.png`
    : `Recibo_Colados_${sale.invoiceNum || sale.id}.png`;
  const dataUrl = canvas.toDataURL('image/png');
  const base64Data = dataUrl.split(',')[1];

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });
    await Share.share({
      title: isStatement ? 'Estado de Cuenta Colados' : 'Recibo Colados',
      url: result.uri,
    });
    return { native: true, fileName };
  } catch {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { native: false, fileName };
  }
}
