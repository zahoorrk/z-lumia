import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Modal, Field, Input, Select, Empty } from "@/components/Bits";
import { fmtINR, MATERIAL_CATEGORIES } from "@/lib/constants";
import { Plus, Package, ArrowDown, ArrowUp, PencilSimple, Trash, MagnifyingGlass, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const emptyMat = { code: "", name: "", category: "ACP", unit: "pcs", stock_qty: 0, min_stock: 0, purchase_rate: 0, selling_rate: 0, supplier_id: "" };

export default function Inventory() {
  const { user } = useAuth();
  const canWrite = ["admin", "store"].includes(user?.role);
  const [tab, setTab] = useState("master");
  const [mats, setMats] = useState([]);
  const [moves, setMoves] = useState([]);
  const [projects, setProjects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const [matOpen, setMatOpen] = useState(false);
  const [matEditing, setMatEditing] = useState(null);
  const [matForm, setMatForm] = useState(emptyMat);

  const [inOpen, setInOpen] = useState(false);
  const [inForm, setInForm] = useState({ supplier_id: "", material_id: "", qty: 1, rate: 0, date: new Date().toISOString().slice(0,10), note: "" });

  const [outOpen, setOutOpen] = useState(false);
  const [outForm, setOutForm] = useState({ project_id: "", material_id: "", qty: 1, note: "" });

  const loadMats = () => {
    const params = {};
    if (q) params.q = q;
    if (catFilter) params.category = catFilter;
    api.get("/materials", { params }).then((r) => setMats(r.data));
  };
  const load = async () => {
    const [sm, pj, sp] = await Promise.all([
      api.get("/stock-movements").catch(() => ({ data: [] })),
      api.get("/projects").catch(() => ({ data: [] })),
      api.get("/suppliers").catch(() => ({ data: [] })),
    ]);
    setMoves(sm.data); setProjects(pj.data); setSuppliers(sp.data);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(loadMats, 200); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, catFilter]);

  const openMatCreate = () => { setMatEditing(null); setMatForm(emptyMat); setMatOpen(true); };
  const openMatEdit = (m) => { setMatEditing(m); setMatForm({ ...emptyMat, ...m }); setMatOpen(true); };

  const saveMat = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...matForm,
        stock_qty: Number(matForm.stock_qty) || 0,
        min_stock: Number(matForm.min_stock) || 0,
        purchase_rate: Number(matForm.purchase_rate) || 0,
        selling_rate: Number(matForm.selling_rate) || 0,
        supplier_id: matForm.supplier_id || null,
      };
      if (matEditing) await api.put(`/materials/${matEditing.id}`, payload);
      else await api.post("/materials", payload);
      toast.success(matEditing ? "Material updated" : "Material created");
      setMatOpen(false); loadMats();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };
  const removeMat = async (id) => {
    if (!window.confirm("Delete material?")) return;
    await api.delete(`/materials/${id}`); loadMats();
  };

  const openIn = () => { setInForm({ supplier_id: suppliers[0]?.id || "", material_id: mats[0]?.id || "", qty: 1, rate: mats[0]?.purchase_rate || 0, date: new Date().toISOString().slice(0,10), note: "" }); setInOpen(true); };
  const saveIn = async (e) => {
    e.preventDefault();
    try {
      await api.post("/stock/in", { ...inForm, qty: Number(inForm.qty), rate: Number(inForm.rate), supplier_id: inForm.supplier_id || null });
      toast.success("Stock added"); setInOpen(false); loadMats(); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  const openOut = () => { setOutForm({ project_id: projects[0]?.id || "", material_id: mats[0]?.id || "", qty: 1, note: "" }); setOutOpen(true); };
  const saveOut = async (e) => {
    e.preventDefault();
    try {
      await api.post("/stock/out", { ...outForm, qty: Number(outForm.qty) });
      toast.success("Stock issued to project"); setOutOpen(false); loadMats(); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Issue failed"); }
  };

  const lowCount = mats.filter((m) => m.stock_qty <= m.min_stock).length;

  return (
    <div className="p-6 lg:p-8" data-testid="inventory-page">
      <PageHeader
        subtitle="Store"
        title="Inventory"
        action={
          canWrite && (
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={openIn} data-testid="stock-in-btn"><ArrowDown size={14} weight="bold" /> Stock In</Btn>
              <Btn variant="ghost" onClick={openOut} data-testid="stock-out-btn"><ArrowUp size={14} weight="bold" /> Stock Out</Btn>
              <Btn onClick={openMatCreate} data-testid="material-create-btn"><Plus size={14} weight="bold" /> Material</Btn>
            </div>
          )
        }
      />

      {lowCount > 0 && (
        <div className="mb-4 lumia-surface p-4 border-l-4 border-l-red-600 flex items-center gap-3" data-testid="low-stock-banner">
          <Warning size={22} weight="fill" className="text-red-600" />
          <div>
            <div className="text-sm font-bold text-slate-900">{lowCount} material(s) below minimum stock</div>
            <div className="text-xs text-slate-500">Reorder soon to avoid production delays.</div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-300 mb-4">
        {[["master", "Material Master"], ["moves", "Stock Movements"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`inv-tab-${k}`}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 -mb-[1px] ${tab === k ? "border-[#0F3BE8] text-[#0F3BE8]" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{l}</button>
        ))}
      </div>

      {tab === "master" && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input data-testid="material-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name, category…"
                className="pl-9 pr-3 py-2 w-72 bg-white border border-slate-300 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8]" />
            </div>
            <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="!w-44" data-testid="material-cat-filter">
              <option value="">All categories</option>
              {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div className="lumia-surface overflow-x-auto">
            {mats.length === 0 ? <Empty title="No materials yet" /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                  <th className="text-left px-4 py-2 font-semibold">Code</th>
                  <th className="text-left px-4 py-2 font-semibold">Name</th>
                  <th className="text-left px-4 py-2 font-semibold">Category</th>
                  <th className="text-left px-4 py-2 font-semibold">Supplier</th>
                  <th className="text-right px-4 py-2 font-semibold">Stock</th>
                  <th className="text-right px-4 py-2 font-semibold">Min</th>
                  <th className="text-right px-4 py-2 font-semibold">Buy ₹</th>
                  <th className="text-right px-4 py-2 font-semibold">Sell ₹</th>
                  <th className="text-right px-4 py-2 font-semibold">Value</th>
                  {canWrite && <th className="text-right px-4 py-2 font-semibold">Actions</th>}
                </tr></thead>
                <tbody>
                  {mats.map((m) => {
                    const low = m.stock_qty <= m.min_stock;
                    return (
                      <tr key={m.id} className={`border-t border-slate-200 hover:bg-slate-50 ${low ? "bg-red-50/30" : ""}`} data-testid={`material-row-${m.id}`}>
                        <td className="px-4 py-3 font-mono-num text-slate-700">{m.code}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{m.name}</td>
                        <td className="px-4 py-3"><span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-700 border-slate-300">{m.category}</span></td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{m.supplier_name || "—"}</td>
                        <td className={`px-4 py-3 text-right font-mono-num ${low ? "text-red-600 font-bold" : ""}`}>{m.stock_qty} {m.unit}</td>
                        <td className="px-4 py-3 text-right font-mono-num text-slate-500">{m.min_stock}</td>
                        <td className="px-4 py-3 text-right font-mono-num">{fmtINR(m.purchase_rate)}</td>
                        <td className="px-4 py-3 text-right font-mono-num">{fmtINR(m.selling_rate)}</td>
                        <td className="px-4 py-3 text-right font-mono-num font-bold">{fmtINR(m.stock_qty * m.purchase_rate)}</td>
                        {canWrite && (
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openMatEdit(m)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5"><PencilSimple size={16} weight="bold" /></button>
                            <button onClick={() => removeMat(m.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "moves" && (
        <div className="lumia-surface overflow-x-auto">
          {moves.length === 0 ? <Empty title="No movements yet" /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">Date</th>
                <th className="text-left px-4 py-2 font-semibold">Material</th>
                <th className="text-left px-4 py-2 font-semibold">Type</th>
                <th className="text-right px-4 py-2 font-semibold">Qty</th>
                <th className="text-right px-4 py-2 font-semibold">Rate</th>
                <th className="text-right px-4 py-2 font-semibold">Amount</th>
                <th className="text-left px-4 py-2 font-semibold">Project / Supplier</th>
                <th className="text-left px-4 py-2 font-semibold">Note</th>
              </tr></thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 text-xs">{new Date(m.created_at).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{m.material_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${m.type === "in" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-red-50 text-red-800 border-red-300"}`}>
                        {m.type === "in" ? "STOCK IN" : "STOCK OUT"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num font-bold">{m.qty}</td>
                    <td className="px-4 py-3 text-right font-mono-num">{fmtINR(m.rate)}</td>
                    <td className="px-4 py-3 text-right font-mono-num">{fmtINR(m.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{m.type === "out" ? `${m.project_no || ""} ${m.project_name || ""}` : m.supplier_name || ""}</td>
                    <td className="px-4 py-3 text-slate-600">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Material Modal */}
      <Modal open={matOpen} onClose={() => setMatOpen(false)} title={matEditing ? "Edit Material" : "New Material"} testid="material-modal">
        <form onSubmit={saveMat} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Item Code *"><Input required value={matForm.code} onChange={(e) => setMatForm({ ...matForm, code: e.target.value })} data-testid="material-input-code" /></Field>
            <Field label="Item Name *"><Input required value={matForm.name} onChange={(e) => setMatForm({ ...matForm, name: e.target.value })} data-testid="material-input-name" /></Field>
            <Field label="Category">
              <Select value={matForm.category} onChange={(e) => setMatForm({ ...matForm, category: e.target.value })} data-testid="material-input-category">
                {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Unit"><Input value={matForm.unit} onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })} /></Field>
            <Field label="Current Stock"><Input type="number" value={matForm.stock_qty} onChange={(e) => setMatForm({ ...matForm, stock_qty: e.target.value })} /></Field>
            <Field label="Minimum Stock"><Input type="number" value={matForm.min_stock} onChange={(e) => setMatForm({ ...matForm, min_stock: e.target.value })} /></Field>
            <Field label="Purchase Rate (₹)"><Input type="number" value={matForm.purchase_rate} onChange={(e) => setMatForm({ ...matForm, purchase_rate: e.target.value })} /></Field>
            <Field label="Selling Rate (₹)"><Input type="number" value={matForm.selling_rate} onChange={(e) => setMatForm({ ...matForm, selling_rate: e.target.value })} /></Field>
            <Field label="Supplier">
              <Select value={matForm.supplier_id || ""} onChange={(e) => setMatForm({ ...matForm, supplier_id: e.target.value })}>
                <option value="">— None —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setMatOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="material-submit-btn">{matEditing ? "Update" : "Create"}</Btn>
          </div>
        </form>
      </Modal>

      {/* Stock In Modal */}
      <Modal open={inOpen} onClose={() => setInOpen(false)} title="Stock In" testid="stockin-modal">
        <form onSubmit={saveIn} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date"><Input type="date" value={inForm.date} onChange={(e) => setInForm({ ...inForm, date: e.target.value })} /></Field>
            <Field label="Supplier">
              <Select value={inForm.supplier_id} onChange={(e) => setInForm({ ...inForm, supplier_id: e.target.value })} data-testid="stockin-input-supplier">
                <option value="">— Not specified —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Material *">
            <Select required value={inForm.material_id} onChange={(e) => { const m = mats.find((x) => x.id === e.target.value); setInForm({ ...inForm, material_id: e.target.value, rate: m?.purchase_rate || inForm.rate }); }} data-testid="stockin-input-material">
              <option value="">— Select —</option>
              {mats.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name} (stock {m.stock_qty})</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity *"><Input required type="number" min="0.01" step="0.01" value={inForm.qty} onChange={(e) => setInForm({ ...inForm, qty: e.target.value })} data-testid="stockin-input-qty" /></Field>
            <Field label="Rate (₹) *"><Input required type="number" min="0" step="0.01" value={inForm.rate} onChange={(e) => setInForm({ ...inForm, rate: e.target.value })} /></Field>
          </div>
          <div className="text-right text-sm">
            <span className="text-slate-500">Amount:</span>{" "}
            <span className="font-mono-num text-xl font-black text-[#0F3BE8]">{fmtINR((Number(inForm.qty) || 0) * (Number(inForm.rate) || 0))}</span>
          </div>
          <Field label="Note"><Input value={inForm.note} onChange={(e) => setInForm({ ...inForm, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setInOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="stockin-submit-btn">Add Stock</Btn>
          </div>
        </form>
      </Modal>

      {/* Stock Out Modal */}
      <Modal open={outOpen} onClose={() => setOutOpen(false)} title="Stock Out (Issue to Project)" testid="stockout-modal">
        <form onSubmit={saveOut} className="space-y-4">
          <Field label="Project *">
            <Select required value={outForm.project_id} onChange={(e) => setOutForm({ ...outForm, project_id: e.target.value })} data-testid="stockout-input-project">
              <option value="">— Select project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
            </Select>
          </Field>
          <Field label="Material *">
            <Select required value={outForm.material_id} onChange={(e) => setOutForm({ ...outForm, material_id: e.target.value })} data-testid="stockout-input-material">
              <option value="">— Select —</option>
              {mats.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name} (available {m.stock_qty} {m.unit})</option>)}
            </Select>
          </Field>
          <Field label="Quantity *"><Input required type="number" min="0.01" step="0.01" value={outForm.qty} onChange={(e) => setOutForm({ ...outForm, qty: e.target.value })} data-testid="stockout-input-qty" /></Field>
          <Field label="Note"><Input value={outForm.note} onChange={(e) => setOutForm({ ...outForm, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOutOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="stockout-submit-btn">Issue Stock</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
