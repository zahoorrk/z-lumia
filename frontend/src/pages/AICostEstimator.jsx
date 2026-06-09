import React, { useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Field, Input, Select, Textarea } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Sparkle, Robot } from "@phosphor-icons/react";
import { toast } from "sonner";

const PROJECT_TYPES = [
  "ACP Facade", "LED Signage", "Acrylic Signage", "SS Signage",
  "Pylon Sign", "Wayfinding", "Vehicle Branding",
  "Retail Branding", "Interior Branding", "Exterior Branding",
];

const LIGHTING = ["None", "LED Backlit", "Edge-lit", "Halo", "Front-lit", "RGB Programmable"];

export default function AICostEstimator() {
  const [form, setForm] = useState({ project_type: PROJECT_TYPES[1], project_size: "10x4 ft", material_type: "ACP + Acrylic", lighting_type: "LED Backlit", location: "Mumbai", extra_notes: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setResult(null);
    try {
      const { data } = await api.post("/ai/cost-estimate", form);
      setResult(data.estimate);
      if (data.estimate?.error) toast.error("AI returned unparsed text — see raw output");
      else toast.success("Estimate ready");
    } catch (err) { toast.error(err?.response?.data?.detail || "AI failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 lg:p-8" data-testid="ai-estimator-page">
      <PageHeader subtitle="AI Tools" title="AI Cost Estimator" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="lumia-surface p-5 space-y-4" data-testid="ai-form">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Robot size={22} weight="fill" className="text-[#0F3BE8]" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Powered by AI</div>
              <h3 className="text-lg font-bold tracking-tight">Tell us about the project</h3>
            </div>
          </div>
          <Field label="Project Type *">
            <Select required value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} data-testid="ai-type">
              {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Size *"><Input required value={form.project_size} onChange={(e) => setForm({ ...form, project_size: e.target.value })} placeholder="e.g. 10x4 ft" data-testid="ai-size" /></Field>
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Mumbai" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Material Type"><Input value={form.material_type} onChange={(e) => setForm({ ...form, material_type: e.target.value })} placeholder="e.g. ACP + Acrylic" /></Field>
            <Field label="Lighting">
              <Select value={form.lighting_type} onChange={(e) => setForm({ ...form, lighting_type: e.target.value })}>
                {LIGHTING.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Extra Notes"><Textarea rows={3} value={form.extra_notes} onChange={(e) => setForm({ ...form, extra_notes: e.target.value })} placeholder="Mounting type, urgency, special finishes…" /></Field>
          <Btn variant="primary" type="submit" disabled={busy} data-testid="ai-submit"><Sparkle size={14} weight="fill" /> {busy ? "Estimating…" : "Generate Estimate"}</Btn>
        </form>

        <div className="lumia-surface p-5" data-testid="ai-result">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Sparkle size={22} weight="fill" className="text-[#FF4B00]" />
            <div><div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Result</div><h3 className="text-lg font-bold tracking-tight">AI Estimate</h3></div>
          </div>
          {!result ? (
            <div className="py-16 text-center text-sm text-slate-400">Run the estimator to see breakdown here.</div>
          ) : result.raw ? (
            <div className="space-y-3">
              <div className="text-sm text-red-700 font-bold">Model returned unparsed text:</div>
              <pre className="text-xs bg-slate-50 p-3 border border-slate-200 overflow-auto whitespace-pre-wrap">{result.raw}</pre>
            </div>
          ) : (
            <div className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border border-slate-200 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Material</div><div className="font-mono-num font-bold">{fmtINR(result.material_cost)}</div></div>
                <div className="border border-slate-200 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Labour</div><div className="font-mono-num font-bold">{fmtINR(result.labour_cost)}</div></div>
                <div className="border border-slate-200 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Transport</div><div className="font-mono-num font-bold">{fmtINR(result.transport_cost)}</div></div>
                <div className="border border-slate-200 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Overhead</div><div className="font-mono-num font-bold">{fmtINR(result.overhead_cost)}</div></div>
              </div>
              <div className="bg-slate-900 text-white p-4 grid grid-cols-3 gap-3">
                <div><div className="text-[10px] uppercase tracking-wider text-slate-400">Total Cost</div><div className="font-mono-num text-xl font-black">{fmtINR(result.total_cost)}</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-slate-400">Selling Price</div><div className="font-mono-num text-xl font-black text-[#FF4B00]">{fmtINR(result.selling_price)}</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-slate-400">Profit ({result.profit_pct}%)</div><div className="font-mono-num text-xl font-black text-emerald-400">{fmtINR(result.profit)}</div></div>
              </div>
              {result.breakdown && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Breakdown</div>
                  <div className="text-xs text-slate-700 leading-relaxed">{result.breakdown}</div>
                </div>
              )}
              {result.assumptions && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Assumptions</div>
                  <div className="text-xs text-slate-600 leading-relaxed italic">{result.assumptions}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
