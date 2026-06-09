# LUMIASIGN ERP — Product Requirements Document

## Original Problem Statement
Build a professional ERP system for LUMIASIGN LLP (signage manufacturing company). Must manage Leads, Quotations, Projects, Production, Inventory, Purchases, Installation, Costing, Profit Analysis, Reports. Role-based access (Admin, Sales, Production, Store, Accounts, Installation). Modern responsive UI, desktop + mobile. Admin dashboard with Revenue, Profit, Pending Projects, Completed Projects, Low Stock Alerts.

## Architecture
- **Frontend**: React 19 + Tailwind + Phosphor icons + Recharts + Sonner toasts
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + bcrypt
- **Auth**: JWT Bearer tokens (7-day expiry), bcrypt password hashing
- **Design**: Swiss / high-contrast light theme; Chivo + IBM Plex Sans; brand blue #0F3BE8 and safety orange #FF4B00; sharp borders, dense tables

## User Personas / Roles
| Role         | Access                                                       |
|--------------|--------------------------------------------------------------|
| Admin        | All modules                                                  |
| Sales        | Leads, Quotations, Projects, Installation (schedule)         |
| Production   | Projects, Production board, Inventory (consume), Costing     |
| Store        | Inventory, Materials, Stock movements, Purchases             |
| Accounts     | Quotations, Purchases, Costing, Profit Analysis, Reports     |
| Installation | Installation schedule + completion, Projects, Dashboard      |

## Implemented (June 2026)
- Authentication with seeded 6 role accounts; JWT Bearer; admin bypass on RBAC
- Dashboard: 4 KPI cards (Revenue / Profit / Pending / Completed), revenue trend chart, status pie chart, low-stock alert table
- Leads CRUD with status pipeline (new/contacted/qualified/won/lost) + search
- Quotations with line items, tax %, auto subtotal/total, status (draft/sent/approved/rejected), auto QT-XXXX numbering
- Projects with auto PRJ-XXXX numbering, search + status filter, status pipeline, auto-creates cost row
- Production kanban board (queued/cutting/printing/fabrication/finishing/qc/done) with progress
- Inventory: Material Master + Stock In/Out movements + low stock highlighting
- Purchases: PO with auto PO-XXXX numbering, mark received → auto stock-in
- Installation scheduling with project status auto-transition
- Costing: 5 cost heads (material/labour/transport/machine/overhead) with auto total
- Profit Analysis: per-project revenue/cost/profit/margin% with bar chart + export
- Reports summary tiles + CSV export
- Responsive sidebar with collapsible mobile drawer
- 36/36 backend integration tests passing

## P1 Backlog (next iterations)
- Quotation → Project conversion in one click
- File attachments (artwork, drawings) per project via object storage
- Credit purchases / vendor ledger + payment tracking
- Email PDF quotation to client (Resend integration)
- WhatsApp installation reminders to site team (Twilio)
- Per-user activity audit log
- Multi-user concurrent atomic numbering (Mongo counters)
- Cascade delete protection for projects with linked records
- Per-project material BOM with auto cost roll-up from stock movements
- Mobile-first scan-in for store keeper (QR codes on materials)

## P2 Backlog
- Project Gantt timeline view
- AI-assisted quotation drafting (Emergent LLM key)
- Multi-currency / GST-specific tax breakdown
- Customer portal for approving quotes online
- Vendor portal for accepting POs
- Real-time low-stock email/SMS alerts
- Production WhatsApp updates to client on stage change

## Next Tasks
1. Build Quotation → Project conversion flow
2. Implement credit purchases + vendor ledger (mentioned by user)
3. Add PDF export for quotations and invoices
4. Pre-population: connect production jobs auto-create when project moves to in_production
