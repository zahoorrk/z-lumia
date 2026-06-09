export const ROLE_LABEL = {
  admin: "Administrator",
  sales: "Sales",
  production: "Production",
  store: "Store",
  accounts: "Accounts",
  installation: "Installation",
};

export const STATUS_COLOR = {
  new: "bg-slate-100 text-slate-700 border-slate-300",
  in_production: "bg-blue-50 text-blue-800 border-blue-300",
  installation: "bg-amber-50 text-amber-800 border-amber-300",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-300",
  cancelled: "bg-red-50 text-red-800 border-red-300",
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  sent: "bg-blue-50 text-blue-800 border-blue-300",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-300",
  rejected: "bg-red-50 text-red-800 border-red-300",
  contacted: "bg-blue-50 text-blue-800 border-blue-300",
  qualified: "bg-violet-50 text-violet-800 border-violet-300",
  won: "bg-emerald-50 text-emerald-800 border-emerald-300",
  lost: "bg-red-50 text-red-800 border-red-300",
  ordered: "bg-blue-50 text-blue-800 border-blue-300",
  received: "bg-emerald-50 text-emerald-800 border-emerald-300",
  scheduled: "bg-blue-50 text-blue-800 border-blue-300",
  in_progress: "bg-amber-50 text-amber-800 border-amber-300",
  queued: "bg-slate-100 text-slate-700 border-slate-300",
  cutting: "bg-blue-50 text-blue-800 border-blue-300",
  printing: "bg-violet-50 text-violet-800 border-violet-300",
  fabrication: "bg-amber-50 text-amber-800 border-amber-300",
  finishing: "bg-cyan-50 text-cyan-800 border-cyan-300",
  qc: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-300",
  done: "bg-emerald-50 text-emerald-800 border-emerald-300",
};

export function fmtINR(n) {
  if (n === null || n === undefined) return "₹0";
  const num = Number(n);
  if (Number.isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function statusLabel(s = "") {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
