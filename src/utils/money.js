/**
 * Motor monetario y fechas locales para COLADOS V8.0.
 * Base principal: Pesos Colombianos (COP) enteros, con conversión
 * automática a USD (TRM) y BS (Tasa COP/BS).
 */

export const DEFAULT_RATES = {
  usd_cop: 4100,
  cop_bs: 0.011,
};

export function roundCop(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const rounded = Math.round(num);
  return rounded === 0 ? 0 : rounded;
}

export function copToUsd(cop, rates = DEFAULT_RATES) {
  const usdCop = Number(rates?.usd_cop);
  if (!Number.isFinite(usdCop) || usdCop <= 0) return 0;
  const val = (Number(cop) || 0) / usdCop;
  const rounded = Math.round(val * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export function copToBs(cop, rates = DEFAULT_RATES) {
  const copBs = Number(rates?.cop_bs);
  if (!Number.isFinite(copBs) || copBs <= 0) return 0;
  const val = (Number(cop) || 0) * copBs;
  const rounded = Math.round(val * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export function toCop(amount, currency = 'COP', rates = DEFAULT_RATES) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  if (currency === 'USD') {
    const usdCop = Number(rates?.usd_cop) > 0 ? Number(rates.usd_cop) : DEFAULT_RATES.usd_cop;
    return roundCop(num * usdCop);
  }
  if (currency === 'BS') {
    const copBs = Number(rates?.cop_bs);
    if (!Number.isFinite(copBs) || copBs <= 0) return 0;
    return roundCop(num / copBs);
  }
  return roundCop(num);
}

export function formatCOP(cop) {
  const val = roundCop(cop);
  const abs = Math.abs(val).toLocaleString('es-CO');
  return val < 0 ? `-$${abs} COP` : `$${abs} COP`;
}

export function formatUSD(usd) {
  const num = Number(usd);
  const safe = Number.isFinite(num) ? num : 0;
  const abs = Math.abs(safe).toFixed(2);
  return safe < 0 ? `-USD $${abs}` : `USD $${abs}`;
}

export function formatBS(bs) {
  const num = Number(bs);
  const safe = Number.isFinite(num) ? num : 0;
  const abs = Math.abs(safe).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return safe < 0 ? `-Bs ${abs}` : `Bs ${abs}`;
}

export function formatMoney(cop, currency = 'COP', rates = DEFAULT_RATES) {
  if (currency === 'USD') return formatUSD(copToUsd(cop, rates));
  if (currency === 'BS') return formatBS(copToBs(cop, rates));
  return formatCOP(cop);
}

export function getLocalDateObj(offsetHours = -4, nowMs = Date.now()) {
  return new Date(nowMs + offsetHours * 3600000);
}

export function getTodayISO(nowMs = Date.now()) {
  return getLocalDateObj(-4, nowMs).toISOString().split('T')[0];
}

export function getCurrentMonthKey(nowMs = Date.now()) {
  return getTodayISO(nowMs).slice(0, 7);
}

export function getCurrentTimeDisplay(nowMs = Date.now()) {
  const d = getLocalDateObj(-4, nowMs);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDateDisplay(iso) {
  if (!iso || typeof iso !== 'string') return '';
  if (!iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function addDaysISO(iso, days = 0) {
  if (!iso || !iso.includes('-')) return getTodayISO();
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().split('T')[0];
}

export function daysBetweenISO(fromIso, toIso = getTodayISO()) {
  if (!fromIso || !toIso || !fromIso.includes('-') || !toIso.includes('-')) return 0;
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.floor((t2 - t1) / 86400000);
}

export function getLastNDaysISO(n = 7, nowMs = Date.now()) {
  const today = getTodayISO(nowMs);
  const res = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    res.push(addDaysISO(today, -i));
  }
  return res;
}

const MONTH_ABBR_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function getLastNMonths(n = 12, nowMs = Date.now()) {
  const today = getTodayISO(nowMs);
  const [yearStr, monthStr] = today.split('-');
  const baseYear = Number(yearStr);
  const baseMonthIdx = Number(monthStr) - 1;
  const res = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const dt = new Date(Date.UTC(baseYear, baseMonthIdx - i, 1));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    res.push({
      monthKey,
      label: MONTH_ABBR_ES[m],
      year: y,
      month: m + 1,
    });
  }
  return res;
}
