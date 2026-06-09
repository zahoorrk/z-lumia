# LUMIASIGN ERP — PRD (Phase 1 → 3)

## Architecture
- **Frontend**: React 19 + Tailwind + Phosphor + Recharts + Sonner + jsPDF
- **Backend**: FastAPI + Motor + PyJWT + bcrypt + emergentintegrations (Gemini 2.5 Flash)
- **Auth**: JWT Bearer, bcrypt, RBAC (admin bypasses)
- **Storage**: MongoDB. Photos/signatures base64; documents stored as URL refs

## Roles & Modules Matrix

| Role | Access |
|------|--------|
| Admin | Everything + Audit Log + Payment reversal |
| Sales | Leads, Quotations, Projects (incl. approve), Installation, Invoices, AI Estimator |
| Production | Projects, Production stages, Inventory consume, Costing |
| Store | Inventory, Materials, Stock in/out, Suppliers, Purchases |
| Accounts | Quotations, Suppliers, Purchases (approve), Invoices, Vendor payments, Costing, Profit, CEO Cockpit, Reports, AI Estimator |
| Installation | Installation scheduling + photos + signoff |

## Phase 3 Modules (NEW)

### Invoices / GST
- Auto INV-6XXX numbering, GST-compliant Tax Invoice
- **Intra-state**: CGST + SGST split equally; **Inter-state**: full IGST
- Partial / advance / full payment tracking
- 5 payment modes (Cash/UPI/Bank/Cheque/Credit)
- Outstanding auto-computed (total − received)
- One-click PDF download (proper Indian GST format)
- WhatsApp + Email send (deep links — works without API keys)
- Admin-only payment reversal
- GST Summary + Monthly GST report
- Net GST payable = Output GST − Input GST (received POs)

### CEO Cockpit
- 8 KPI tiles: Revenue / Profit / Outstanding / Inventory / Collection Eff / In Production / In Installation / Avg Margin
- 4 Insight tiles: Revenue Growth %, Profit Growth %, Payable to Vendors, Pending Projects
- **Business Health Score** (0-100) — composite of margin + collection + outstanding + stock + workload
- Monthly Revenue + Monthly Profit charts
- Top 10 Profitable + Top 10 Loss-Making projects
- Top 5 Clients + Least Profitable Clients
- Real-time recalculated each load

### AI Cost Estimator
- Gemini 2.5 Flash via Emergent Universal Key
- Inputs: project type (10 options), size, material, lighting, location
- Returns: material/labour/transport/overhead/total cost + selling price + profit + breakdown + assumptions
- Used by Sales/Accounts/Admin

### Project Health Score
- 4 dimensions: Profitability / Delay Risk / Material Risk / Payment Risk
- Each green/yellow/red + numeric score
- Overall colour shows project at-a-glance status

### Notifications
- Bell in header (red badge with count)
- Low stock alerts, payment overdue, project delays, install due
- Auto-refresh every 60s

### Audit Log (Admin)
- Every invoice/document/AI action recorded
- User, role, module, action, ref id, timestamp

### Advanced Reports
- 6 CSV exports: Revenue, GST, Inventory, Purchases, Outstanding, Clients

### WhatsApp / Email "Automation"
- Deep-link generator (`wa.me/...?text=` and `mailto:`)
- 5 templates: Quotation Ready, Invoice Generated, Payment Pending, Project Completed, Installation Scheduled
- Works **today without any third-party API keys**
- Upgrade path to Twilio/Resend in env when ready

### Documents
- Lightweight document link store per project/entity
- Kind taxonomy: quotation/invoice/design/approval/completion/po/installation_photo/other

## Subcontract Cost
- Added as 6th cost head; rolls into project total_cost

## Tests
- Phase 1: 36/36 ✅
- Phase 2: 18/18 ✅
- Phase 3: 28/28 ✅
- **82/82 total backend tests passing**

## Known Optional Improvements
- Atomic counters for INV/PO/JOB/INS numbering (concurrency)
- Literal enum for payment mode validation
- text/csv MIME + Content-Disposition for downloads
- Role-scoped notification filtering
- Project-bound BOM for material_risk in health score
- Split server.py into routers (now 2097 lines)

## Roadmap
- Twilio WhatsApp Business API (when keys available)
- Resend / SendGrid email integration
- Multi-warehouse inventory
- Quotation → Project one-click conversion
- Customer + Vendor portals
- GST E-invoice / IRN integration
