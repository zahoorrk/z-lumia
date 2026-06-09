import React from "react";
import { STATUS_COLOR, statusLabel } from "@/lib/constants";

export function StatusBadge({ status, testid }) {
  const cls = STATUS_COLOR[status] || "bg-slate-100 text-slate-700 border-slate-300";
  return (
    <span
      data-testid={testid}
      className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${cls}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          {subtitle}
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Btn({ children, variant = "primary", className = "", ...rest }) {
  const base =
    "inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50";
  const styles = {
    primary: "bg-[#0F3BE8] hover:bg-[#0C2EBA] text-white",
    accent: "bg-[#FF4B00] hover:bg-[#CC3C00] text-white",
    ghost: "bg-white border border-slate-300 text-slate-700 hover:border-slate-900 hover:text-slate-900",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button {...rest} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`block w-full bg-white border border-slate-300 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8] focus:border-[#0F3BE8] ${
        props.className || ""
      }`}
    />
  );
}

export function Select({ children, ...rest }) {
  return (
    <select
      {...rest}
      className={`block w-full bg-white border border-slate-300 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8] focus:border-[#0F3BE8] ${
        rest.className || ""
      }`}
    >
      {children}
    </select>
  );
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`block w-full bg-white border border-slate-300 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8] focus:border-[#0F3BE8] ${
        props.className || ""
      }`}
    />
  );
}

export function Modal({ open, onClose, title, children, testid }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid={testid}>
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div className="relative bg-white border border-slate-300 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 text-xl"
            data-testid="modal-close-btn"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ title = "No data yet", note }) {
  return (
    <div className="p-10 text-center border border-dashed border-slate-300 bg-white">
      <div className="text-lg font-bold text-slate-700">{title}</div>
      {note && <div className="text-sm text-slate-500 mt-1">{note}</div>}
    </div>
  );
}
