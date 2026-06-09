import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import Quotations from "@/pages/Quotations";
import Projects from "@/pages/Projects";
import Production from "@/pages/Production";
import Inventory from "@/pages/Inventory";
import Purchases from "@/pages/Purchases";
import Suppliers from "@/pages/Suppliers";
import InstallationPage from "@/pages/Installation";
import Costing from "@/pages/Costing";
import ProfitAnalysis from "@/pages/ProfitAnalysis";
import Reports from "@/pages/Reports";
import "@/App.css";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Loading…</div>
      </div>
    );

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (roles && !roles.includes(user.role) && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" theme="light" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Protected roles={["sales"]}><Leads /></Protected>} />
            <Route path="quotations" element={<Protected roles={["sales", "accounts"]}><Quotations /></Protected>} />
            <Route path="projects" element={<Projects />} />
            <Route path="production" element={<Protected roles={["production"]}><Production /></Protected>} />
            <Route path="inventory" element={<Protected roles={["store", "production"]}><Inventory /></Protected>} />
            <Route path="purchases" element={<Protected roles={["store", "accounts"]}><Purchases /></Protected>} />
            <Route path="suppliers" element={<Protected roles={["store", "accounts"]}><Suppliers /></Protected>} />
            <Route path="installation" element={<Protected roles={["installation", "sales"]}><InstallationPage /></Protected>} />
            <Route path="costing" element={<Protected roles={["accounts", "production"]}><Costing /></Protected>} />
            <Route path="profit" element={<Protected roles={["accounts"]}><ProfitAnalysis /></Protected>} />
            <Route path="reports" element={<Protected roles={["accounts"]}><Reports /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
