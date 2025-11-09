import Decimal from "decimal.js"

export function computeTotal(unitPrice: number, qty: number) {
  const up = new Decimal(unitPrice || 0)
  const q = new Decimal(qty || 0)
  return Number(up.mul(q).toDecimalPlaces(4)) // keep precision, round later for display
}

export function applyMarkup(cost: number, markupPct: number) {
  const c = new Decimal(cost || 0)
  const m = new Decimal(markupPct || 0).div(100)
  const price = c.mul(m.add(1))
  const profit = price.sub(c)
  const marginPct = profit.div(price.gt(0) ? price : new Decimal(1)).mul(100)
  return {
    price: Number(price.toDecimalPlaces(2)),
    profit: Number(profit.toDecimalPlaces(2)),
    marginPct: Number(marginPct.toDecimalPlaces(1)),
  }
}

export function formatMoney(n: number) {
  return `$${(n || 0).toFixed(2)}`
}
