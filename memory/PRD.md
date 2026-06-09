# LUMIASIGN ERP — Product Requirements Document

## Architecture
- **Frontend**: React 19 + Tailwind + Phosphor icons + Recharts + Sonner + jsPDF
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + bcrypt
- **Auth**: JWT Bearer tokens (7-day expiry), bcrypt password hashing
- **Storage**: MongoDB. Photos & signatures stored as base64 data URLs (compressed client-side to max 1024px @ 70% JPEG)
- **PDF**: Client-side jsPDF for completion reports

## Roles (RBAC, admin bypasses)
| Role | Access |
|------|--------|
| Admin | All modules |
| Sales | Leads, Quotations, Projects (incl. Approve), Installation scheduling |
| Production | Projects, Production stages, Inventory consume, Costing, Mark production complete |
| Store | Inventory, Materials, Stock in/out, Suppliers, Purchases (create+receive) |
| Accounts | Quotations, Suppliers, Purchases (approve), Vendor payments, Costing, Profit, Reports |
| Installation | Installation scheduling + photos + signoff |

## Modules

### Inventory
- 10-category Material Master (ACP/Acrylic/SS/LED Modules/Drivers/Vinyl/MS Pipe/Electrical/Hardware/Paint)
- Fields: code, name, category, unit, current/min stock, purchase rate, selling rate, supplier
- Stock In (date, supplier, material, qty, rate, amount) → auto-increments stock & updates purchase rate
- Stock Out (project, material, qty) → auto-decrements stock, rejects negative, **auto-rolls cost into project material_cost**
- Low stock dashboard alert (stock ≤ min_stock)

### Purchases / Procurement
- PO: po_no auto, supplier, material, qty, rate, GST %, GST amount, total, purchase date
- Payment terms: cash (auto-paid) / credit (pending)
- Workflow: pending → approved (by Accounts) → received (by Store, increments stock)
- Suppliers: name, mobile, GST, address + computed PO count / total purchases / outstanding
- Vendor payments: record partial/full payments, auto-updates PO payment_status (pending/partial/paid)
- Supplier ledger view with full billed/paid/outstanding

### Production
- 8 fixed stages auto-created per job: Cutting → Fabrication → Welding → Painting → LED Assembly → Quality Check → Packing → Dispatch
- Each stage: pending → in_progress → completed (click to cycle)
- Job number auto JOB-XXXX, progress % auto-computed
- **Business rule**: Project must be `approved` before production can start
- When all 8 stages complete → project.production_completed=true, status→installation

### Installation
- Auto INS-XXXX number; project, site, team leader, date, status
- 3 photo buckets: before / during / after (upload via file picker, mobile camera supported)
- Client signature capture via canvas (mouse + touch)
- One-click PDF Completion Report download (jsPDF) with all details, photos, signature
- **Business rule**: Project must have production_completed=true before installation

### Dashboard
- 8 KPI tiles: Revenue, Profit, Pending projects, Completed, **Inventory Value, Low Stock, Production In Progress, Installations (pending/done)**
- **Margin alert banner**: lists projects under 15% margin threshold (auto-detected)
- Revenue trend chart, status pie, low stock table

### Other
- Profit Analysis with margin_alert flag per project
- Reports with outstanding_payable, purchase_count, purchase_total
- Roles seeded on startup with idempotent hashing

## Implemented (Phase 2 — Jun 2026)
- All Phase 1 +
- Suppliers module + Vendor ledger + Partial/full payment tracking
- 10-category material taxonomy with controlled dropdown
- Stock in/out forms with project linkage & auto-cost rollup
- GST-aware purchase orders with cash/credit payment terms
- PO approval workflow
- 8-stage production board with progress tracking
- Photo upload (compressed client-side) + Signature pad + PDF report
- Business rule guards (approved required for production, production complete required for installation, no negative stock)
- 15% margin auto-alert banner on dashboard
- 18/18 Phase 2 backend tests passing

## Backlog (P1)
- Atomic counters for PO/JOB/INS numbering (currently count_documents — race risk)
- GridFS / object storage for installation photos to escape 16MB BSON cap
- User audit trail on mutating endpoints
- Quotation → Project one-click conversion
- Email PDF report to client + WhatsApp installation reminders
- Custom margin threshold per project

## Backlog (P2)
- Multi-warehouse inventory
- Gantt timeline view per project
- AI-assisted quotation drafting (Emergent LLM key)
- Customer & vendor portals
- Mobile-first scan-in with QR codes per material
