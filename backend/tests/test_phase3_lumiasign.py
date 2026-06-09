"""
LUMIASIGN ERP Phase 3 Backend Tests.
Covers: Invoices (create/update/payments/delete) with GST split (intra/inter state),
GST summary + monthly, CEO dashboard, profit analytics (by-client/by-category),
Project Health, AI cost estimator (Emergent LLM), WhatsApp/Email deep-links,
Notifications, Audit log (admin), Documents CRUD, CSV report exports,
Cost.subcontract_cost rollup.
"""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

CREDS = {
    "admin":        ("admin@lumiasign.com", "admin123"),
    "sales":        ("sales@lumiasign.com", "lumia123"),
    "accounts":     ("accounts@lumiasign.com", "lumia123"),
    "production":   ("production@lumiasign.com", "lumia123"),
    "store":        ("store@lumiasign.com", "lumia123"),
    "installation": ("installation@lumiasign.com", "lumia123"),
}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="session")
def tokens():
    return {role: _login(*creds) for role, creds in CREDS.items()}


@pytest.fixture(scope="session")
def any_project_id(tokens):
    r = requests.get(f"{BASE_URL}/api/projects", headers=H(tokens["sales"]))
    assert r.status_code == 200, r.text
    projects = r.json()
    assert projects, "Seed should contain at least one project"
    return projects[0]["id"]


# ---------- INVOICES ----------
class TestInvoices:
    def test_create_invoice_intra_state_splits_cgst_sgst(self, tokens, any_project_id):
        payload = {
            "project_id": any_project_id,
            "client_name": "TEST_Intra Client",
            "client_state": "Maharashtra",
            "items": [
                {"description": "Signage Board", "qty": 2, "unit_price": 10000},
                {"description": "Installation", "qty": 1, "unit_price": 5000},
            ],
            "gst_pct": 18.0,
            "advance_received": 5000,
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["subtotal"] == 25000.0
        assert inv["gst_amount"] == 4500.0
        assert inv["total"] == 29500.0
        assert inv["cgst"] == 2250.0 and inv["sgst"] == 2250.0
        assert inv["igst"] == 0.0
        assert inv["amount_received"] == 5000
        assert inv["outstanding"] == 24500.0
        assert inv["status"] == "partial"
        assert inv["invoice_no"].startswith("INV-6")
        # persistence
        r2 = requests.get(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]))
        assert any(i["id"] == inv["id"] for i in r2.json())
        pytest.shared_inv_intra = inv["id"]
        pytest.shared_inv_intra_no = inv["invoice_no"]

    def test_create_invoice_inter_state_uses_igst(self, tokens, any_project_id):
        payload = {
            "project_id": any_project_id,
            "client_name": "TEST_Inter Client",
            "client_state": "Karnataka",
            "items": [{"description": "Pylon", "qty": 1, "unit_price": 100000}],
            "gst_pct": 18.0,
            "advance_received": 0,
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["subtotal"] == 100000.0
        assert inv["gst_amount"] == 18000.0
        assert inv["total"] == 118000.0
        assert inv["igst"] == 18000.0
        assert inv["cgst"] == 0.0 and inv["sgst"] == 0.0
        assert inv["outstanding"] == 118000.0
        assert inv["status"] == "draft"
        pytest.shared_inv_inter = inv["id"]

    def test_update_invoice_recomputes(self, tokens, any_project_id):
        inv_id = pytest.shared_inv_inter
        payload = {
            "project_id": any_project_id,
            "client_name": "TEST_Inter Client",
            "client_state": "Karnataka",
            "items": [{"description": "Pylon", "qty": 2, "unit_price": 100000}],
            "gst_pct": 18.0,
        }
        r = requests.put(f"{BASE_URL}/api/invoices/{inv_id}", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["subtotal"] == 200000.0
        assert inv["total"] == 236000.0
        assert inv["igst"] == 36000.0

    def test_add_payment_partial_then_full(self, tokens):
        inv_id = pytest.shared_inv_intra
        # Partial
        r = requests.post(
            f"{BASE_URL}/api/invoices/{inv_id}/payments",
            headers=H(tokens["accounts"]),
            json={"amount": 10000, "mode": "upi", "note": "TEST partial"},
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        # advance(5000) + payment(10000) = 15000
        assert inv["amount_received"] == 15000.0
        assert inv["outstanding"] == 14500.0
        assert inv["status"] == "partial"
        pay_id = inv["payments"][-1]["id"]
        pytest.shared_pay_id = pay_id

        # Top-up to full
        r = requests.post(
            f"{BASE_URL}/api/invoices/{inv_id}/payments",
            headers=H(tokens["accounts"]),
            json={"amount": 14500, "mode": "bank", "note": "TEST final"},
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["amount_received"] == 29500.0
        assert inv["outstanding"] == 0.0
        assert inv["status"] == "paid"

    def test_update_rejected_on_fully_paid(self, tokens, any_project_id):
        inv_id = pytest.shared_inv_intra
        payload = {
            "project_id": any_project_id,
            "client_name": "TEST_Intra Client",
            "client_state": "Maharashtra",
            "items": [{"description": "Edit", "qty": 1, "unit_price": 1}],
            "gst_pct": 18.0,
        }
        r = requests.put(f"{BASE_URL}/api/invoices/{inv_id}", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 400, r.text

    def test_delete_payment_requires_admin_and_reverses(self, tokens):
        inv_id = pytest.shared_inv_intra
        pay_id = pytest.shared_pay_id
        # Non-admin (accounts) blocked
        r = requests.delete(f"{BASE_URL}/api/invoices/{inv_id}/payments/{pay_id}", headers=H(tokens["accounts"]))
        assert r.status_code == 403, r.text
        # Admin succeeds
        r = requests.delete(f"{BASE_URL}/api/invoices/{inv_id}/payments/{pay_id}", headers=H(tokens["admin"]))
        assert r.status_code == 200, r.text
        inv = r.json()
        # 15000 + 14500 reduced by 10000 (the deleted partial) = 19500. advance 5000 + final 14500 = 19500.
        assert inv["amount_received"] == 19500.0
        assert inv["outstanding"] == 10000.0
        assert inv["status"] == "partial"


# ---------- GST REPORTS ----------
class TestGST:
    def test_gst_summary_fields(self, tokens):
        r = requests.get(f"{BASE_URL}/api/gst/summary", headers=H(tokens["accounts"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("output_subtotal", "output_gst", "output_cgst", "output_sgst", "output_igst",
                  "input_subtotal", "input_gst", "net_payable"):
            assert k in d, k
        # net_payable = output_gst - input_gst
        assert round(d["net_payable"], 2) == round(d["output_gst"] - d["input_gst"], 2)
        # output_gst ~ output_cgst+output_sgst+output_igst (tolerance for rounding)
        assert abs((d["output_cgst"] + d["output_sgst"] + d["output_igst"]) - d["output_gst"]) < 1.0

    def test_gst_monthly_bucketed(self, tokens):
        r = requests.get(f"{BASE_URL}/api/gst/monthly", headers=H(tokens["accounts"]))
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            row = rows[0]
            for k in ("month", "subtotal", "gst", "cgst", "sgst", "igst", "total", "count"):
                assert k in row, k


# ---------- CEO Dashboard ----------
class TestCEODashboard:
    def test_dashboard_structure_and_health_score(self, tokens):
        r = requests.get(f"{BASE_URL}/api/ceo/dashboard", headers=H(tokens["admin"]))
        assert r.status_code == 200, r.text
        d = r.json()
        keys = ["revenue", "profit", "profit_pct", "outstanding", "inventory_value",
                "outstanding_payable", "total_invoiced", "total_collected", "collection_efficiency",
                "pending_projects", "in_production", "in_installation", "completed_projects",
                "installations_pending", "monthly", "top_profitable", "top_loss",
                "top_clients", "least_profitable_clients", "revenue_growth_pct",
                "profit_growth_pct", "avg_project_margin_pct", "business_health_score"]
        for k in keys:
            assert k in d, k
        assert isinstance(d["monthly"], list)
        assert isinstance(d["top_profitable"], list) and len(d["top_profitable"]) <= 10
        assert isinstance(d["top_loss"], list) and len(d["top_loss"]) <= 10
        assert isinstance(d["top_clients"], list) and len(d["top_clients"]) <= 5
        assert isinstance(d["least_profitable_clients"], list) and len(d["least_profitable_clients"]) <= 5
        assert 0 <= d["business_health_score"] <= 100

    def test_dashboard_rbac(self, tokens):
        # sales should be forbidden
        r = requests.get(f"{BASE_URL}/api/ceo/dashboard", headers=H(tokens["sales"]))
        assert r.status_code == 403
        # accounts allowed
        r = requests.get(f"{BASE_URL}/api/ceo/dashboard", headers=H(tokens["accounts"]))
        assert r.status_code == 200


# ---------- PROFIT ANALYTICS ----------
class TestProfitAnalytics:
    def test_profit_by_client_sorted_desc(self, tokens):
        r = requests.get(f"{BASE_URL}/api/analytics/profit-by-client", headers=H(tokens["accounts"]))
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            for c in rows:
                for k in ("client_name", "revenue", "cost", "profit", "projects", "margin_pct"):
                    assert k in c, k
            # sorted desc by revenue
            revs = [c["revenue"] for c in rows]
            assert revs == sorted(revs, reverse=True)

    def test_profit_by_category(self, tokens):
        r = requests.get(f"{BASE_URL}/api/analytics/profit-by-category", headers=H(tokens["accounts"]))
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            for c in rows:
                for k in ("category", "revenue", "cost", "profit", "count"):
                    assert k in c, k


# ---------- PROJECT HEALTH ----------
class TestProjectHealth:
    def test_health_structure_and_colors(self, tokens, any_project_id):
        r = requests.get(f"{BASE_URL}/api/projects/{any_project_id}/health", headers=H(tokens["admin"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("profitability", "delay_risk", "material_risk", "payment_risk", "overall_score", "overall_color"):
            assert k in d, k
        for k in ("profitability", "delay_risk", "material_risk", "payment_risk"):
            assert "score" in d[k] and "color" in d[k]
            assert d[k]["color"] in ("green", "yellow", "red")
        assert d["overall_color"] in ("green", "yellow", "red")
        assert 0 <= d["overall_score"] <= 100


# ---------- AI COST ESTIMATOR ----------
class TestAIEstimator:
    def test_ai_cost_estimate_signage(self, tokens):
        payload = {
            "project_type": "LED Signage",
            "project_size": "10x4 ft",
            "material_type": "ACP+Acrylic",
            "lighting_type": "LED Backlit",
            "location": "Mumbai",
        }
        r = requests.post(f"{BASE_URL}/api/ai/cost-estimate", headers=H(tokens["sales"]), json=payload, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "input" in d and "estimate" in d
        est = d["estimate"]
        # Either parsed JSON with required keys OR a 'raw' fallback - both pass per spec
        if "raw" in est:
            assert isinstance(est["raw"], str) and est["raw"].strip()
        else:
            for k in ("material_cost", "labour_cost", "transport_cost", "overhead_cost",
                      "total_cost", "selling_price", "profit", "profit_pct"):
                assert k in est, f"Missing key {k} in estimate: {est}"

    def test_ai_cost_estimate_rbac(self, tokens):
        # production role must be forbidden
        r = requests.post(f"{BASE_URL}/api/ai/cost-estimate", headers=H(tokens["production"]),
                          json={"project_type": "x", "project_size": "y"})
        assert r.status_code == 403


# ---------- WHATSAPP / EMAIL ----------
class TestMessaging:
    def test_whatsapp_link_for_invoice(self, tokens):
        inv_id = pytest.shared_inv_intra
        # fetch invoice for invoice_no/outstanding
        inv = next(i for i in requests.get(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"])).json() if i["id"] == inv_id)
        r = requests.get(
            f"{BASE_URL}/api/messaging/whatsapp-link",
            headers=H(tokens["sales"]),
            params={"phone": "+91 99999 99999", "template": "invoice_generated", "invoice_id": inv_id},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["link"].startswith("https://wa.me/919999999999?text=")
        assert inv["invoice_no"] in d["text"]
        # total / outstanding mentioned (formatted with comma)
        assert "outstanding" in d["text"].lower() or "Payment due" in d["text"]

    def test_email_link_for_project(self, tokens, any_project_id):
        r = requests.get(
            f"{BASE_URL}/api/messaging/email-link",
            headers=H(tokens["sales"]),
            params={"to": "foo@bar.com", "template": "quotation_ready", "project_id": any_project_id},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["link"].startswith("mailto:foo@bar.com?")
        assert "Quotation" in d["subject"]
        assert d["text"].strip()


# ---------- NOTIFICATIONS ----------
class TestNotifications:
    def test_notifications_contains_low_stock(self, tokens):
        r = requests.get(f"{BASE_URL}/api/notifications", headers=H(tokens["admin"]))
        assert r.status_code == 200, r.text
        notes = r.json()
        assert isinstance(notes, list)
        kinds = {n["kind"] for n in notes}
        assert "low_stock" in kinds, f"Expected low_stock notifications, got kinds: {kinds}"
        for n in notes:
            for k in ("kind", "severity", "title", "message", "ref_id"):
                assert k in n, k


# ---------- AUDIT LOG ----------
class TestAuditLog:
    def test_audit_log_admin_only(self, tokens):
        # non-admin blocked
        r = requests.get(f"{BASE_URL}/api/audit-log", headers=H(tokens["accounts"]))
        assert r.status_code == 403
        # admin allowed
        r = requests.get(f"{BASE_URL}/api/audit-log", headers=H(tokens["admin"]))
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        # at least one entry from invoice creation above
        invoice_entries = [x for x in rows if x.get("module") == "invoices"]
        assert invoice_entries, "Expected at least one audit entry for invoices module"
        for e in invoice_entries[:3]:
            for k in ("user_id", "user_name", "user_role", "module", "action"):
                assert k in e, k


# ---------- DOCUMENTS ----------
class TestDocuments:
    def test_documents_crud(self, tokens, any_project_id):
        # Create
        r = requests.post(
            f"{BASE_URL}/api/documents",
            headers=H(tokens["sales"]),
            json={"title": "TEST_Doc Quote", "kind": "quotation", "project_id": any_project_id, "url": "https://example.com/q.pdf"},
        )
        assert r.status_code == 200, r.text
        doc = r.json(); doc_id = doc["id"]
        assert doc["title"] == "TEST_Doc Quote"
        assert doc["kind"] == "quotation"

        # List
        r = requests.get(f"{BASE_URL}/api/documents", headers=H(tokens["sales"]))
        assert r.status_code == 200
        assert any(d["id"] == doc_id for d in r.json())

        # Filter by project_id
        r = requests.get(f"{BASE_URL}/api/documents?project_id={any_project_id}", headers=H(tokens["sales"]))
        assert r.status_code == 200
        assert all(d["project_id"] == any_project_id for d in r.json())

        # Delete
        r = requests.delete(f"{BASE_URL}/api/documents/{doc_id}", headers=H(tokens["sales"]))
        assert r.status_code == 200

        # Verify removed
        r = requests.get(f"{BASE_URL}/api/documents", headers=H(tokens["sales"]))
        assert not any(d["id"] == doc_id for d in r.json())


# ---------- REPORTS / CSV ----------
class TestReports:
    @pytest.mark.parametrize("kind", ["revenue", "gst", "inventory", "purchases", "outstanding", "clients"])
    def test_export_csv_kinds(self, tokens, kind):
        r = requests.get(f"{BASE_URL}/api/reports/export", params={"kind": kind}, headers=H(tokens["accounts"]))
        assert r.status_code == 200, f"{kind}: {r.text}"
        assert "text/plain" in r.headers.get("content-type", "").lower()
        # Body is a string (may be empty if no data for that kind)
        assert isinstance(r.text, str)

    def test_export_unknown_kind_400(self, tokens):
        r = requests.get(f"{BASE_URL}/api/reports/export", params={"kind": "bogus"}, headers=H(tokens["accounts"]))
        assert r.status_code == 400


# ---------- SUBCONTRACT COST ----------
class TestSubcontractCost:
    def test_subcontract_cost_in_total(self, tokens, any_project_id):
        # baseline
        r = requests.put(
            f"{BASE_URL}/api/costs/{any_project_id}",
            headers=H(tokens["accounts"]),
            json={"material_cost": 1000, "labour_cost": 500, "transport_cost": 100,
                  "machine_cost": 50, "overhead_cost": 100, "subcontract_cost": 0},
        )
        assert r.status_code == 200, r.text
        base = r.json()
        assert base["total_cost"] == 1750.0
        assert base.get("subcontract_cost") == 0

        # set subcontract_cost only
        r = requests.put(
            f"{BASE_URL}/api/costs/{any_project_id}",
            headers=H(tokens["accounts"]),
            json={"subcontract_cost": 2500},
        )
        assert r.status_code == 200, r.text
        upd = r.json()
        assert upd["subcontract_cost"] == 2500
        # 1000+500+100+50+100+2500 = 4250
        assert upd["total_cost"] == 4250.0


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_invoices(tokens):
    yield
    # Best-effort cleanup of TEST_ invoices created in this run
    try:
        admin = tokens["admin"]
        r = requests.get(f"{BASE_URL}/api/invoices", headers=H(admin))
        for inv in r.json():
            if str(inv.get("client_name", "")).startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/invoices/{inv['id']}", headers=H(admin))
    except Exception:
        pass
