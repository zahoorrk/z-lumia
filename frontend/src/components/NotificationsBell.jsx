import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bell, X, Warning, Clock, CurrencyInr, Wrench } from "@phosphor-icons/react";

const ICONS = {
  low_stock: Warning,
  payment_overdue: CurrencyInr,
  project_delay: Clock,
  install_due: Wrench,
};
const COLORS = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-blue-600",
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);

  const load = () => api.get("/notifications").then((r) => setNotes(r.data)).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const high = notes.filter((n) => n.severity === "high").length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-slate-600 hover:text-slate-900"
        data-testid="notifications-bell"
      >
        <Bell size={20} weight="bold" />
        {notes.length > 0 && (
          <span className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 text-[9px] font-bold flex items-center justify-center rounded-full ${high > 0 ? "bg-red-600" : "bg-amber-500"} text-white`}>
            {notes.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-40 w-96 max-h-[70vh] overflow-y-auto bg-white border border-slate-300 shadow-xl" data-testid="notifications-panel">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Inbox</div>
                <div className="font-bold">Notifications · {notes.length}</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500"><X size={16} /></button>
            </div>
            {notes.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">Nothing to alert. Good state.</div>
            ) : (
              <ul>
                {notes.map((n, i) => {
                  const Icon = ICONS[n.kind] || Bell;
                  return (
                    <li key={i} className="px-4 py-3 border-b border-slate-200 flex items-start gap-3 hover:bg-slate-50" data-testid={`notif-${n.kind}-${i}`}>
                      <Icon size={18} weight="bold" className={COLORS[n.severity] || "text-slate-500"} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{n.title}</div>
                        <div className="text-xs text-slate-600">{n.message}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
