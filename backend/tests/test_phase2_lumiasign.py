"""
LUMIASIGN ERP Phase 2 Backend Tests
Covers: constants, suppliers (CRUD + ledger), materials (new fields, search/filter),
stock in/out (cost rollup, negative stock), purchases (GST, payment_terms, approve, receive),
vendor payments (apply + reverse), project approve / complete-production,
production with 8 stages + business rules, installations with photos + signoff,
dashboard new fields, profit_analysis margin_alert, reports new fields.
"""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="

CREDS = {
    "admin":        ("admin@lumiasign.com", "admin123"),
    "sales":        ("sales@lumiasign.com", "lumia123"),
    "production":   ("production@lumiasign.com", "lumia123"),
    "store":        ("store@lumiasign.com", "lumia123"),
    "accounts":     ("accounts@lumiasign.com", "lumia123"),
    "installation": ("installation@lumiasign.com", "lumia123"),
}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def tokens():
    return {role: _login(*creds) for role, creds in CREDS.items()}


def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth smoke ----------
def test_login_all_six_roles(tokens):
    assert set(tokens.keys()) == set(CREDS.keys())
    for role, tok in tokens.items():
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(tok))
        assert r.status_code == 200, role
        assert r.json()["role"] == role


# ---------- Constants ----------
def test_constants_lists(tokens):
    r = requests.get(f"{BASE_URL}/api/constants", headers=H(tokens["admin"]))
    assert r.status_code == 200
    d = r.json()
    assert len(d["material_categories"]) == 10
    assert "ACP" in d["material_categories"] and "Paint" in d["material_categories"]
    assert len(d["production_stages"]) == 8
    assert d["production_stages"][0] == "Cutting"
    assert d["production_stages"][-1] == "Dispatch"
    assert set(d["stage_statuses"]) == {"pending", "in_progress", "completed"}
    assert d["margin_threshold"] == 15.0


# ---------- Suppliers ----------
def test_suppliers_crud_and_ledger(tokens):
    tok_store = tokens["store"]
    tok_acc = tokens["accounts"]
    # Create
    r = requests.post(f"{BASE_URL}/api/suppliers", headers=H(tok_store),
                     json={"name": "TEST_Vendor_A", "mobile": "1111", "gst_number": "G1", "address": "Addr"})
    assert r.status_code == 200, r.text
    sup = r.json(); sup_id = sup["id"]
    assert sup["name"] == "TEST_Vendor_A"

    # List with rollups
    r = requests.get(f"{BASE_URL}/api/suppliers", headers=H(tok_acc))
    assert r.status_code == 200
    names = [s["name"] for s in r.json()]
    assert "TEST_Vendor_A" in names
    one = next(s for s in r.json() if s["id"] == sup_id)
    for k in ("total_purchases", "po_count", "outstanding", "paid_total"):
        assert k in one

    # Update
    r = requests.put(f"{BASE_URL}/api/suppliers/{sup_id}", headers=H(tok_store),
                    json={"name": "TEST_Vendor_A2", "mobile": "2222"})
    assert r.status_code == 200 and r.json()["name"] == "TEST_Vendor_A2"

    # Ledger
    r = requests.get(f"{BASE_URL}/api/suppliers/{sup_id}/ledger", headers=H(tok_acc))
    assert r.status_code == 200
    led = r.json()
    for k in ("supplier", "purchases", "payments", "total_billed", "total_paid", "outstanding"):
        assert k in led

    # Delete
    r = requests.delete(f"{BASE_URL}/api/suppliers/{sup_id}", headers=H(tok_store))
    assert r.status_code == 200


# ---------- Materials ----------
def test_materials_new_fields_and_filter(tokens):
    tok_store = tokens["store"]
    # Create supplier for denorm test
    s = requests.post(f"{BASE_URL}/api/suppliers", headers=H(tok_store),
                     json={"name": "TEST_MatSup"}).json()
    sup_id = s["id"]

    payload = {"code": "TEST-M1", "name": "TEST Material One", "category": "LED Modules",
               "unit": "pcs", "stock_qty": 10, "min_stock": 5,
               "purchase_rate": 100.0, "selling_rate": 150.0, "supplier_id": sup_id}
    r = requests.post(f"{BASE_URL}/api/materials", headers=H(tok_store), json=payload)
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["supplier_name"] == "TEST_MatSup"   # denormalized
    assert m["min_stock"] == 5 and m["purchase_rate"] == 100 and m["selling_rate"] == 150
    mid = m["id"]

    # GET filters
    r = requests.get(f"{BASE_URL}/api/materials?category=LED Modules", headers=H(tok_store))
    assert r.status_code == 200
    assert any(x["id"] == mid for x in r.json())

    r = requests.get(f"{BASE_URL}/api/materials?q=TEST Material One", headers=H(tok_store))
    assert any(x["id"] == mid for x in r.json())

    # cleanup
    requests.delete(f"{BASE_URL}/api/materials/{mid}", headers=H(tok_store))
    requests.delete(f"{BASE_URL}/api/suppliers/{sup_id}", headers=H(tok_store))


# ---------- Stock in / out ----------
def test_stock_in_updates_purchase_rate_and_qty(tokens):
    tok_store = tokens["store"]
    # New material
    r = requests.post(f"{BASE_URL}/api/materials", headers=H(tok_store),
                     json={"code": "TEST-S1", "name": "TEST Stock M", "category": "Hardware",
                           "unit": "pcs", "stock_qty": 0, "min_stock": 1,
                           "purchase_rate": 10, "selling_rate": 20})
    mid = r.json()["id"]

    r = requests.post(f"{BASE_URL}/api/stock/in", headers=H(tok_store),
                     json={"material_id": mid, "qty": 5, "rate": 25.5})
    assert r.status_code == 200, r.text
    sm = r.json()
    assert sm["type"] == "in" and sm["amount"] == round(5 * 25.5, 2)

    # Verify material updated
    mat = next(x for x in requests.get(f"{BASE_URL}/api/materials", headers=H(tok_store)).json() if x["id"] == mid)
    assert mat["stock_qty"] == 5 and mat["purchase_rate"] == 25.5
    requests.delete(f"{BASE_URL}/api/materials/{mid}", headers=H(tok_store))


def test_stock_out_rejects_negative_and_rolls_up_cost(tokens):
    tok_store = tokens["store"]
    tok_sales = tokens["sales"]
    # Material with low stock
    mid = requests.post(f"{BASE_URL}/api/materials", headers=H(tok_store),
        json={"code": "TEST-SO", "name": "TEST SO Mat", "category": "Hardware",
              "unit": "pcs", "stock_qty": 5, "min_stock": 1,
              "purchase_rate": 20.0, "selling_rate": 30.0}).json()["id"]
    # Project (sales)
    p = requests.post(f"{BASE_URL}/api/projects", headers=H(tok_sales),
        json={"name": "TEST_SO_Project", "client_name": "TC", "contract_value": 100000}).json()
    pid = p["id"]

    # Try over-issue
    r = requests.post(f"{BASE_URL}/api/stock/out", headers=H(tok_store),
                     json={"material_id": mid, "project_id": pid, "qty": 999})
    assert r.status_code == 400
    assert "Insufficient" in r.json()["detail"]

    # Valid stock out -> material_cost rollup
    r = requests.post(f"{BASE_URL}/api/stock/out", headers=H(tok_store),
                     json={"material_id": mid, "project_id": pid, "qty": 2})
    assert r.status_code == 200, r.text
    expected_amount = round(2 * 20.0, 2)
    cost = requests.get(f"{BASE_URL}/api/costs/{pid}", headers=H(tok_sales)).json()
    assert cost["material_cost"] >= expected_amount
    assert cost["total_cost"] >= expected_amount

    # cleanup
    requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=H(tok_sales))
    requests.delete(f"{BASE_URL}/api/materials/{mid}", headers=H(tok_store))


# ---------- Purchases / GST / payment terms ----------
def test_purchase_cash_paid_and_gst_math(tokens):
    tok_store = tokens["store"]
    r = requests.post(f"{BASE_URL}/api/purchases", headers=H(tok_store),
                     json={"supplier_name": "TEST_Sup_X", "material_name": "Misc",
                           "qty": 10, "rate": 100, "gst_pct": 18, "payment_terms": "cash"})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["subtotal"] == 1000.0
    assert p["gst_amount"] == 180.0
    assert p["total"] == 1180.0
    assert p["paid_amount"] == 1180.0
    assert p["payment_status"] == "paid"
    requests.delete(f"{BASE_URL}/api/purchases/{p['id']}", headers=H(tok_store))


def test_purchase_credit_pending(tokens):
    tok_store = tokens["store"]
    r = requests.post(f"{BASE_URL}/api/purchases", headers=H(tok_store),
                     json={"supplier_name": "TEST_Sup_Y", "qty": 4, "rate": 50,
                           "gst_pct": 12, "payment_terms": "credit"})
    p = r.json()
    assert p["paid_amount"] == 0.0
    assert p["payment_status"] == "pending"
    assert p["gst_amount"] == round(4 * 50 * 12 / 100, 2)
    requests.delete(f"{BASE_URL}/api/purchases/{p['id']}", headers=H(tok_store))


def test_purchase_approve_and_receive_flow(tokens):
    tok_store, tok_acc = tokens["store"], tokens["accounts"]
    # supplier + material
    sup = requests.post(f"{BASE_URL}/api/suppliers", headers=H(tok_store),
                       json={"name": "TEST_RecvSup"}).json()
    mat = requests.post(f"{BASE_URL}/api/materials", headers=H(tok_store),
        json={"code": "TEST-R1", "name": "TEST RecvMat", "category": "Hardware",
              "unit": "pcs", "stock_qty": 10, "min_stock": 1,
              "purchase_rate": 50, "selling_rate": 70}).json()

    po = requests.post(f"{BASE_URL}/api/purchases", headers=H(tok_store),
                      json={"supplier_id": sup["id"], "supplier_name": sup["name"],
                            "material_id": mat["id"], "qty": 5, "rate": 60,
                            "gst_pct": 18, "payment_terms": "credit"}).json()
    assert po["status"] == "pending"

    # approve (accounts)
    r = requests.post(f"{BASE_URL}/api/purchases/{po['id']}/approve", headers=H(tok_acc))
    assert r.status_code == 200 and r.json()["status"] == "approved"

    # Non-accounts cannot approve
    bad = requests.post(f"{BASE_URL}/api/purchases/{po['id']}/approve", headers=H(tokens["sales"]))
    assert bad.status_code == 403

    # receive (store)
    r = requests.post(f"{BASE_URL}/api/purchases/{po['id']}/receive", headers=H(tok_store))
    assert r.status_code == 200 and r.json()["status"] == "received"

    # Material updated
    m_after = next(x for x in requests.get(f"{BASE_URL}/api/materials", headers=H(tok_store)).json() if x["id"] == mat["id"])
    assert m_after["stock_qty"] == 15  # 10 + 5
    assert m_after["purchase_rate"] == 60

    # stock movement created
    moves = requests.get(f"{BASE_URL}/api/stock-movements?type=in", headers=H(tok_store)).json()
    assert any(s.get("note", "").startswith("PO ") and s["material_id"] == mat["id"] for s in moves)

    # cleanup
    requests.delete(f"{BASE_URL}/api/purchases/{po['id']}", headers=H(tok_store))
    requests.delete(f"{BASE_URL}/api/materials/{mat['id']}", headers=H(tok_store))
    requests.delete(f"{BASE_URL}/api/suppliers/{sup['id']}", headers=H(tok_store))


# ---------- Vendor payments ----------
def test_vendor_payment_apply_and_reverse(tokens):
    tok_store, tok_acc = tokens["store"], tokens["accounts"]
    sup = requests.post(f"{BASE_URL}/api/suppliers", headers=H(tok_store),
                       json={"name": "TEST_VPSup"}).json()
    po = requests.post(f"{BASE_URL}/api/purchases", headers=H(tok_store),
        json={"supplier_id": sup["id"], "supplier_name": sup["name"],
              "qty": 2, "rate": 500, "gst_pct": 18, "payment_terms": "credit"}).json()
    total = po["total"]

    # partial
    r = requests.post(f"{BASE_URL}/api/vendor-payments", headers=H(tok_acc),
                     json={"supplier_id": sup["id"], "purchase_id": po["id"],
                           "amount": total / 2, "method": "bank"})
    assert r.status_code == 200, r.text
    pay = r.json()
    po_after = next(x for x in requests.get(f"{BASE_URL}/api/purchases", headers=H(tok_store)).json() if x["id"] == po["id"])
    assert po_after["payment_status"] == "partial"
    assert abs(po_after["paid_amount"] - total / 2) < 0.05

    # Delete payment -> reverses
    r = requests.delete(f"{BASE_URL}/api/vendor-payments/{pay['id']}", headers=H(tok_acc))
    assert r.status_code == 200
    po_after2 = next(x for x in requests.get(f"{BASE_URL}/api/purchases", headers=H(tok_store)).json() if x["id"] == po["id"])
    assert po_after2["payment_status"] == "pending"
    assert po_after2["paid_amount"] == 0.0

    # cleanup
    requests.delete(f"{BASE_URL}/api/purchases/{po['id']}", headers=H(tok_store))
    requests.delete(f"{BASE_URL}/api/suppliers/{sup['id']}", headers=H(tok_store))


# ---------- Projects approve / complete-production ----------
def test_project_approve_and_complete_production(tokens):
    tok_sales, tok_prod = tokens["sales"], tokens["production"]
    p = requests.post(f"{BASE_URL}/api/projects", headers=H(tok_sales),
        json={"name": "TEST_APP_PRJ", "client_name": "C", "contract_value": 100}).json()
    pid = p["id"]
    assert p["approved"] is False and p["production_completed"] is False

    r = requests.post(f"{BASE_URL}/api/projects/{pid}/approve", headers=H(tok_sales))
    assert r.status_code == 200 and r.json()["approved"] is True

    r = requests.post(f"{BASE_URL}/api/projects/{pid}/complete-production", headers=H(tok_prod))
    assert r.status_code == 200
    pj = r.json()
    assert pj["production_completed"] is True
    assert pj["status"] == "installation"

    requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=H(tok_sales))


# ---------- Production: business rule + 8 stages + progress ----------
def test_production_requires_approved_project(tokens):
    tok_sales, tok_prod = tokens["sales"], tokens["production"]
    p = requests.post(f"{BASE_URL}/api/projects", headers=H(tok_sales),
        json={"name": "TEST_PROD_PRJ_UNAPPR", "client_name": "C", "contract_value": 100}).json()
    pid = p["id"]
    r = requests.post(f"{BASE_URL}/api/production", headers=H(tok_prod), json={"project_id": pid})
    assert r.status_code == 400
    assert "approved" in r.json()["detail"].lower()
    requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=H(tok_sales))


def test_production_full_lifecycle(tokens):
    tok_sales, tok_prod = tokens["sales"], tokens["production"]
    p = requests.post(f"{BASE_URL}/api/projects", headers=H(tok_sales),
        json={"name": "TEST_PROD_LIFE", "client_name": "C", "contract_value": 5000}).json()
    pid = p["id"]
    requests.post(f"{BASE_URL}/api/projects/{pid}/approve", headers=H(tok_sales))

    r = requests.post(f"{BASE_URL}/api/production", headers=H(tok_prod), json={"project_id": pid})
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["job_no"].startswith("JOB-")
    assert len(job["stages"]) == 8
    assert all(s["status"] == "pending" for s in job["stages"])
    job_id = job["id"]

    # invalid index
    bad = requests.put(f"{BASE_URL}/api/production/{job_id}/stage/99",
                      headers=H(tok_prod), json={"status": "in_progress"})
    assert bad.status_code == 400

    # invalid status
    bad = requests.put(f"{BASE_URL}/api/production/{job_id}/stage/0",
                      headers=H(tok_prod), json={"status": "weird"})
    assert bad.status_code == 400

    # in_progress -> sets started_at
    r = requests.put(f"{BASE_URL}/api/production/{job_id}/stage/0",
                    headers=H(tok_prod), json={"status": "in_progress"})
    assert r.json()["stages"][0]["started_at"] is not None

    # complete all 8
    for i in range(8):
        r = requests.put(f"{BASE_URL}/api/production/{job_id}/stage/{i}",
                        headers=H(tok_prod), json={"status": "completed"})
        assert r.status_code == 200
    final = r.json()
    assert final["progress"] == 100

    # Project flipped
    prj = requests.get(f"{BASE_URL}/api/projects/{pid}", headers=H(tok_prod)).json()
    assert prj["production_completed"] is True
    assert prj["status"] == "installation"

    requests.delete(f"{BASE_URL}/api/production/{job_id}", headers=H(tok_prod))
    requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=H(tok_sales))


# ---------- Installations ----------
def test_installation_requires_production_complete(tokens):
    tok_sales, tok_inst = tokens["sales"], tokens["installation"]
    p = requests.post(f"{BASE_URL}/api/projects", headers=H(tok_sales),
        json={"name": "TEST_INST_BLOCK", "client_name": "C", "contract_value": 100}).json()
    pid = p["id"]
    r = requests.post(f"{BASE_URL}/api/installations", headers=H(tok_inst),
                     json={"project_id": pid, "site_location": "Anywhere"})
    assert r.status_code == 400
    assert "production" in r.json()["detail"].lower()
    requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=H(tok_sales))


def test_installation_photos_signoff(tokens):
    tok_sales, tok_prod, tok_inst = tokens["sales"], tokens["production"], tokens["installation"]
    p = requests.post(f"{BASE_URL}/api/projects", headers=H(tok_sales),
        json={"name": "TEST_INS_FULL", "client_name": "C", "contract_value": 100}).json()
    pid = p["id"]
    requests.post(f"{BASE_URL}/api/projects/{pid}/approve", headers=H(tok_sales))
    requests.post(f"{BASE_URL}/api/projects/{pid}/complete-production", headers=H(tok_prod))

    r = requests.post(f"{BASE_URL}/api/installations", headers=H(tok_inst),
                     json={"project_id": pid, "site_location": "Mumbai"})
    assert r.status_code == 200, r.text
    inst = r.json()
    assert inst["install_no"].startswith("INS-")
    iid = inst["id"]

    # Invalid bucket
    bad = requests.post(f"{BASE_URL}/api/installations/{iid}/photo", headers=H(tok_inst),
                       json={"bucket": "side", "data_url": TINY_PNG})
    assert bad.status_code == 400

    # Add photos to all buckets
    for b in ("before", "during", "after"):
        r = requests.post(f"{BASE_URL}/api/installations/{iid}/photo", headers=H(tok_inst),
                         json={"bucket": b, "data_url": TINY_PNG})
        assert r.status_code == 200 and r.json()["count"] == 1

    after = requests.get(f"{BASE_URL}/api/installations/{iid}", headers=H(tok_inst)).json()
    assert len(after["before_photos"]) == 1
    assert len(after["during_photos"]) == 1
    assert len(after["after_photos"]) == 1

    # Delete a photo
    r = requests.delete(f"{BASE_URL}/api/installations/{iid}/photo?bucket=before&index=0",
                       headers=H(tok_inst))
    assert r.status_code == 200
    after2 = requests.get(f"{BASE_URL}/api/installations/{iid}", headers=H(tok_inst)).json()
    assert len(after2["before_photos"]) == 0

    # Signoff
    r = requests.post(f"{BASE_URL}/api/installations/{iid}/signoff", headers=H(tok_inst),
                     json={"client_name": "Mr. Test", "signature": TINY_PNG})
    assert r.status_code == 200
    fin = r.json()
    assert fin["status"] == "completed"
    assert fin["client_name_signoff"] == "Mr. Test"
    assert fin["client_signature"] == TINY_PNG
    assert fin["signed_at"]

    prj_after = requests.get(f"{BASE_URL}/api/projects/{pid}", headers=H(tok_inst)).json()
    assert prj_after["status"] == "completed"

    requests.delete(f"{BASE_URL}/api/installations/{iid}", headers=H(tok_inst))
    requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=H(tok_sales))


# ---------- Dashboard + Reports + Profit ----------
def test_dashboard_new_fields(tokens):
    r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=H(tokens["admin"]))
    assert r.status_code == 200
    d = r.json()
    for k in ("inventory_value", "production_in_progress", "installations_pending",
              "installations_completed", "outstanding_payable", "margin_alerts", "margin_threshold"):
        assert k in d, f"missing {k}"
    assert d["margin_threshold"] == 15.0
    assert isinstance(d["margin_alerts"], list)


def test_profit_analysis_margin_alert(tokens):
    r = requests.get(f"{BASE_URL}/api/profit-analysis", headers=H(tokens["accounts"]))
    assert r.status_code == 200
    rows = r.json()
    assert rows, "no projects in profit analysis"
    for row in rows:
        assert "margin_alert" in row
        # Verify logic
        expected = row["margin_pct"] < 15 and row["revenue"] > 0
        assert row["margin_alert"] == expected


def test_reports_summary_new_fields(tokens):
    r = requests.get(f"{BASE_URL}/api/reports/summary", headers=H(tokens["accounts"]))
    assert r.status_code == 200
    s = r.json()
    for k in ("outstanding_payable", "purchase_count", "purchase_total"):
        assert k in s
