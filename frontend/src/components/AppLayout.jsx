import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Gauge, UsersThree, FileText, Stack, Factory, Package, ShoppingCart, Wrench,
  Calculator, ChartLineUp, ClipboardText, Truck, Crown, Receipt, Robot, Bell,
  ListChecks, Lightning, SignOut, List as ListIcon, X,
} from "@phosphor-icons/react";
import { ROLE_LABEL } from "@/lib/constants";
import NotificationsBell from "@/components/NotificationsBell";

const NAV = [
  { to: "/", label: "Dashboard", Icon: Gauge, roles: ["admin", "sales", "production", "store", "accounts", "installation"] },
  { to: "/ceo", label: "CEO View", Icon: Crown, roles: ["admin", "accounts"] },
  { to: "/leads", label: "Leads", Icon: UsersThree, roles: ["admin", "sales"] },
  { to: "/quotations", label: "Quotations", Icon: FileText, roles: ["admin", "sales", "accounts"] },
  { to: "/projects", label: "Projects", Icon: Stack, roles: ["admin", "sales", "production", "installation", "accounts"] },
  { to: "/production", label: "Production", Icon: Factory, roles: ["admin", "production"] },
  { to: "/inventory", label: "Inventory", Icon: Package, roles: ["admin", "store", "production"] },
  { to: "/suppliers", label: "Suppliers", Icon: Truck, roles: ["admin", "store", "accounts"] },
  { to: "/purchases", label: "Purchases", Icon: ShoppingCart, roles: ["admin", "store", "accounts"] },
  { to: "/installation", label: "Installation", Icon: Wrench, roles: ["admin", "installation", "sales"] },
  { to: "/invoices", label: "Invoices", Icon: Receipt, roles: ["admin", "accounts", "sales"] },
  { to: "/costing", label: "Costing", Icon: Calculator, roles: ["admin", "accounts", "production"] },
  { to: "/profit", label: "Profit Analysis", Icon: ChartLineUp, roles: ["admin", "accounts"] },
  { to: "/ai-estimator", label: "AI Estimator", Icon: Robot, roles: ["admin", "sales", "accounts"] },
  { to: "/reports", label: "Reports", Icon: ClipboardText, roles: ["admin", "accounts"] },
  { to: "/audit-log", label: "Audit Log", Icon: ListChecks, roles: ["admin"] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => n.roles.includes(user?.role));
  const current = items.find((n) => n.to === location.pathname) || items[0];

  const handleLogout = () => { logout(); nav("/login"); };

  return (
    <div className="flex h-screen w-full bg-slate-100">
      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-slate-950 text-slate-200 flex flex-col transform transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-[#FF4B00] flex items-center justify-center">
            <Lightning size={18} weight="fill" />
          </div>
          <div>
            <div className="font-black text-base tracking-tight">LUMIASIGN</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">ERP</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {items.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}
              data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
              className={({ isActive }) => `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors ${isActive ? "bg-slate-900 border-[#FF4B00] text-white font-semibold" : "border-transparent text-slate-400 hover:bg-slate-900 hover:text-white"}`}>
              <Icon size={18} weight="bold" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0F3BE8] flex items-center justify-center text-white font-bold text-sm">{user?.name?.[0] || "U"}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-white">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{ROLE_LABEL[user?.role] || user?.role}</div>
            </div>
            <button onClick={handleLogout} data-testid="logout-btn" className="text-slate-400 hover:text-white" title="Sign out"><SignOut size={18} weight="bold" /></button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="lg:hidden text-slate-700" data-testid="open-sidebar-btn">{open ? <X size={22} /> : <ListIcon size={22} />}</button>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">LUMIASIGN ERP</div>
              <div className="text-lg font-bold tracking-tight text-slate-900">{current?.label || ""}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <div className="hidden md:block text-xs text-slate-500 uppercase tracking-wider">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</div>
            <div className="px-2 py-1 bg-slate-900 text-white text-[10px] uppercase tracking-wider font-bold">{ROLE_LABEL[user?.role] || user?.role}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto" data-testid="main-content"><Outlet /></main>
      </div>
    </div>
  );
}
