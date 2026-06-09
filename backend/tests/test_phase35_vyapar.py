"""
LUMIASIGN ERP Phase 3.5 — Vyapar-style billing tests.

Covers:
- Invoice per-line discount_pct + tax_pct math (line-level vs header gst fallback)
- Invoice doc_type field (sale_invoice, estimate, proforma, delivery_challan, sale_return, credit_note)
- Parties module CRUD + aggregations (invoiced/received/receivable/billed/paid/payable/net_balance)
- Party ledger (entries + running balance + opening/closing/total_debit/total_credit)
- Expenses module (13 categories, EXP-7XXX, gst calc, role gating)
- Cash & Bank accounts (auto-seed Cash/Bank/UPI, inflow/outflow/balance)
- Daybook (date filtering, default today, in/out/net)
"""
import os
import pytest
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

CREDS = {
    "admin":    ("admin@lumiasign.com",    "admin123"),
    "accounts": ("accounts@lumiasign.com", "lumia123"),
    "sales":    ("sales@lumiasign.com",    "lumia123"),
    "store":    ("store@lumiasign.com",    "lumia123"),
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


# =====================================================================
# 1) Invoices — per-line discount + tax_pct math
# =====================================================================
class TestInvoiceLineDiscountTax:
    def test_per_line_discount_and_tax(self, tokens, any_project_id):
        """qty=2 @5000, disc 10%, tax 18%  +  qty=1 @3000, disc 0%, tax 12%
           → discount=1000, subtotal=12000, gst=1980, total=13980"""
        payload = {
            "project_id": any_project_id,
            "client_name": "TEST_LineDiscClient",
            "client_state": "Maharashtra",
            "items": [
                {"description": "Item A", "qty": 2, "unit_price": 5000, "discount_pct": 10, "tax_pct": 18},
                {"description": "Item B", "qty": 1, "unit_price": 3000, "discount_pct": 0,  "tax_pct": 12},
            ],
            "gst_pct": 18.0,
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["discount_total"] == 1000.0, f"discount_total={inv['discount_total']}"
        assert inv["subtotal"] == 12000.0, f"subtotal={inv['subtotal']}"
        assert inv["gst_amount"] == 1980.0, f"gst_amount={inv['gst_amount']}"
        assert inv["total"] == 13980.0, f"total={inv['total']}"
        # intra-state → cgst+sgst==gst, igst=0
        assert round(inv["cgst"] + inv["sgst"], 2) == 1980.0
        assert inv["igst"] == 0.0

    def test_line_tax_falls_back_to_header_gst_when_absent(self, tokens, any_project_id):
        """If items omit tax_pct entirely, server should fall back to header gst_pct.
        InvoiceItem.tax_pct default is 18.0 so even without sending it, GST should compute.
        """
        payload = {
            "project_id": any_project_id,
            "client_name": "TEST_HeaderGstFallback",
            "client_state": "Maharashtra",
            "items": [
                {"description": "Plain item", "qty": 1, "unit_price": 1000},
            ],
            "gst_pct": 18.0,
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["subtotal"] == 1000.0
        assert inv["gst_amount"] == 180.0
        assert inv["total"] == 1180.0

    def test_inter_state_uses_igst(self, tokens, any_project_id):
        payload = {
            "project_id": any_project_id,
            "client_name": "TEST_InterState",
            "client_state": "Karnataka",
            "items": [
                {"description": "Item", "qty": 1, "unit_price": 10000, "discount_pct": 0, "tax_pct": 18},
            ],
            "gst_pct": 18.0,
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["igst"] == 1800.0
        assert inv["cgst"] == 0.0 and inv["sgst"] == 0.0
        assert inv["total"] == 11800.0


# =====================================================================
# 2) Invoice doc_type
# =====================================================================
class TestInvoiceDocType:
    DOC_TYPES = ["sale_invoice", "estimate", "proforma", "delivery_challan", "sale_return", "credit_note"]

    def test_default_doc_type_is_sale_invoice(self, tokens, any_project_id):
        payload = {
            "project_id": any_project_id,
            "client_name": "TEST_DefaultDocType",
            "client_state": "Maharashtra",
            "items": [{"description": "x", "qty": 1, "unit_price": 100, "tax_pct": 18}],
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["doc_type"] == "sale_invoice"

    @pytest.mark.parametrize("doc_type", DOC_TYPES)
    def test_doc_type_persists_on_create(self, tokens, any_project_id, doc_type):
        payload = {
            "project_id": any_project_id,
            "doc_type": doc_type,
            "client_name": f"TEST_DT_{doc_type}",
            "client_state": "Maharashtra",
            "items": [{"description": "x", "qty": 1, "unit_price": 500, "tax_pct": 18}],
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["doc_type"] == doc_type
        # Verify persistence via GET list
        all_inv = requests.get(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"])).json()
        fetched = next((x for x in all_inv if x["id"] == inv["id"]), None)
        assert fetched is not None and fetched["doc_type"] == doc_type

    def test_doc_type_persists_on_update(self, tokens, any_project_id):
        payload = {
            "project_id": any_project_id,
            "doc_type": "estimate",
            "client_name": "TEST_DT_Update",
            "client_state": "Maharashtra",
            "items": [{"description": "x", "qty": 1, "unit_price": 200, "tax_pct": 18}],
        }
        r = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        inv_id = r.json()["id"]
        # Update doc_type → proforma
        payload["doc_type"] = "proforma"
        r2 = requests.put(f"{BASE_URL}/api/invoices/{inv_id}", headers=H(tokens["accounts"]), json=payload)
        assert r2.status_code == 200, r2.text
        assert r2.json()["doc_type"] == "proforma"


# =====================================================================
# 3) Parties CRUD + aggregations
# =====================================================================
class TestParties:
    def test_create_party_and_list(self, tokens):
        payload = {
            "name": "TEST_Party_Customer_1",
            "kind": "customer",
            "phone": "9999900001",
            "gstin": "27AAAAA0000A1Z5",
            "state": "Maharashtra",
            "opening_balance": 500.0,
        }
        r = requests.post(f"{BASE_URL}/api/parties", headers=H(tokens["sales"]), json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == payload["name"]
        assert created["kind"] == "customer"
        assert created["opening_balance"] == 500.0
        assert "id" in created
        # GET enriched list
        r2 = requests.get(f"{BASE_URL}/api/parties", headers=H(tokens["sales"]))
        assert r2.status_code == 200, r2.text
        found = next((p for p in r2.json() if p["id"] == created["id"]), None)
        assert found is not None
        for k in ("invoiced", "received", "receivable", "billed", "paid", "payable", "net_balance"):
            assert k in found, f"missing {k} in party"
        return created["id"]

    def test_party_aggregates_invoice(self, tokens, any_project_id):
        # Create a party
        pname = "TEST_Party_Agg_Cust"
        r = requests.post(f"{BASE_URL}/api/parties", headers=H(tokens["sales"]),
                          json={"name": pname, "kind": "customer", "opening_balance": 1000.0})
        assert r.status_code == 200, r.text
        party_id = r.json()["id"]

        # Create invoice tagged to this party
        payload = {
            "project_id": any_project_id,
            "party_id": party_id,
            "client_name": pname,
            "client_state": "Maharashtra",
            "items": [{"description": "x", "qty": 1, "unit_price": 1000, "discount_pct": 0, "tax_pct": 18}],
            "advance_received": 0,
        }
        r2 = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r2.status_code == 200, r2.text
        inv_total = r2.json()["total"]  # 1180

        # Fetch parties list and locate
        parties = requests.get(f"{BASE_URL}/api/parties", headers=H(tokens["sales"])).json()
        p = next(x for x in parties if x["id"] == party_id)
        assert p["invoiced"] >= inv_total, f"invoiced={p['invoiced']} expected>={inv_total}"
        assert p["receivable"] >= inv_total - 0
        # net_balance = opening + receivable - payable
        assert round(p["net_balance"], 2) == round(p["opening_balance"] + p["receivable"] - p["payable"], 2)

    def test_kind_filter(self, tokens):
        # create supplier
        r = requests.post(f"{BASE_URL}/api/parties", headers=H(tokens["sales"]),
                          json={"name": "TEST_Party_Supplier_1", "kind": "supplier"})
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{BASE_URL}/api/parties?kind=supplier", headers=H(tokens["sales"]))
        assert r2.status_code == 200
        kinds = {p["kind"] for p in r2.json()}
        # supplier filter should only return suppliers (or "both")
        assert kinds.issubset({"supplier", "both"}), f"unexpected kinds: {kinds}"

    def test_update_party(self, tokens):
        r = requests.post(f"{BASE_URL}/api/parties", headers=H(tokens["sales"]),
                          json={"name": "TEST_Party_Upd", "kind": "customer"})
        pid = r.json()["id"]
        upd = {"name": "TEST_Party_Upd_Renamed", "kind": "both", "phone": "8888888888"}
        r2 = requests.put(f"{BASE_URL}/api/parties/{pid}", headers=H(tokens["sales"]), json=upd)
        assert r2.status_code == 200, r2.text
        assert r2.json()["name"] == "TEST_Party_Upd_Renamed"
        assert r2.json()["kind"] == "both"
        assert r2.json()["phone"] == "8888888888"

    def test_delete_party_admin_only(self, tokens):
        r = requests.post(f"{BASE_URL}/api/parties", headers=H(tokens["sales"]),
                          json={"name": "TEST_Party_Del", "kind": "customer"})
        pid = r.json()["id"]
        # Non-admin should be forbidden
        r_no = requests.delete(f"{BASE_URL}/api/parties/{pid}", headers=H(tokens["accounts"]))
        assert r_no.status_code in (401, 403), f"expected forbidden, got {r_no.status_code}"
        # Admin OK
        r_ok = requests.delete(f"{BASE_URL}/api/parties/{pid}", headers=H(tokens["admin"]))
        assert r_ok.status_code == 200, r_ok.text


# =====================================================================
# 4) Party ledger
# =====================================================================
class TestPartyLedger:
    def test_ledger_entries_and_running_balance(self, tokens, any_project_id):
        # Create party with opening balance
        r = requests.post(f"{BASE_URL}/api/parties", headers=H(tokens["sales"]),
                          json={"name": "TEST_Ledger_Cust", "kind": "customer", "opening_balance": 200.0})
        assert r.status_code == 200, r.text
        pid = r.json()["id"]

        # Create invoice tied to this party (debit)
        payload = {
            "project_id": any_project_id,
            "party_id": pid,
            "client_name": "TEST_Ledger_Cust",
            "client_state": "Maharashtra",
            "items": [{"description": "Service", "qty": 1, "unit_price": 1000, "tax_pct": 18}],
            "advance_received": 0,
        }
        r2 = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=payload)
        assert r2.status_code == 200, r2.text
        inv = r2.json()
        inv_id = inv["id"]
        # Add a partial payment (credit)
        rp = requests.post(f"{BASE_URL}/api/invoices/{inv_id}/payments",
                           headers=H(tokens["accounts"]),
                           json={"amount": 300, "mode": "bank", "note": "test partial"})
        assert rp.status_code == 200, rp.text

        # Fetch ledger
        r3 = requests.get(f"{BASE_URL}/api/parties/{pid}/ledger", headers=H(tokens["accounts"]))
        assert r3.status_code == 200, r3.text
        led = r3.json()

        assert led["party"]["id"] == pid
        assert led["opening_balance"] == 200.0
        # Find invoice entry
        inv_entries = [e for e in led["entries"] if e.get("kind") == "invoice" and e.get("ref") == inv["invoice_no"]]
        assert inv_entries, f"invoice entry missing in ledger: {led['entries']}"
        assert inv_entries[0]["debit"] == inv["total"]
        assert inv_entries[0]["credit"] == 0

        # Find receipt entry
        receipt_entries = [e for e in led["entries"] if e.get("kind") == "receipt" and e.get("ref") == inv["invoice_no"]]
        assert receipt_entries, "receipt entry missing"
        assert receipt_entries[0]["credit"] == 300
        assert receipt_entries[0]["debit"] == 0

        # totals
        assert led["total_debit"] >= inv["total"]
        assert led["total_credit"] >= 300
        # closing = opening + total_debit - total_credit
        expected_close = round(led["opening_balance"] + led["total_debit"] - led["total_credit"], 2)
        assert led["closing_balance"] == expected_close, f"{led['closing_balance']} vs {expected_close}"

        # running balance should be sorted by date ascending; final equals closing
        if led["entries"]:
            assert led["entries"][-1]["running_balance"] == led["closing_balance"]


# =====================================================================
# 5) Expenses
# =====================================================================
class TestExpenses:
    def test_expense_categories(self, tokens):
        r = requests.get(f"{BASE_URL}/api/expense-categories", headers=H(tokens["accounts"]))
        assert r.status_code == 200, r.text
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) == 13, f"expected 13 categories, got {len(cats)}"
        for must_have in ["Rent", "Salaries", "Utilities", "Travel", "Miscellaneous"]:
            assert must_have in cats

    def test_create_expense_auto_no_and_gst(self, tokens):
        payload = {
            "category": "Rent",
            "payee": "TEST_Landlord",
            "amount": 1000.0,
            "gst_pct": 18.0,
            "mode": "bank",
            "note": "TEST expense",
        }
        r = requests.post(f"{BASE_URL}/api/expenses", headers=H(tokens["accounts"]), json=payload)
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["expense_no"].startswith("EXP-7"), f"expense_no={e['expense_no']}"
        assert e["gst_amount"] == 180.0
        assert e["total"] == 1180.0
        # verify persistence
        r2 = requests.get(f"{BASE_URL}/api/expenses", headers=H(tokens["accounts"]))
        assert r2.status_code == 200
        ids = [x["id"] for x in r2.json()]
        assert e["id"] in ids

    def test_expense_create_forbidden_for_non_accounts(self, tokens):
        payload = {"category": "Rent", "amount": 100.0}
        r = requests.post(f"{BASE_URL}/api/expenses", headers=H(tokens["sales"]), json=payload)
        assert r.status_code in (401, 403)

    def test_expense_delete_admin_or_accounts(self, tokens):
        r = requests.post(f"{BASE_URL}/api/expenses", headers=H(tokens["accounts"]),
                          json={"category": "Travel", "payee": "TEST_x", "amount": 50.0})
        eid = r.json()["id"]
        # sales cannot delete
        r_no = requests.delete(f"{BASE_URL}/api/expenses/{eid}", headers=H(tokens["sales"]))
        assert r_no.status_code in (401, 403)
        r_ok = requests.delete(f"{BASE_URL}/api/expenses/{eid}", headers=H(tokens["accounts"]))
        assert r_ok.status_code == 200, r_ok.text


# =====================================================================
# 6) Cash Accounts
# =====================================================================
class TestCashAccounts:
    def test_auto_seed_and_balance_fields(self, tokens):
        r = requests.get(f"{BASE_URL}/api/cash-accounts", headers=H(tokens["accounts"]))
        assert r.status_code == 200, r.text
        accts = r.json()
        # at least 3 default rows present (seed inserts if empty)
        names = {a["name"] for a in accts}
        kinds = {a["kind"] for a in accts}
        # If empty earlier, defaults must now exist. If pre-existing, at least the kinds should cover cash/bank/upi.
        assert {"cash", "bank", "upi"}.issubset(kinds), f"missing default kinds: {kinds}"
        # required fields
        for a in accts:
            for k in ("inflow", "outflow", "balance", "opening_balance"):
                assert k in a, f"missing {k} in cash account {a.get('name')}"
            expected_bal = round(a.get("opening_balance", 0) + a["inflow"] - a["outflow"], 2)
            assert a["balance"] == expected_bal

    def test_create_cash_account(self, tokens):
        r = requests.post(f"{BASE_URL}/api/cash-accounts", headers=H(tokens["accounts"]),
                          json={"name": "TEST_Petty Cash", "kind": "cash", "opening_balance": 500.0})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "TEST_Petty Cash"
        assert body["opening_balance"] == 500.0
        # admin delete
        rd = requests.delete(f"{BASE_URL}/api/cash-accounts/{body['id']}", headers=H(tokens["admin"]))
        assert rd.status_code == 200

    def test_cash_accounts_forbidden_for_sales(self, tokens):
        r = requests.get(f"{BASE_URL}/api/cash-accounts", headers=H(tokens["sales"]))
        assert r.status_code in (401, 403)


# =====================================================================
# 7) Daybook
# =====================================================================
class TestDaybook:
    def test_daybook_default_today(self, tokens, any_project_id):
        # Create a sale invoice + expense to populate today's entries
        today_iso_date = datetime.now(timezone.utc).date().isoformat()

        inv_payload = {
            "project_id": any_project_id,
            "client_name": "TEST_Daybook_Client",
            "client_state": "Maharashtra",
            "items": [{"description": "X", "qty": 1, "unit_price": 1000, "tax_pct": 18}],
        }
        r_inv = requests.post(f"{BASE_URL}/api/invoices", headers=H(tokens["accounts"]), json=inv_payload)
        assert r_inv.status_code == 200, r_inv.text
        inv = r_inv.json()

        r_exp = requests.post(f"{BASE_URL}/api/expenses", headers=H(tokens["accounts"]),
                              json={"category": "Utilities", "payee": "TEST_Util", "amount": 200.0,
                                    "gst_pct": 0, "mode": "cash"})
        assert r_exp.status_code == 200, r_exp.text
        exp = r_exp.json()

        r = requests.get(f"{BASE_URL}/api/daybook", headers=H(tokens["accounts"]))
        assert r.status_code == 200, r.text
        db = r.json()
        assert db["date"] == today_iso_date, f"date {db['date']} vs {today_iso_date}"
        for k in ("entries", "total_in", "total_out", "net"):
            assert k in db

        # invoice + expense should appear today (only if invoice's invoice_date is today)
        inv_refs = [e for e in db["entries"] if e.get("ref") == inv["invoice_no"] and e.get("kind") == "sale"]
        exp_refs = [e for e in db["entries"] if e.get("ref") == exp["expense_no"] and e.get("kind") == "expense"]
        assert inv_refs, "sale invoice entry missing from today's daybook"
        assert exp_refs, "expense entry missing from today's daybook"
        assert inv_refs[0]["in"] == inv["total"]
        assert exp_refs[0]["out"] == exp["total"]
        # net = in - out
        assert db["net"] == round(db["total_in"] - db["total_out"], 2)

    def test_daybook_date_filter(self, tokens):
        # Old date — should return empty entries
        r = requests.get(f"{BASE_URL}/api/daybook?date=2000-01-01", headers=H(tokens["accounts"]))
        assert r.status_code == 200, r.text
        db = r.json()
        assert db["date"] == "2000-01-01"
        assert db["entries"] == []
        assert db["total_in"] == 0
        assert db["total_out"] == 0
        assert db["net"] == 0
