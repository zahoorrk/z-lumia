import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Modal, Field, Input, Select, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, Package, ArrowDown, ArrowUp, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const emptyMat = { code: "", name: "", category: "General", unit: "pcs", stock_qty: 0, reorder_level: 0, unit_cost: 0 };
const emptyMove = { material_id: "", type: "in", qty: 1, project_id: "", note: "" };

export default function Inventory() {
  const { user } = useAuth();
  const canWrite = ["admin", "store"].includes(user?.role);
  const [tab, setTab] = useState("master");
  const [mats, setMats] = useState([]);
  const [moves, setMoves] = useState([]);
  const [projects, setProjects] = useState([]);

  const [matOpen, setMatOpen] = useState(false);
  const [matEditing, setMatEditing] = useState(null);
  const [matForm, setMatForm] = useState(emptyMat);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveForm, setMoveForm] = useState(emptyMove);

  const load = async () => {
    const [m, sm, pj] = await Promise.all([
      api.get("/materials"),
      api.get("/stock-movements").catch(() => ({ data: [] })),
      api.get("/projects").catch(() => ({ data: [] })),
    ]);
    setMats(m.data); setMoves(sm.data); setProjects(pj.data);
  };
  useEffect(() => { load(); }, []);

  const openMatCreate = () => { setMatEditing(null); setMatForm(emptyMat); setMatOpen(true); };
  const openMatEdit = (m) => { setMatEditing(m); setMatForm({ ...emptyMat, ...m }); setMatOpen(true); };

  const saveMat = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...matForm,
        stock_qty: Number(matForm.stock_qty) || 0,
        reorder_level: Number(matForm.reorder_level) || 0,
        unit_cost: Number(matForm.unit_cost) || 0,
      };
      if (matEditing) await api.put(`/materials/${matEditing.id}`, payload);
      else await api.post("/materials", payload);
      toast.success(matEditing ? "Material updated" : "Material created");
      setMatOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  const removeMat = async (id) => {
    if (!window.confirm("Delete material?")) return;
    await api.delete(`/materials/${id}`);
    load();
  };

  const openMoveCreate = (type) => {
    setMoveForm({ ...emptyMove, type, material_id: mats[0]?.id || "" });
    setMoveOpen(true);
  };
  const saveMove = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...moveForm, qty: Number(moveForm.qty) || 0, project_id: moveForm.project_id || null };
      await api.post("/stock-movements", payload);
      toast.success("Stock movement recorded");
      setMoveOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  return (
    <div className="p-6 lg:p-8" data-testid="inventory-page">
      <PageHeader
        subtitle="Store"
        title="Inventory"
        action={
          canWrite && (
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => openMoveCreate("in")} data-testid="stock-in-btn"><ArrowDown size={14} weight="bold" /> Stock In</Btn>
              <Btn variant="ghost" onClick={() => openMoveCreate("out")} data-testid="stock-out-btn"><ArrowUp size={14} weight="bold" /> Stock Out</Btn>
              <Btn onClick={openMatCreate} data-testid="material-create-btn"><Plus size={14} weight="bold" /> Material</Btn>
            </div>
          )
        }
      />

      <div className="flex gap-1 border-b border-slate-300 mb-4">
        {[
          ["master", "Material Master"],
          ["moves", "Stock Movements"],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            data-testid={`inv-tab-${k}`}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 -mb-[1px] ${
              tab === k ? "border-[#0F3BE8] text-[#0F3BE8]" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "master" && (
        <div className="lumia-surface overflow-x-auto">
          {mats.length === 0 ? (
            <Empty title="No materials yet" note="Add your first material to the master." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                  <th className="text-left px-4 py-2 font-semibold">Code</th>
                  <th className="text-left px-4 py-2 font-semibold">Name</th>
                  <th className="text-left px-4 py-2 font-semibold">Category</th>
                  <th className="text-right px-4 py-2 font-semibold">Stock</th>
                  <th className="text-right px-4 py-2 font-semibold">Reorder</th>
                  <th className="text-right px-4 py-2 font-semibold">Unit Cost</th>
                  <th className="text-right px-4 py-2 font-semibold">Value</th>
                  {canWrite && <th className="text-right px-4 py-2 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {mats.map((m) => {
                  const low = m.stock_qty <= m.reorder_level;
                  return (
                    <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`material-row-${m.id}`}>
                      <td className="px-4 py-3 font-mono-num text-slate-700">{m.code}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{m.name}</td>
                      <td className="px-4 py-3 text-slate-600">{m.category}</td>
                      <td className={`px-4 py-3 text-right font-mono-num ${low ? "text-red-600 font-bold" : ""}`}>{m.stock_qty} {m.unit}</td>
                      <td className="px-4 py-3 text-right font-mono-num text-slate-500">{m.reorder_level}</td>
                      <td className="px-4 py-3 text-right font-mono-num">{fmtINR(m.unit_cost)}</td>
                      <td className="px-4 py-3 text-right font-mono-num font-bold">{fmtINR(m.stock_qty * m.unit_cost)}</td>
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
      )}

      {tab === "moves" && (
        <div className="lumia-surface overflow-x-auto">
          {moves.length === 0 ? (
            <Empty title="No movements yet" note="Record a stock-in or stock-out." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                  <th className="text-left px-4 py-2 font-semibold">Date</th>
                  <th className="text-left px-4 py-2 font-semibold">Material</th>
                  <th className="text-left px-4 py-2 font-semibold">Type</th>
                  <th className="text-right px-4 py-2 font-semibold">Qty</th>
                  <th className="text-left px-4 py-2 font-semibold">Note</th>
                </tr>
              </thead>
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
            <Field label="Code *"><Input required value={matForm.code} onChange={(e) => setMatForm({ ...matForm, code: e.target.value })} data-testid="material-input-code" /></Field>
            <Field label="Name *"><Input required value={matForm.name} onChange={(e) => setMatForm({ ...matForm, name: e.target.value })} data-testid="material-input-name" /></Field>
            <Field label="Category"><Input value={matForm.category} onChange={(e) => setMatForm({ ...matForm, category: e.target.value })} /></Field>
            <Field label="Unit"><Input value={matForm.unit} onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })} /></Field>
            <Field label="Stock Qty"><Input type="number" value={matForm.stock_qty} onChange={(e) => setMatForm({ ...matForm, stock_qty: e.target.value })} /></Field>
            <Field label="Reorder Level"><Input type="number" value={matForm.reorder_level} onChange={(e) => setMatForm({ ...matForm, reorder_level: e.target.value })} /></Field>
            <Field label="Unit Cost (₹)"><Input type="number" value={matForm.unit_cost} onChange={(e) => setMatForm({ ...matForm, unit_cost: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setMatOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="material-submit-btn">{matEditing ? "Update" : "Create"}</Btn>
          </div>
        </form>
      </Modal>

      {/* Movement Modal */}
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={`Stock ${moveForm.type === "in" ? "In" : "Out"}`} testid="stock-modal">
        <form onSubmit={saveMove} className="space-y-4">
          <Field label="Material *">
            <Select required value={moveForm.material_id} onChange={(e) => setMoveForm({ ...moveForm, material_id: e.target.value })} data-testid="stock-input-material">
              <option value="">— Select material —</option>
              {mats.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name} (stock {m.stock_qty})</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty *"><Input required type="number" min="0.01" step="0.01" value={moveForm.qty} onChange={(e) => setMoveForm({ ...moveForm, qty: e.target.value })} data-testid="stock-input-qty" /></Field>
            <Field label="Project (optional)">
              <Select value={moveForm.project_id} onChange={(e) => setMoveForm({ ...moveForm, project_id: e.target.value })}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Note"><Input value={moveForm.note} onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setMoveOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="stock-submit-btn">Record</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
