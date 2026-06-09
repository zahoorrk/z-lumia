"""
LUMIASIGN ERP - Backend integration tests.
Covers auth, dashboard, leads, quotations, projects, production,
materials, stock-movements, purchases, installations, costs,
profit-analysis, reports and RBAC.
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CREDENTIALS = {
    "admin": ("admin@lumiasign.com", "admin123"),
    "sales": ("sales@lumiasign.com", "lumia123"),
    "production": ("production@lumiasign.com", "lumia123"),
    "store": ("store@lumiasign.com", "lumia123"),
    "accounts": ("accounts@lumiasign.com", "lumia123"),
    "installation": ("installation@lumiasign.com", "lumia123"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    return r


@pytest.fixture(scope="session")
def tokens():
    out = {}
    for role, (email, pwd) in CREDENTIALS.items():
        r = _login(email, pwd)
        assert r.status_code == 200, f"login failed for {role}: {r.status_code} {r.text}"
        out[role] = r.json()["token"]
    return out


def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- AUTH ----------------
class TestAuth:
    def test_login_admin(self):
        r = _login(*CREDENTIALS["admin"])
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "admin@lumiasign.com"

    @pytest.mark.parametrize("role", ["sales", "production", "store", "accounts", "installation"])
    def test_login_each_role(self, role):
        r = _login(*CREDENTIALS[role])
        assert r.status_code == 200
        assert r.json()["user"]["role"] == role

    def test_login_wrong_password(self):
        r = _login("admin@lumiasign.com", "wrongpw")
        assert r.status_code == 401

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=H(tokens["admin"]))
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == "admin@lumiasign.com"
        assert body["role"] == "admin"
        assert "password_hash" not in body
        assert "_id" not in body


# ---------------- DASHBOARD ----------------
class TestDashboard:
    def test_stats_admin(self, tokens):
        r = requests.get(f"{API}/dashboard/stats", headers=H(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        for k in ["revenue", "profit", "pending_projects", "completed_projects",
                  "low_stock_items", "revenue_trend", "status_breakdown"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["low_stock_items"], list)
        assert isinstance(d["revenue_trend"], list)
        assert isinstance(d["status_breakdown"], list)

    @pytest.mark.parametrize("role", ["sales", "production", "store", "accounts", "installation"])
    def test_stats_all_roles(self, tokens, role):
        r = requests.get(f"{API}/dashboard/stats", headers=H(tokens[role]))
        assert r.status_code == 200


# ---------------- LEADS ----------------
class TestLeads:
    def test_sales_can_list(self, tokens):
        r = requests.get(f"{API}/leads", headers=H(tokens["sales"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.parametrize("role", ["production", "store", "installation"])
    def test_non_sales_forbidden(self, tokens, role):
        r = requests.get(f"{API}/leads", headers=H(tokens[role]))
        assert r.status_code == 403

    def test_lead_crud(self, tokens):
        t = tokens["sales"]
        payload = {"name": f"TEST_Lead_{uuid.uuid4().hex[:6]}", "company": "TEST Co",
                   "email": "x@test.com", "estimated_value": 12345.0}
        r = requests.post(f"{API}/leads", json=payload, headers=H(t))
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["name"] == payload["name"]
        assert lead["estimated_value"] == 12345.0
        lid = lead["id"]
        # update
        upd = {**payload, "status": "qualified", "estimated_value": 99999.0}
        r2 = requests.put(f"{API}/leads/{lid}", json=upd, headers=H(t))
        assert r2.status_code == 200
        assert r2.json()["estimated_value"] == 99999.0
        assert r2.json()["status"] == "qualified"
        # delete
        r3 = requests.delete(f"{API}/leads/{lid}", headers=H(t))
        assert r3.status_code == 200


# ---------------- QUOTATIONS ----------------
class TestQuotations:
    def test_quote_create_totals(self, tokens):
        t = tokens["sales"]
        items = [{"description": "A", "qty": 2, "unit_price": 100.0},
                 {"description": "B", "qty": 1, "unit_price": 50.0}]
        r = requests.post(f"{API}/quotations",
                          json={"client_name": "TEST_QClient", "items": items, "tax_pct": 18.0},
                          headers=H(t))
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["subtotal"] == 250.0
        assert q["total"] == round(250.0 * 1.18, 2)
        assert q["quote_no"].startswith("QT-")
        qid = q["id"]
        # update
        upd = {"client_name": "TEST_QClient2", "items": items, "tax_pct": 10.0}
        r2 = requests.put(f"{API}/quotations/{qid}", json=upd, headers=H(t))
        assert r2.status_code == 200
        assert r2.json()["total"] == round(250.0 * 1.10, 2)
        # delete
        r3 = requests.delete(f"{API}/quotations/{qid}", headers=H(t))
        assert r3.status_code == 200


# ---------------- PROJECTS ----------------
class TestProjects:
    def test_project_crud_and_costs_init(self, tokens):
        t = tokens["sales"]
        payload = {"name": "TEST_Project_X", "client_name": "TEST_Client",
                   "contract_value": 50000.0}
        r = requests.post(f"{API}/projects", json=payload, headers=H(t))
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["project_no"].startswith("PRJ-")
        pid = p["id"]
        # cost auto-created
        rc = requests.get(f"{API}/costs/{pid}", headers=H(tokens["admin"]))
        assert rc.status_code == 200
        assert rc.json()["project_id"] == pid
        # search filter
        rs = requests.get(f"{API}/projects?q=TEST_Project_X", headers=H(t))
        assert rs.status_code == 200
        assert any(d["id"] == pid for d in rs.json())
        # status filter
        rsf = requests.get(f"{API}/projects?status=new", headers=H(t))
        assert rsf.status_code == 200
        assert all(d["status"] == "new" for d in rsf.json())
        # update
        ru = requests.put(f"{API}/projects/{pid}",
                          json={"contract_value": 60000.0}, headers=H(t))
        assert ru.status_code == 200
        assert ru.json()["contract_value"] == 60000.0
        # delete
        rd = requests.delete(f"{API}/projects/{pid}", headers=H(t))
        assert rd.status_code == 200

    def test_store_cannot_create_project(self, tokens):
        r = requests.post(f"{API}/projects",
                          json={"name": "TEST_x", "client_name": "x"},
                          headers=H(tokens["store"]))
        assert r.status_code == 403


# ---------------- PRODUCTION ----------------
class TestProduction:
    def test_production_lifecycle(self, tokens):
        # create a project as sales first
        rp = requests.post(f"{API}/projects",
                           json={"name": "TEST_Prod_Proj", "client_name": "TC",
                                 "contract_value": 1000.0},
                           headers=H(tokens["sales"]))
        assert rp.status_code == 200
        pid = rp.json()["id"]
        # create production job
        t = tokens["production"]
        r = requests.post(f"{API}/production",
                          json={"project_id": pid, "stage": "cutting"},
                          headers=H(t))
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["project_name"] == "TEST_Prod_Proj"
        # project status auto-moved
        rp2 = requests.get(f"{API}/projects/{pid}", headers=H(t))
        assert rp2.json()["status"] == "in_production"
        # update
        ru = requests.put(f"{API}/production/{job['id']}",
                          json={"stage": "qc", "progress": 80}, headers=H(t))
        assert ru.status_code == 200
        assert ru.json()["stage"] == "qc"
        assert ru.json()["progress"] == 80
        # delete
        rd = requests.delete(f"{API}/production/{job['id']}", headers=H(t))
        assert rd.status_code == 200
        # cleanup project
        requests.delete(f"{API}/projects/{pid}", headers=H(tokens["sales"]))


# ---------------- MATERIALS & STOCK ----------------
class TestMaterialsStock:
    def test_materials_list_all_roles(self, tokens):
        for role in ["admin", "sales", "production", "store", "accounts", "installation"]:
            r = requests.get(f"{API}/materials", headers=H(tokens[role]))
            assert r.status_code == 200, f"{role} cannot list materials"

    def test_sales_cannot_create_material(self, tokens):
        r = requests.post(f"{API}/materials",
                          json={"code": "TEST_X", "name": "X"},
                          headers=H(tokens["sales"]))
        assert r.status_code == 403

    def test_material_crud_and_stock(self, tokens):
        t = tokens["store"]
        code = f"TEST_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/materials",
                          json={"code": code, "name": "TEST_Material",
                                "unit": "pcs", "stock_qty": 10, "reorder_level": 5,
                                "unit_cost": 25.0},
                          headers=H(t))
        assert r.status_code == 200, r.text
        m = r.json()
        mid = m["id"]
        # stock IN
        rin = requests.post(f"{API}/stock-movements",
                            json={"material_id": mid, "type": "in", "qty": 5},
                            headers=H(t))
        assert rin.status_code == 200
        # verify stock updated to 15
        rg = requests.get(f"{API}/materials", headers=H(t))
        cur = next(x for x in rg.json() if x["id"] == mid)
        assert cur["stock_qty"] == 15
        # stock OUT
        rout = requests.post(f"{API}/stock-movements",
                             json={"material_id": mid, "type": "out", "qty": 4},
                             headers=H(t))
        assert rout.status_code == 200
        rg2 = requests.get(f"{API}/materials", headers=H(t))
        cur2 = next(x for x in rg2.json() if x["id"] == mid)
        assert cur2["stock_qty"] == 11
        # OUT insufficient
        rbad = requests.post(f"{API}/stock-movements",
                             json={"material_id": mid, "type": "out", "qty": 9999},
                             headers=H(t))
        assert rbad.status_code == 400
        # list
        rlm = requests.get(f"{API}/stock-movements", headers=H(t))
        assert rlm.status_code == 200
        # cleanup
        requests.delete(f"{API}/materials/{mid}", headers=H(t))


# ---------------- PURCHASES ----------------
class TestPurchases:
    def test_purchase_receive_flow(self, tokens):
        t = tokens["store"]
        # create material first
        code = f"TEST_PUR_{uuid.uuid4().hex[:6]}"
        rm = requests.post(f"{API}/materials",
                           json={"code": code, "name": "TEST_PUR_Mat", "stock_qty": 10},
                           headers=H(t))
        mid = rm.json()["id"]
        # create purchase
        rp = requests.post(f"{API}/purchases",
                           json={"vendor": "TEST_Vendor", "material_id": mid,
                                 "qty": 20, "unit_price": 50.0},
                           headers=H(t))
        assert rp.status_code == 200, rp.text
        po = rp.json()
        assert po["po_no"].startswith("PO-")
        assert po["total"] == 1000.0
        assert po["material_name"] == "TEST_PUR_Mat"
        # receive
        rr = requests.put(f"{API}/purchases/{po['id']}/receive", headers=H(t))
        assert rr.status_code == 200
        assert rr.json()["status"] == "received"
        # material stock increased by 20 (10+20=30)
        rgl = requests.get(f"{API}/materials", headers=H(t))
        cur = next(x for x in rgl.json() if x["id"] == mid)
        assert cur["stock_qty"] == 30
        # stock_movement created
        rsm = requests.get(f"{API}/stock-movements", headers=H(t))
        assert any(s["material_id"] == mid and s["type"] == "in" and s["qty"] == 20
                   for s in rsm.json())
        # cleanup
        requests.delete(f"{API}/purchases/{po['id']}", headers=H(t))
        requests.delete(f"{API}/materials/{mid}", headers=H(t))


# ---------------- INSTALLATION ----------------
class TestInstallation:
    def test_install_flow(self, tokens):
        # need a project
        rp = requests.post(f"{API}/projects",
                           json={"name": "TEST_Inst_Proj", "client_name": "IC",
                                 "contract_value": 500.0},
                           headers=H(tokens["sales"]))
        pid = rp.json()["id"]
        t = tokens["installation"]
        r = requests.post(f"{API}/installations",
                          json={"project_id": pid, "site_address": "TEST addr",
                                "status": "scheduled"},
                          headers=H(t))
        assert r.status_code == 200, r.text
        inst = r.json()
        # project moved to installation
        rpg = requests.get(f"{API}/projects/{pid}", headers=H(t))
        assert rpg.json()["status"] == "installation"
        # update to completed
        ru = requests.put(f"{API}/installations/{inst['id']}",
                          json={"project_id": pid, "site_address": "TEST addr",
                                "status": "completed"},
                          headers=H(t))
        assert ru.status_code == 200
        rpg2 = requests.get(f"{API}/projects/{pid}", headers=H(t))
        assert rpg2.json()["status"] == "completed"
        # cleanup
        requests.delete(f"{API}/installations/{inst['id']}", headers=H(t))
        requests.delete(f"{API}/projects/{pid}", headers=H(tokens["sales"]))


# ---------------- COSTS ----------------
class TestCosts:
    def test_cost_update_recompute(self, tokens):
        rp = requests.post(f"{API}/projects",
                           json={"name": "TEST_Cost_P", "client_name": "C",
                                 "contract_value": 1000.0},
                           headers=H(tokens["sales"]))
        pid = rp.json()["id"]
        t = tokens["accounts"]
        r = requests.get(f"{API}/costs/{pid}", headers=H(t))
        assert r.status_code == 200
        ru = requests.put(f"{API}/costs/{pid}",
                          json={"material_cost": 100, "labour_cost": 50,
                                "transport_cost": 20, "machine_cost": 10,
                                "overhead_cost": 5},
                          headers=H(t))
        assert ru.status_code == 200
        assert ru.json()["total_cost"] == 185
        requests.delete(f"{API}/projects/{pid}", headers=H(tokens["sales"]))


# ---------------- PROFIT / REPORTS ----------------
class TestProfitReports:
    def test_profit_analysis(self, tokens):
        r = requests.get(f"{API}/profit-analysis", headers=H(tokens["accounts"]))
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            for k in ["project_id", "revenue", "total_cost", "profit", "margin_pct"]:
                assert k in rows[0]

    def test_reports_summary(self, tokens):
        r = requests.get(f"{API}/reports/summary", headers=H(tokens["accounts"]))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_revenue", "total_cost", "total_profit", "margin_pct",
                  "inventory_value", "leads_count", "quotations_count",
                  "projects_count"]:
            assert k in d


# ---------------- RBAC ----------------
class TestRBAC:
    def test_sales_cannot_post_material(self, tokens):
        r = requests.post(f"{API}/materials",
                          json={"code": "TEST_RBAC", "name": "x"},
                          headers=H(tokens["sales"]))
        assert r.status_code == 403

    def test_store_cannot_post_project(self, tokens):
        r = requests.post(f"{API}/projects",
                          json={"name": "TEST_RBAC", "client_name": "x"},
                          headers=H(tokens["store"]))
        assert r.status_code == 403

    def test_admin_can_access_everything(self, tokens):
        t = tokens["admin"]
        endpoints = ["/leads", "/quotations", "/projects", "/production",
                     "/materials", "/stock-movements", "/purchases",
                     "/installations", "/profit-analysis", "/reports/summary",
                     "/users"]
        for ep in endpoints:
            r = requests.get(f"{API}{ep}", headers=H(t))
            assert r.status_code == 200, f"admin failed on {ep}: {r.status_code}"

    def test_production_cannot_access_leads(self, tokens):
        r = requests.get(f"{API}/leads", headers=H(tokens["production"]))
        assert r.status_code == 403
