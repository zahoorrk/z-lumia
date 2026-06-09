import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Field, Input, Select, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { FloppyDisk } from "@phosphor-icons/react";
import { toast } from "sonner";

const FIELDS = [
  ["material_cost", "Material Cost"],
  ["labour_cost", "Labour Cost"],
  ["transport_cost", "Transport Cost"],
  ["machine_cost", "Machine Cost"],
  ["overhead_cost", "Overhead Cost"],
];

export default function Costing() {
  const [projects, setProjects] = useState([]);
  const [costs, setCosts] = useState([]);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState({});

  const load = async () => {
    const [p, c] = await Promise.all([api.get("/projects"), api.get("/costs")]);
    setProjects(p.data); setCosts(c.data);
    if (!selected && p.data.length > 0) setSelected(p.data[0].id);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) return;
    api.get(`/costs/${selected}`).then((r) => setForm(r.data));
  }, [selected]);

  const project = useMemo(() => projects.find((p) => p.id === selected), [projects, selected]);
  const total = FIELDS.reduce((s, [k]) => s + (Number(form[k]) || 0), 0);
  const margin = project ? project.contract_value - total : 0;

  const save = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(FIELDS.map(([k]) => [k, Number(form[k]) || 0]));
    await api.put(`/costs/${selected}`, payload);
    toast.success("Costs updated");
    load();
  };

  return (
    <div className="p-6 lg:p-8" data-testid="costing-page">
      <PageHeader subtitle="Project Economics" title="Costing" />

      {projects.length === 0 ? (
        <Empty title="No projects" note="Create a project first." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lumia-surface lg:col-span-4 max-h-[70vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Projects</div>
            </div>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                data-testid={`costing-project-${p.id}`}
                className={`w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-slate-50 ${selected === p.id ? "bg-blue-50/50 border-l-4 border-l-[#0F3BE8]" : ""}`}
              >
                <div className="font-mono-num text-xs text-slate-500">{p.project_no}</div>
                <div className="font-semibold text-sm text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500">{p.client_name} · {fmtINR(p.contract_value)}</div>
              </button>
            ))}
          </div>

          <div className="lumia-surface lg:col-span-8 p-5" data-testid="costing-detail">
            {!project ? (
              <Empty title="Select a project" />
            ) : (
              <form onSubmit={save} className="space-y-5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{project.project_no}</div>
                  <h2 className="text-2xl font-black tracking-tight">{project.name}</h2>
                  <div className="text-sm text-slate-500">{project.client_name}</div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="border border-slate-200 p-3">
                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Revenue</div>
                    <div className="font-mono-num text-2xl font-black">{fmtINR(project.contract_value)}</div>
                  </div>
                  <div className="border border-slate-200 p-3">
                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Total Cost</div>
                    <div className="font-mono-num text-2xl font-black text-[#FF4B00]">{fmtINR(total)}</div>
                  </div>
                  <div className="border border-slate-200 p-3">
                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Margin</div>
                    <div className={`font-mono-num text-2xl font-black ${margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtINR(margin)}</div>
                    <div className="text-xs text-slate-500">{project.contract_value > 0 ? `${((margin/project.contract_value)*100).toFixed(1)}% margin` : ""}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {FIELDS.map(([k, label]) => (
                    <Field key={k} label={label}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form[k] ?? 0}
                        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                        data-testid={`costing-input-${k}`}
                      />
                    </Field>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Btn type="submit" variant="primary" data-testid="costing-save-btn">
                    <FloppyDisk size={14} weight="bold" /> Save Costs
                  </Btn>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
