import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Lightning, Eye, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";

const ROLE_HINTS = [
  { role: "Admin", email: "admin@lumiasign.com", pwd: "admin123" },
  { role: "Sales", email: "sales@lumiasign.com", pwd: "lumia123" },
  { role: "Production", email: "production@lumiasign.com", pwd: "lumia123" },
  { role: "Store", email: "store@lumiasign.com", pwd: "lumia123" },
  { role: "Accounts", email: "accounts@lumiasign.com", pwd: "lumia123" },
  { role: "Installation", email: "installation@lumiasign.com", pwd: "lumia123" },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@lumiasign.com");
  const [password, setPassword] = useState("admin123");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome to LUMIASIGN ERP");
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const quickFill = (r) => {
    setEmail(r.email);
    setPassword(r.pwd);
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-slate-100">
      {/* Left visual */}
      <div className="hidden lg:block relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1717386255773-1e3037c81788?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwZmFjdG9yeSUyMGludGVyaW9yJTIwbWFudWZhY3R1cmluZ3xlbnwwfHx8fDE3ODEwMjQ5OTl8MA&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/60" />
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF4B00] flex items-center justify-center">
              <Lightning size={22} weight="fill" />
            </div>
            <div>
              <div className="font-black text-2xl tracking-tight">LUMIASIGN</div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">
                ERP // Manufacturing OS
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight">
              Signs that <br /> ship on time.
            </h1>
            <p className="mt-6 text-slate-300 max-w-md text-base leading-relaxed">
              End-to-end operations OS for signage manufacturing — from lead to
              installation. Real costs. Real margins. Real-time.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-6 max-w-md">
              {[
                ["10", "Modules"],
                ["6", "Roles"],
                ["100%", "Traceable"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="text-3xl font-black text-[#FF4B00]">{n}</div>
                  <div className="text-xs uppercase tracking-widest text-slate-400">
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-widest">
            © {new Date().getFullYear()} LUMIASIGN LLP
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-[#FF4B00] flex items-center justify-center">
              <Lightning size={20} weight="fill" color="white" />
            </div>
            <div className="font-black text-xl tracking-tight">LUMIASIGN ERP</div>
          </div>

          <div className="brand-accent-line w-16 mb-6" />
          <h2 className="text-3xl font-black tracking-tight text-slate-900">
            Sign in
          </h2>
          <p className="text-sm text-slate-500 mt-2 mb-8">
            Operations dashboard for production, inventory and accounts.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Email
              </label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 block w-full bg-white border border-slate-300 px-4 py-3 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8] focus:border-[#0F3BE8]"
                placeholder="you@lumiasign.com"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  data-testid="login-password-input"
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full bg-white border border-slate-300 px-4 py-3 pr-12 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8] focus:border-[#0F3BE8]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  data-testid="login-toggle-password"
                >
                  {show ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              data-testid="login-submit-btn"
              className="w-full bg-[#0F3BE8] hover:bg-[#0C2EBA] text-white font-bold uppercase tracking-wider text-sm py-3 rounded-sm transition-colors disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <div className="mt-8 border border-slate-300 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-3">
              Demo accounts · click to fill
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_HINTS.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => quickFill(r)}
                  data-testid={`login-quickfill-${r.role.toLowerCase()}`}
                  className="text-left text-xs px-2 py-2 border border-slate-200 hover:border-[#0F3BE8] hover:bg-blue-50/50 transition-colors"
                >
                  <div className="font-semibold text-slate-900">{r.role}</div>
                  <div className="text-slate-500 truncate">{r.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
