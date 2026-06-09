from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

ROLES = ["admin", "sales", "production", "store", "accounts", "installation"]
MATERIAL_CATEGORIES = [
    "ACP", "Acrylic", "SS", "LED Modules", "Drivers",
    "Vinyl", "MS Pipe", "Electrical", "Hardware", "Paint",
]
PRODUCTION_STAGES = [
    "Cutting", "Fabrication", "Welding", "Painting",
    "LED Assembly", "Quality Check", "Packing", "Dispatch",
]
STAGE_STATUSES = ["pending", "in_progress", "completed"]

MARGIN_THRESHOLD = 15.0  # %


# ---------- helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload.get("sub")}, {"password_hash": 0, "_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*allowed_roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] == "admin":
            return user
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden: insufficient role")
        return user
    return checker


async def _get(collection: str, item_id: str) -> dict:
    doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


async def _list(collection: str, query: dict = None) -> List[dict]:
    return await db[collection].find(query or {}, {"_id": 0}).sort("created_at", -1).to_list(10000)


# ---------- Models ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


# Leads
class Lead(BaseModel):
    id: str = Field(default_factory=gen_id)
    name: str
    company: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    source: Optional[str] = "Website"
    status: str = "new"
    notes: Optional[str] = ""
    estimated_value: float = 0.0
    created_at: str = Field(default_factory=now_iso)


class LeadCreate(BaseModel):
    name: str
    company: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    source: Optional[str] = "Website"
    status: str = "new"
    notes: Optional[str] = ""
    estimated_value: float = 0.0


# Quotations
class QuotationItem(BaseModel):
    description: str
    qty: float = 1
    unit_price: float = 0.0


class Quotation(BaseModel):
    id: str = Field(default_factory=gen_id)
    quote_no: str
    client_name: str
    lead_id: Optional[str] = None
    items: List[QuotationItem] = []
    subtotal: float = 0.0
    tax_pct: float = 18.0
    total: float = 0.0
    status: str = "draft"
    created_at: str = Field(default_factory=now_iso)


class QuotationCreate(BaseModel):
    client_name: str
    lead_id: Optional[str] = None
    items: List[QuotationItem] = []
    tax_pct: float = 18.0
    status: str = "draft"


# Projects
class Project(BaseModel):
    id: str = Field(default_factory=gen_id)
    project_no: str
    name: str
    client_name: str
    quotation_id: Optional[str] = None
    contract_value: float = 0.0
    status: str = "new"
    approved: bool = False
    production_completed: bool = False
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class ProjectCreate(BaseModel):
    name: str
    client_name: str
    quotation_id: Optional[str] = None
    contract_value: float = 0.0
    status: str = "new"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    contract_value: Optional[float] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None


# Suppliers
class Supplier(BaseModel):
    id: str = Field(default_factory=gen_id)
    name: str
    mobile: Optional[str] = ""
    gst_number: Optional[str] = ""
    address: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class SupplierCreate(BaseModel):
    name: str
    mobile: Optional[str] = ""
    gst_number: Optional[str] = ""
    address: Optional[str] = ""


# Materials
class Material(BaseModel):
    id: str = Field(default_factory=gen_id)
    code: str
    name: str
    category: str = "Hardware"
    unit: str = "pcs"
    stock_qty: float = 0.0
    min_stock: float = 0.0
    purchase_rate: float = 0.0
    selling_rate: float = 0.0
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class MaterialCreate(BaseModel):
    code: str
    name: str
    category: str = "Hardware"
    unit: str = "pcs"
    stock_qty: float = 0.0
    min_stock: float = 0.0
    purchase_rate: float = 0.0
    selling_rate: float = 0.0
    supplier_id: Optional[str] = None


# Stock movements
class StockInCreate(BaseModel):
    supplier_id: Optional[str] = None
    material_id: str
    qty: float
    rate: float
    date: Optional[str] = None
    note: Optional[str] = ""


class StockOutCreate(BaseModel):
    project_id: str
    material_id: str
    qty: float
    note: Optional[str] = ""


class StockMovement(BaseModel):
    id: str = Field(default_factory=gen_id)
    material_id: str
    material_name: Optional[str] = ""
    type: str  # "in" or "out"
    qty: float
    rate: float = 0.0
    amount: float = 0.0
    project_id: Optional[str] = None
    project_no: Optional[str] = ""
    project_name: Optional[str] = ""
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = ""
    note: Optional[str] = ""
    date: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# Purchases
class Purchase(BaseModel):
    id: str = Field(default_factory=gen_id)
    po_no: str
    supplier_id: Optional[str] = None
    supplier_name: str
    material_id: Optional[str] = None
    material_name: Optional[str] = ""
    qty: float = 0.0
    rate: float = 0.0
    subtotal: float = 0.0
    gst_pct: float = 18.0
    gst_amount: float = 0.0
    total: float = 0.0
    purchase_date: Optional[str] = None
    payment_terms: str = "cash"  # cash | credit
    paid_amount: float = 0.0
    payment_status: str = "pending"  # pending | partial | paid
    status: str = "pending"  # pending | approved | received | cancelled
    created_at: str = Field(default_factory=now_iso)


class PurchaseCreate(BaseModel):
    supplier_id: Optional[str] = None
    supplier_name: str
    material_id: Optional[str] = None
    material_name: Optional[str] = ""
    qty: float = 0.0
    rate: float = 0.0
    gst_pct: float = 18.0
    purchase_date: Optional[str] = None
    payment_terms: str = "cash"


class VendorPayment(BaseModel):
    id: str = Field(default_factory=gen_id)
    supplier_id: str
    supplier_name: str
    purchase_id: Optional[str] = None
    po_no: Optional[str] = ""
    amount: float
    method: str = "bank"  # cash | bank | upi | cheque
    note: Optional[str] = ""
    date: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class VendorPaymentCreate(BaseModel):
    supplier_id: str
    purchase_id: Optional[str] = None
    amount: float
    method: str = "bank"
    note: Optional[str] = ""
    date: Optional[str] = None


# Installation
class Installation(BaseModel):
    id: str = Field(default_factory=gen_id)
    install_no: str
    project_id: str
    project_no: Optional[str] = ""
    project_name: Optional[str] = ""
    site_location: str
    team_leader: Optional[str] = ""
    installation_date: Optional[str] = None
    status: str = "scheduled"  # scheduled | in_progress | completed
    before_photos: List[str] = []
    during_photos: List[str] = []
    after_photos: List[str] = []
    client_signature: Optional[str] = None
    client_name_signoff: Optional[str] = ""
    signed_at: Optional[str] = None
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class InstallationCreate(BaseModel):
    project_id: str
    site_location: str
    team_leader: Optional[str] = ""
    installation_date: Optional[str] = None
    status: str = "scheduled"
    notes: Optional[str] = ""


class InstallationUpdate(BaseModel):
    site_location: Optional[str] = None
    team_leader: Optional[str] = None
    installation_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PhotoUpload(BaseModel):
    bucket: str  # "before" | "during" | "after"
    data_url: str  # base64 data URL


class SignoffIn(BaseModel):
    client_name: str
    signature: str  # base64 data URL


# Production
class ProductionStage(BaseModel):
    name: str
    status: str = "pending"  # pending | in_progress | completed
    assigned_to: Optional[str] = ""
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class ProductionJob(BaseModel):
    id: str = Field(default_factory=gen_id)
    job_no: str
    project_id: str
    project_no: Optional[str] = ""
    project_name: Optional[str] = ""
    stages: List[ProductionStage] = []
    progress: int = 0
    notes: Optional[str] = ""
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class ProductionJobCreate(BaseModel):
    project_id: str
    notes: Optional[str] = ""


class StageUpdate(BaseModel):
    status: str  # pending | in_progress | completed
    assigned_to: Optional[str] = None


# Costing
class Cost(BaseModel):
    id: str = Field(default_factory=gen_id)
    project_id: str
    material_cost: float = 0.0
    labour_cost: float = 0.0
    transport_cost: float = 0.0
    machine_cost: float = 0.0
    overhead_cost: float = 0.0
    total_cost: float = 0.0
    updated_at: str = Field(default_factory=now_iso)


class CostUpdate(BaseModel):
    material_cost: Optional[float] = None
    labour_cost: Optional[float] = None
    transport_cost: Optional[float] = None
    machine_cost: Optional[float] = None
    overhead_cost: Optional[float] = None


# ---------- FastAPI app ----------
app = FastAPI(title="LUMIASIGN ERP")
api = APIRouter(prefix="/api")


# ---------- Auth ----------
@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------- Constants exposure ----------
@api.get("/constants")
async def constants(user: dict = Depends(get_current_user)):
    return {
        "material_categories": MATERIAL_CATEGORIES,
        "production_stages": PRODUCTION_STAGES,
        "stage_statuses": STAGE_STATUSES,
        "margin_threshold": MARGIN_THRESHOLD,
    }


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    projects = await db.projects.find({}, {"_id": 0}).to_list(10000)
    materials = await db.materials.find({}, {"_id": 0}).to_list(10000)
    costs = await db.costs.find({}, {"_id": 0}).to_list(10000)
    installations = await db.installations.find({}, {"_id": 0}).to_list(10000)
    jobs = await db.production_jobs.find({}, {"_id": 0}).to_list(10000)
    purchases = await db.purchases.find({}, {"_id": 0}).to_list(10000)

    completed = [p for p in projects if p["status"] == "completed"]
    pending = [p for p in projects if p["status"] not in ("completed", "cancelled")]
    revenue = sum(p.get("contract_value", 0) for p in completed)
    cost_map = {c["project_id"]: c.get("total_cost", 0) for c in costs}
    profit = sum(p.get("contract_value", 0) - cost_map.get(p["id"], 0) for p in completed)
    low_stock = [m for m in materials if m["stock_qty"] <= m["min_stock"]]
    inventory_value = sum(m["stock_qty"] * m.get("purchase_rate", 0) for m in materials)

    production_in_progress = len([j for j in jobs if any(s["status"] == "in_progress" for s in j.get("stages", []))])
    installations_pending = len([i for i in installations if i["status"] in ("scheduled", "in_progress")])
    installations_completed = len([i for i in installations if i["status"] == "completed"])
    outstanding_payable = sum((p.get("total", 0) - p.get("paid_amount", 0)) for p in purchases if p.get("payment_terms") == "credit" and p.get("payment_status") != "paid")

    trend = {}
    for p in completed:
        try:
            d = datetime.fromisoformat(p["created_at"])
            key = d.strftime("%b %Y")
            trend[key] = trend.get(key, 0) + p.get("contract_value", 0)
        except Exception:
            pass
    trend_list = [{"month": k, "revenue": v} for k, v in trend.items()][-6:]

    status_breakdown = {}
    for p in projects:
        status_breakdown[p["status"]] = status_breakdown.get(p["status"], 0) + 1

    # Margin alerts
    margin_alerts = []
    for p in projects:
        cv = p.get("contract_value", 0)
        tc = cost_map.get(p["id"], 0)
        if cv > 0:
            margin = (cv - tc) / cv * 100
            if margin < MARGIN_THRESHOLD:
                margin_alerts.append({"project_id": p["id"], "project_no": p["project_no"], "name": p["name"], "margin_pct": round(margin, 2)})

    return {
        "revenue": revenue,
        "profit": profit,
        "pending_projects": len(pending),
        "completed_projects": len(completed),
        "total_projects": len(projects),
        "low_stock_count": len(low_stock),
        "low_stock_items": low_stock[:10],
        "inventory_value": round(inventory_value, 2),
        "production_in_progress": production_in_progress,
        "installations_pending": installations_pending,
        "installations_completed": installations_completed,
        "outstanding_payable": round(outstanding_payable, 2),
        "revenue_trend": trend_list,
        "status_breakdown": [{"name": k, "value": v} for k, v in status_breakdown.items()],
        "margin_alerts": margin_alerts[:10],
        "margin_threshold": MARGIN_THRESHOLD,
    }


# ---------- Leads ----------
@api.get("/leads")
async def list_leads(user: dict = Depends(require_roles("sales"))):
    return await _list("leads")


@api.post("/leads")
async def create_lead(data: LeadCreate, user: dict = Depends(require_roles("sales"))):
    lead = Lead(**data.model_dump())
    await db.leads.insert_one(lead.model_dump())
    return lead.model_dump()


@api.put("/leads/{lead_id}")
async def update_lead(lead_id: str, data: LeadCreate, user: dict = Depends(require_roles("sales"))):
    await _get("leads", lead_id)
    await db.leads.update_one({"id": lead_id}, {"$set": data.model_dump()})
    return await _get("leads", lead_id)


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(require_roles("sales"))):
    await db.leads.delete_one({"id": lead_id})
    return {"ok": True}


# ---------- Quotations ----------
def calc_quote_totals(items: List[QuotationItem], tax_pct: float):
    subtotal = sum(i.qty * i.unit_price for i in items)
    total = subtotal * (1 + tax_pct / 100)
    return round(subtotal, 2), round(total, 2)


@api.get("/quotations")
async def list_quotations(user: dict = Depends(require_roles("sales", "accounts"))):
    return await _list("quotations")


@api.post("/quotations")
async def create_quotation(data: QuotationCreate, user: dict = Depends(require_roles("sales"))):
    count = await db.quotations.count_documents({})
    quote_no = f"QT-{1000 + count + 1}"
    subtotal, total = calc_quote_totals(data.items, data.tax_pct)
    q = Quotation(quote_no=quote_no, client_name=data.client_name, lead_id=data.lead_id,
                  items=data.items, subtotal=subtotal, tax_pct=data.tax_pct, total=total, status=data.status)
    await db.quotations.insert_one(q.model_dump())
    return q.model_dump()


@api.put("/quotations/{quote_id}")
async def update_quotation(quote_id: str, data: QuotationCreate, user: dict = Depends(require_roles("sales"))):
    await _get("quotations", quote_id)
    subtotal, total = calc_quote_totals(data.items, data.tax_pct)
    update = data.model_dump()
    update.update({"subtotal": subtotal, "total": total})
    await db.quotations.update_one({"id": quote_id}, {"$set": update})
    return await _get("quotations", quote_id)


@api.delete("/quotations/{quote_id}")
async def delete_quotation(quote_id: str, user: dict = Depends(require_roles("sales"))):
    await db.quotations.delete_one({"id": quote_id})
    return {"ok": True}


# ---------- Projects ----------
@api.get("/projects")
async def list_projects(q: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query: dict = {}
    if status:
        query["status"] = status
    docs = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    if q:
        qlow = q.lower()
        docs = [d for d in docs if qlow in d.get("name", "").lower() or qlow in d.get("client_name", "").lower() or qlow in d.get("project_no", "").lower()]
    return docs


@api.post("/projects")
async def create_project(data: ProjectCreate, user: dict = Depends(require_roles("sales"))):
    count = await db.projects.count_documents({})
    project_no = f"PRJ-{2000 + count + 1}"
    p = Project(project_no=project_no, **data.model_dump())
    await db.projects.insert_one(p.model_dump())
    cost = Cost(project_id=p.id, total_cost=0.0)
    await db.costs.insert_one(cost.model_dump())
    return p.model_dump()


@api.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    return await _get("projects", project_id)


@api.put("/projects/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate, user: dict = Depends(require_roles("sales", "production"))):
    await _get("projects", project_id)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.projects.update_one({"id": project_id}, {"$set": update})
    return await _get("projects", project_id)


@api.post("/projects/{project_id}/approve")
async def approve_project(project_id: str, user: dict = Depends(require_roles("sales"))):
    project = await _get("projects", project_id)
    await db.projects.update_one({"id": project_id}, {"$set": {"approved": True}})
    project["approved"] = True
    return project


@api.post("/projects/{project_id}/complete-production")
async def complete_production_flag(project_id: str, user: dict = Depends(require_roles("production"))):
    await _get("projects", project_id)
    await db.projects.update_one({"id": project_id}, {"$set": {"production_completed": True, "status": "installation"}})
    return await _get("projects", project_id)


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(require_roles("sales"))):
    await db.projects.delete_one({"id": project_id})
    await db.costs.delete_many({"project_id": project_id})
    await db.production_jobs.delete_many({"project_id": project_id})
    await db.installations.delete_many({"project_id": project_id})
    return {"ok": True}


# ---------- Suppliers ----------
@api.get("/suppliers")
async def list_suppliers(user: dict = Depends(require_roles("store", "accounts"))):
    suppliers = await _list("suppliers")
    purchases = await db.purchases.find({}, {"_id": 0}).to_list(10000)
    payments = await db.vendor_payments.find({}, {"_id": 0}).to_list(10000)

    for s in suppliers:
        sup_pos = [p for p in purchases if p.get("supplier_id") == s["id"]]
        s["total_purchases"] = round(sum(p.get("total", 0) for p in sup_pos), 2)
        s["po_count"] = len(sup_pos)
        s["outstanding"] = round(
            sum((p.get("total", 0) - p.get("paid_amount", 0)) for p in sup_pos if p.get("payment_terms") == "credit"),
            2,
        )
        s["paid_total"] = round(sum(pm.get("amount", 0) for pm in payments if pm.get("supplier_id") == s["id"]), 2)
    return suppliers


@api.post("/suppliers")
async def create_supplier(data: SupplierCreate, user: dict = Depends(require_roles("store", "accounts"))):
    s = Supplier(**data.model_dump())
    await db.suppliers.insert_one(s.model_dump())
    return s.model_dump()


@api.put("/suppliers/{sup_id}")
async def update_supplier(sup_id: str, data: SupplierCreate, user: dict = Depends(require_roles("store", "accounts"))):
    await _get("suppliers", sup_id)
    await db.suppliers.update_one({"id": sup_id}, {"$set": data.model_dump()})
    return await _get("suppliers", sup_id)


@api.delete("/suppliers/{sup_id}")
async def delete_supplier(sup_id: str, user: dict = Depends(require_roles("store", "accounts"))):
    await db.suppliers.delete_one({"id": sup_id})
    return {"ok": True}


@api.get("/suppliers/{sup_id}/ledger")
async def supplier_ledger(sup_id: str, user: dict = Depends(require_roles("store", "accounts"))):
    supplier = await _get("suppliers", sup_id)
    purchases = await db.purchases.find({"supplier_id": sup_id}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    payments = await db.vendor_payments.find({"supplier_id": sup_id}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    total_billed = sum(p.get("total", 0) for p in purchases)
    total_paid = sum(p.get("amount", 0) for p in payments)
    return {
        "supplier": supplier,
        "purchases": purchases,
        "payments": payments,
        "total_billed": round(total_billed, 2),
        "total_paid": round(total_paid, 2),
        "outstanding": round(total_billed - total_paid, 2),
    }


# ---------- Materials ----------
@api.get("/materials")
async def list_materials(q: Optional[str] = None, category: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if category:
        query["category"] = category
    docs = await db.materials.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    if q:
        qlow = q.lower()
        docs = [m for m in docs if qlow in m["name"].lower() or qlow in m["code"].lower() or qlow in m.get("category", "").lower()]
    return docs


@api.post("/materials")
async def create_material(data: MaterialCreate, user: dict = Depends(require_roles("store"))):
    supplier_name = ""
    if data.supplier_id:
        sup = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
        if sup:
            supplier_name = sup["name"]
    m = Material(**data.model_dump(), supplier_name=supplier_name)
    await db.materials.insert_one(m.model_dump())
    return m.model_dump()


@api.put("/materials/{material_id}")
async def update_material(material_id: str, data: MaterialCreate, user: dict = Depends(require_roles("store"))):
    await _get("materials", material_id)
    supplier_name = ""
    if data.supplier_id:
        sup = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
        if sup:
            supplier_name = sup["name"]
    update = data.model_dump()
    update["supplier_name"] = supplier_name
    await db.materials.update_one({"id": material_id}, {"$set": update})
    return await _get("materials", material_id)


@api.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(require_roles("store"))):
    await db.materials.delete_one({"id": material_id})
    return {"ok": True}


# Stock movements
@api.get("/stock-movements")
async def list_stock_moves(type: Optional[str] = None, user: dict = Depends(require_roles("store", "production"))):
    query = {}
    if type in ("in", "out"):
        query["type"] = type
    return await db.stock_movements.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)


@api.post("/stock/in")
async def stock_in(data: StockInCreate, user: dict = Depends(require_roles("store"))):
    mat = await _get("materials", data.material_id)
    supplier_name = ""
    if data.supplier_id:
        sup = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
        if sup:
            supplier_name = sup["name"]
    amount = round(data.qty * data.rate, 2)
    sm = StockMovement(
        material_id=data.material_id, material_name=mat["name"],
        type="in", qty=data.qty, rate=data.rate, amount=amount,
        supplier_id=data.supplier_id, supplier_name=supplier_name,
        note=data.note, date=data.date or now_iso(),
    )
    await db.stock_movements.insert_one(sm.model_dump())
    await db.materials.update_one(
        {"id": data.material_id},
        {"$set": {"stock_qty": mat["stock_qty"] + data.qty, "purchase_rate": data.rate}},
    )
    return sm.model_dump()


@api.post("/stock/out")
async def stock_out(data: StockOutCreate, user: dict = Depends(require_roles("store", "production"))):
    mat = await _get("materials", data.material_id)
    project = await _get("projects", data.project_id)
    new_qty = mat["stock_qty"] - data.qty
    if new_qty < 0:
        raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {mat['stock_qty']} {mat['unit']}")
    sm = StockMovement(
        material_id=data.material_id, material_name=mat["name"],
        type="out", qty=data.qty, rate=mat.get("purchase_rate", 0),
        amount=round(data.qty * mat.get("purchase_rate", 0), 2),
        project_id=data.project_id, project_no=project.get("project_no"), project_name=project["name"],
        note=data.note, date=now_iso(),
    )
    await db.stock_movements.insert_one(sm.model_dump())
    await db.materials.update_one({"id": data.material_id}, {"$set": {"stock_qty": new_qty}})

    # Roll up to project material cost
    cost = await db.costs.find_one({"project_id": data.project_id}, {"_id": 0})
    if not cost:
        cost = Cost(project_id=data.project_id).model_dump()
    cost["material_cost"] = round(cost.get("material_cost", 0) + sm.amount, 2)
    cost["total_cost"] = round(
        cost["material_cost"] + cost.get("labour_cost", 0) + cost.get("transport_cost", 0)
        + cost.get("machine_cost", 0) + cost.get("overhead_cost", 0), 2,
    )
    cost["updated_at"] = now_iso()
    await db.costs.update_one({"project_id": data.project_id}, {"$set": cost}, upsert=True)

    return sm.model_dump()


# ---------- Purchases ----------
def _purchase_totals(qty: float, rate: float, gst_pct: float):
    subtotal = round(qty * rate, 2)
    gst_amount = round(subtotal * gst_pct / 100, 2)
    total = round(subtotal + gst_amount, 2)
    return subtotal, gst_amount, total


@api.get("/purchases")
async def list_purchases(user: dict = Depends(require_roles("store", "accounts"))):
    return await _list("purchases")


@api.post("/purchases")
async def create_purchase(data: PurchaseCreate, user: dict = Depends(require_roles("store"))):
    count = await db.purchases.count_documents({})
    po_no = f"PO-{3000 + count + 1}"

    supplier_name = data.supplier_name
    if data.supplier_id:
        sup = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
        if sup:
            supplier_name = sup["name"]

    mat_name = data.material_name or ""
    if data.material_id:
        mat = await db.materials.find_one({"id": data.material_id}, {"_id": 0})
        if mat:
            mat_name = mat["name"]

    subtotal, gst_amount, total = _purchase_totals(data.qty, data.rate, data.gst_pct)
    p = Purchase(
        po_no=po_no, supplier_id=data.supplier_id, supplier_name=supplier_name,
        material_id=data.material_id, material_name=mat_name, qty=data.qty, rate=data.rate,
        subtotal=subtotal, gst_pct=data.gst_pct, gst_amount=gst_amount, total=total,
        purchase_date=data.purchase_date or now_iso(),
        payment_terms=data.payment_terms,
        paid_amount=total if data.payment_terms == "cash" else 0.0,
        payment_status="paid" if data.payment_terms == "cash" else "pending",
        status="pending",
    )
    await db.purchases.insert_one(p.model_dump())
    return p.model_dump()


@api.put("/purchases/{po_id}")
async def update_purchase(po_id: str, data: PurchaseCreate, user: dict = Depends(require_roles("store"))):
    existing = await _get("purchases", po_id)
    if existing["status"] == "received":
        raise HTTPException(status_code=400, detail="Cannot edit a received PO")
    subtotal, gst_amount, total = _purchase_totals(data.qty, data.rate, data.gst_pct)
    supplier_name = data.supplier_name
    if data.supplier_id:
        sup = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
        if sup:
            supplier_name = sup["name"]
    mat_name = data.material_name or ""
    if data.material_id:
        mat = await db.materials.find_one({"id": data.material_id}, {"_id": 0})
        if mat:
            mat_name = mat["name"]
    update = {
        **data.model_dump(),
        "supplier_name": supplier_name,
        "material_name": mat_name,
        "subtotal": subtotal,
        "gst_amount": gst_amount,
        "total": total,
    }
    await db.purchases.update_one({"id": po_id}, {"$set": update})
    return await _get("purchases", po_id)


@api.post("/purchases/{po_id}/approve")
async def approve_purchase(po_id: str, user: dict = Depends(require_roles("accounts"))):
    po = await _get("purchases", po_id)
    if po["status"] in ("approved", "received"):
        return po
    await db.purchases.update_one({"id": po_id}, {"$set": {"status": "approved"}})
    return await _get("purchases", po_id)


@api.post("/purchases/{po_id}/receive")
async def receive_purchase(po_id: str, user: dict = Depends(require_roles("store"))):
    po = await _get("purchases", po_id)
    if po["status"] == "received":
        return po
    if po.get("material_id"):
        mat = await db.materials.find_one({"id": po["material_id"]}, {"_id": 0})
        if mat:
            await db.materials.update_one(
                {"id": po["material_id"]},
                {"$set": {"stock_qty": mat["stock_qty"] + po["qty"], "purchase_rate": po["rate"]}},
            )
            sm = StockMovement(
                material_id=po["material_id"], material_name=mat["name"],
                type="in", qty=po["qty"], rate=po["rate"],
                amount=round(po["qty"] * po["rate"], 2),
                supplier_id=po.get("supplier_id"), supplier_name=po.get("supplier_name", ""),
                note=f"PO {po['po_no']} received", date=now_iso(),
            )
            await db.stock_movements.insert_one(sm.model_dump())
    await db.purchases.update_one({"id": po_id}, {"$set": {"status": "received"}})
    return await _get("purchases", po_id)


@api.delete("/purchases/{po_id}")
async def delete_purchase(po_id: str, user: dict = Depends(require_roles("store"))):
    await db.purchases.delete_one({"id": po_id})
    return {"ok": True}


# Vendor payments
@api.get("/vendor-payments")
async def list_vendor_payments(supplier_id: Optional[str] = None, user: dict = Depends(require_roles("accounts"))):
    query = {}
    if supplier_id:
        query["supplier_id"] = supplier_id
    return await db.vendor_payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)


@api.post("/vendor-payments")
async def create_vendor_payment(data: VendorPaymentCreate, user: dict = Depends(require_roles("accounts"))):
    supplier = await _get("suppliers", data.supplier_id)
    po_no = ""
    if data.purchase_id:
        po = await db.purchases.find_one({"id": data.purchase_id}, {"_id": 0})
        if po:
            po_no = po["po_no"]
            new_paid = round(po.get("paid_amount", 0) + data.amount, 2)
            new_paid = min(new_paid, po["total"])
            new_status = "paid" if new_paid >= po["total"] - 0.01 else ("partial" if new_paid > 0 else "pending")
            await db.purchases.update_one(
                {"id": data.purchase_id},
                {"$set": {"paid_amount": new_paid, "payment_status": new_status}},
            )

    payment = VendorPayment(
        supplier_id=data.supplier_id, supplier_name=supplier["name"],
        purchase_id=data.purchase_id, po_no=po_no,
        amount=data.amount, method=data.method, note=data.note,
        date=data.date or now_iso(),
    )
    await db.vendor_payments.insert_one(payment.model_dump())
    return payment.model_dump()


@api.delete("/vendor-payments/{pid}")
async def delete_vendor_payment(pid: str, user: dict = Depends(require_roles("accounts"))):
    pay = await _get("vendor_payments", pid)
    # Reverse PO payment
    if pay.get("purchase_id"):
        po = await db.purchases.find_one({"id": pay["purchase_id"]}, {"_id": 0})
        if po:
            new_paid = max(0.0, round(po.get("paid_amount", 0) - pay["amount"], 2))
            new_status = "paid" if new_paid >= po["total"] - 0.01 else ("partial" if new_paid > 0 else "pending")
            await db.purchases.update_one(
                {"id": pay["purchase_id"]},
                {"$set": {"paid_amount": new_paid, "payment_status": new_status}},
            )
    await db.vendor_payments.delete_one({"id": pid})
    return {"ok": True}


# ---------- Production ----------
def _new_stages() -> List[dict]:
    return [ProductionStage(name=s).model_dump() for s in PRODUCTION_STAGES]


def _calc_progress(stages: List[dict]) -> int:
    if not stages:
        return 0
    completed = sum(1 for s in stages if s["status"] == "completed")
    return int(round(completed / len(stages) * 100))


@api.get("/production")
async def list_production(user: dict = Depends(require_roles("production"))):
    return await _list("production_jobs")


@api.post("/production")
async def create_production(data: ProductionJobCreate, user: dict = Depends(require_roles("production"))):
    project = await _get("projects", data.project_id)
    if not project.get("approved", False):
        raise HTTPException(status_code=400, detail="Project must be approved before production can start")
    count = await db.production_jobs.count_documents({})
    job_no = f"JOB-{4000 + count + 1}"
    job = ProductionJob(
        job_no=job_no,
        project_id=data.project_id, project_no=project["project_no"], project_name=project["name"],
        stages=_new_stages(), progress=0, notes=data.notes, started_at=now_iso(),
    )
    await db.production_jobs.insert_one(job.model_dump())
    await db.projects.update_one({"id": project["id"]}, {"$set": {"status": "in_production"}})
    return job.model_dump()


@api.put("/production/{job_id}/stage/{stage_idx}")
async def update_stage(job_id: str, stage_idx: int, data: StageUpdate, user: dict = Depends(require_roles("production"))):
    job = await _get("production_jobs", job_id)
    stages = job.get("stages", [])
    if stage_idx < 0 or stage_idx >= len(stages):
        raise HTTPException(status_code=400, detail="Invalid stage index")
    if data.status not in STAGE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    stage = stages[stage_idx]
    stage["status"] = data.status
    if data.assigned_to is not None:
        stage["assigned_to"] = data.assigned_to
    if data.status == "in_progress" and not stage.get("started_at"):
        stage["started_at"] = now_iso()
    if data.status == "completed":
        stage["completed_at"] = now_iso()
    progress = _calc_progress(stages)
    update = {"stages": stages, "progress": progress}
    if progress == 100:
        update["completed_at"] = now_iso()
        # Mark project production completed
        await db.projects.update_one(
            {"id": job["project_id"]},
            {"$set": {"production_completed": True, "status": "installation"}},
        )
    await db.production_jobs.update_one({"id": job_id}, {"$set": update})
    return await _get("production_jobs", job_id)


@api.delete("/production/{job_id}")
async def delete_production(job_id: str, user: dict = Depends(require_roles("production"))):
    await db.production_jobs.delete_one({"id": job_id})
    return {"ok": True}


# ---------- Installation ----------
@api.get("/installations")
async def list_installations(user: dict = Depends(require_roles("installation", "sales"))):
    return await _list("installations")


@api.post("/installations")
async def create_installation(data: InstallationCreate, user: dict = Depends(require_roles("installation", "sales"))):
    project = await _get("projects", data.project_id)
    if not project.get("production_completed", False):
        raise HTTPException(status_code=400, detail="Cannot start installation until production is completed")
    count = await db.installations.count_documents({})
    install_no = f"INS-{5000 + count + 1}"
    inst = Installation(
        install_no=install_no, project_id=data.project_id,
        project_no=project["project_no"], project_name=project["name"],
        site_location=data.site_location, team_leader=data.team_leader,
        installation_date=data.installation_date, status=data.status, notes=data.notes,
    )
    await db.installations.insert_one(inst.model_dump())
    return inst.model_dump()


@api.get("/installations/{inst_id}")
async def get_installation(inst_id: str, user: dict = Depends(require_roles("installation", "sales"))):
    return await _get("installations", inst_id)


@api.put("/installations/{inst_id}")
async def update_installation(inst_id: str, data: InstallationUpdate, user: dict = Depends(require_roles("installation"))):
    existing = await _get("installations", inst_id)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.installations.update_one({"id": inst_id}, {"$set": update})
    if data.status == "completed":
        await db.projects.update_one({"id": existing["project_id"]}, {"$set": {"status": "completed"}})
    return await _get("installations", inst_id)


@api.post("/installations/{inst_id}/photo")
async def add_photo(inst_id: str, payload: PhotoUpload, user: dict = Depends(require_roles("installation"))):
    inst = await _get("installations", inst_id)
    if payload.bucket not in ("before", "during", "after"):
        raise HTTPException(status_code=400, detail="Invalid bucket")
    field = f"{payload.bucket}_photos"
    photos = inst.get(field, []) + [payload.data_url]
    await db.installations.update_one({"id": inst_id}, {"$set": {field: photos}})
    return {"ok": True, "count": len(photos)}


@api.delete("/installations/{inst_id}/photo")
async def remove_photo(inst_id: str, bucket: str, index: int, user: dict = Depends(require_roles("installation"))):
    inst = await _get("installations", inst_id)
    if bucket not in ("before", "during", "after"):
        raise HTTPException(status_code=400, detail="Invalid bucket")
    field = f"{bucket}_photos"
    photos = inst.get(field, [])
    if 0 <= index < len(photos):
        del photos[index]
        await db.installations.update_one({"id": inst_id}, {"$set": {field: photos}})
    return {"ok": True}


@api.post("/installations/{inst_id}/signoff")
async def signoff(inst_id: str, data: SignoffIn, user: dict = Depends(require_roles("installation"))):
    inst = await _get("installations", inst_id)
    await db.installations.update_one(
        {"id": inst_id},
        {"$set": {
            "client_signature": data.signature,
            "client_name_signoff": data.client_name,
            "signed_at": now_iso(),
            "status": "completed",
        }},
    )
    await db.projects.update_one({"id": inst["project_id"]}, {"$set": {"status": "completed"}})
    return await _get("installations", inst_id)


@api.delete("/installations/{inst_id}")
async def delete_installation(inst_id: str, user: dict = Depends(require_roles("installation"))):
    await db.installations.delete_one({"id": inst_id})
    return {"ok": True}


# ---------- Costing ----------
@api.get("/costs")
async def list_costs(user: dict = Depends(require_roles("accounts", "production"))):
    return await _list("costs")


@api.get("/costs/{project_id}")
async def get_cost(project_id: str, user: dict = Depends(get_current_user)):
    cost = await db.costs.find_one({"project_id": project_id}, {"_id": 0})
    if not cost:
        cost = Cost(project_id=project_id).model_dump()
        await db.costs.insert_one(cost)
    return cost


@api.put("/costs/{project_id}")
async def update_cost(project_id: str, data: CostUpdate, user: dict = Depends(require_roles("accounts", "production"))):
    cost = await db.costs.find_one({"project_id": project_id}, {"_id": 0})
    if not cost:
        cost = Cost(project_id=project_id).model_dump()
        await db.costs.insert_one(cost)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    new_cost = {**cost, **update}
    new_cost["total_cost"] = round(
        new_cost["material_cost"] + new_cost["labour_cost"] + new_cost["transport_cost"]
        + new_cost["machine_cost"] + new_cost["overhead_cost"], 2,
    )
    new_cost["updated_at"] = now_iso()
    await db.costs.update_one({"project_id": project_id}, {"$set": new_cost})
    return new_cost


# ---------- Profit Analysis ----------
@api.get("/profit-analysis")
async def profit_analysis(user: dict = Depends(require_roles("accounts"))):
    projects = await _list("projects")
    costs = await _list("costs")
    cost_map = {c["project_id"]: c for c in costs}
    results = []
    for p in projects:
        c = cost_map.get(p["id"], {})
        total_cost = c.get("total_cost", 0.0)
        revenue = p.get("contract_value", 0.0)
        profit = revenue - total_cost
        margin = (profit / revenue * 100) if revenue > 0 else 0
        results.append({
            "project_id": p["id"], "project_no": p["project_no"], "name": p["name"],
            "client_name": p["client_name"], "status": p["status"],
            "revenue": revenue, "total_cost": total_cost,
            "profit": round(profit, 2), "margin_pct": round(margin, 2),
            "margin_alert": margin < MARGIN_THRESHOLD and revenue > 0,
            "material_cost": c.get("material_cost", 0), "labour_cost": c.get("labour_cost", 0),
            "transport_cost": c.get("transport_cost", 0), "machine_cost": c.get("machine_cost", 0),
            "overhead_cost": c.get("overhead_cost", 0),
        })
    return results


# ---------- Reports ----------
@api.get("/reports/summary")
async def reports_summary(user: dict = Depends(require_roles("accounts"))):
    projects = await _list("projects")
    costs = await _list("costs")
    cost_map = {c["project_id"]: c.get("total_cost", 0) for c in costs}
    total_revenue = sum(p.get("contract_value", 0) for p in projects if p["status"] == "completed")
    total_cost = sum(cost_map.get(p["id"], 0) for p in projects if p["status"] == "completed")
    total_profit = total_revenue - total_cost
    materials = await _list("materials")
    inventory_value = sum(m["stock_qty"] * m.get("purchase_rate", 0) for m in materials)
    leads = await _list("leads")
    quotes = await _list("quotations")
    purchases = await _list("purchases")
    outstanding_payable = sum((p.get("total", 0) - p.get("paid_amount", 0)) for p in purchases if p.get("payment_terms") == "credit")
    return {
        "total_revenue": total_revenue, "total_cost": total_cost, "total_profit": total_profit,
        "margin_pct": round((total_profit / total_revenue * 100) if total_revenue > 0 else 0, 2),
        "inventory_value": round(inventory_value, 2),
        "leads_count": len(leads), "quotations_count": len(quotes), "projects_count": len(projects),
        "won_leads": len([ld for ld in leads if ld["status"] == "won"]),
        "outstanding_payable": round(outstanding_payable, 2),
        "purchase_count": len(purchases),
        "purchase_total": round(sum(p.get("total", 0) for p in purchases), 2),
    }


@api.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)


# ---------- Seed ----------
async def seed_users():
    seed_pwd = os.environ.get("SEED_PASSWORD", "lumia123")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@lumiasign.com")
    admin_pwd = os.environ.get("ADMIN_PASSWORD", "admin123")

    accounts = [
        ("Admin", admin_email, admin_pwd, "admin"),
        ("Sales Manager", "sales@lumiasign.com", seed_pwd, "sales"),
        ("Production Head", "production@lumiasign.com", seed_pwd, "production"),
        ("Store Keeper", "store@lumiasign.com", seed_pwd, "store"),
        ("Accounts Lead", "accounts@lumiasign.com", seed_pwd, "accounts"),
        ("Installation Lead", "installation@lumiasign.com", seed_pwd, "installation"),
    ]
    for name, email, pwd, role in accounts:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "id": gen_id(), "name": name, "email": email,
                "password_hash": hash_password(pwd), "role": role,
                "created_at": now_iso(),
            })
        elif not verify_password(pwd, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})


async def seed_demo_data():
    # Suppliers
    suppliers_seed = [
        {"name": "Apex Polymers", "mobile": "+91 90099 11200", "gst_number": "27AAAAA0000A1Z5", "address": "Andheri East, Mumbai"},
        {"name": "Bright LED Co.", "mobile": "+91 98800 21100", "gst_number": "29BBBBB1111B1Z5", "address": "Peenya, Bangalore"},
        {"name": "Vinyl World", "mobile": "+91 99100 33223", "gst_number": "07CCCCC2222C1Z5", "address": "Naraina, Delhi"},
        {"name": "Steel Mart", "mobile": "+91 70011 88990", "gst_number": "27DDDDD3333D1Z5", "address": "Bhiwandi, Maharashtra"},
    ]
    if await db.suppliers.count_documents({}) == 0:
        for s in suppliers_seed:
            await db.suppliers.insert_one(Supplier(**s).model_dump())

    sup_docs = await db.suppliers.find({}, {"_id": 0}).to_list(100)
    sup_by_name = {s["name"]: s for s in sup_docs}

    if await db.materials.count_documents({}) == 0:
        materials_seed = [
            {"code": "ACP-3MM", "name": "ACP Sheet 3mm Silver", "category": "ACP", "unit": "sqft", "stock_qty": 240, "min_stock": 80, "purchase_rate": 95.0, "selling_rate": 140.0, "supplier": "Apex Polymers"},
            {"code": "LED-12V", "name": "LED Module 12V White", "category": "LED Modules", "unit": "pcs", "stock_qty": 1200, "min_stock": 500, "purchase_rate": 18.5, "selling_rate": 32.0, "supplier": "Bright LED Co."},
            {"code": "ACR-5MM", "name": "Acrylic Sheet 5mm Clear", "category": "Acrylic", "unit": "sqft", "stock_qty": 60, "min_stock": 100, "purchase_rate": 145.0, "selling_rate": 210.0, "supplier": "Apex Polymers"},
            {"code": "SMPS-12V", "name": "SMPS Power Supply 12V 100W", "category": "Drivers", "unit": "pcs", "stock_qty": 35, "min_stock": 40, "purchase_rate": 540.0, "selling_rate": 790.0, "supplier": "Bright LED Co."},
            {"code": "VINYL-W", "name": "Vinyl Sticker White Roll", "category": "Vinyl", "unit": "roll", "stock_qty": 28, "min_stock": 10, "purchase_rate": 1850.0, "selling_rate": 2750.0, "supplier": "Vinyl World"},
            {"code": "MS-PIPE", "name": "MS Square Pipe 20mm", "category": "MS Pipe", "unit": "mtr", "stock_qty": 420, "min_stock": 150, "purchase_rate": 78.0, "selling_rate": 115.0, "supplier": "Steel Mart"},
            {"code": "SS-304", "name": "SS 304 Sheet 1mm", "category": "SS", "unit": "sqft", "stock_qty": 110, "min_stock": 60, "purchase_rate": 320.0, "selling_rate": 450.0, "supplier": "Steel Mart"},
            {"code": "PAINT-AUTO", "name": "Automotive Paint Black", "category": "Paint", "unit": "ltr", "stock_qty": 14, "min_stock": 20, "purchase_rate": 680.0, "selling_rate": 950.0, "supplier": "Apex Polymers"},
            {"code": "WIRE-2.5", "name": "Copper Wire 2.5mm 90m", "category": "Electrical", "unit": "roll", "stock_qty": 22, "min_stock": 8, "purchase_rate": 2400.0, "selling_rate": 3200.0, "supplier": "Bright LED Co."},
            {"code": "SCRW-M6", "name": "Screws M6×25 SS Pack 100", "category": "Hardware", "unit": "pack", "stock_qty": 60, "min_stock": 25, "purchase_rate": 220.0, "selling_rate": 320.0, "supplier": "Steel Mart"},
        ]
        for m in materials_seed:
            sup = sup_by_name.get(m.pop("supplier", ""))
            await db.materials.insert_one(Material(
                **m, supplier_id=sup["id"] if sup else None, supplier_name=sup["name"] if sup else "",
            ).model_dump())

    if await db.leads.count_documents({}) == 0:
        leads_seed = [
            {"name": "Rakesh Sharma", "company": "Sharma Hotels", "phone": "+91 98100 11122", "email": "rakesh@sharmahotels.in", "source": "Referral", "status": "qualified", "estimated_value": 250000},
            {"name": "Priya Iyer", "company": "BlueCart Retail", "phone": "+91 98404 99812", "email": "priya@bluecart.com", "source": "Website", "status": "contacted", "estimated_value": 540000},
            {"name": "Mohit Verma", "company": "Verma Industries", "phone": "+91 99711 23311", "email": "mohit@vermaindustries.com", "source": "Cold Call", "status": "new", "estimated_value": 180000},
            {"name": "Kavya Reddy", "company": "Reddy Foods", "phone": "+91 90099 11221", "email": "kavya@reddyfoods.in", "source": "Exhibition", "status": "won", "estimated_value": 720000},
        ]
        for ld in leads_seed:
            await db.leads.insert_one(Lead(**ld).model_dump())

    if await db.projects.count_documents({}) == 0:
        projects_seed = [
            {"name": "Sharma Hotels — Rooftop Signage", "client_name": "Sharma Hotels", "contract_value": 260000, "status": "in_production", "approved": True, "production_completed": False, "description": "Backlit ACP letters with halo lighting"},
            {"name": "BlueCart Storefront Branding", "client_name": "BlueCart Retail", "contract_value": 540000, "status": "installation", "approved": True, "production_completed": True, "description": "Front facade with acrylic 3D letters + LED"},
            {"name": "Reddy Foods Factory Board", "client_name": "Reddy Foods", "contract_value": 320000, "status": "completed", "approved": True, "production_completed": True, "description": "MS frame board with vinyl print"},
            {"name": "Verma Plant Wayfinding", "client_name": "Verma Industries", "contract_value": 180000, "status": "new", "approved": False, "description": "Internal wayfinding signage set of 24"},
            {"name": "Skyline Mall Pylon", "client_name": "Skyline Developers", "contract_value": 880000, "status": "completed", "approved": True, "production_completed": True, "description": "Double-sided pylon sign 18ft"},
        ]
        for idx, p in enumerate(projects_seed):
            prj = Project(project_no=f"PRJ-{2001 + idx}", **p)
            await db.projects.insert_one(prj.model_dump())
            cost_amount = p["contract_value"] * 0.62
            cost = Cost(
                project_id=prj.id,
                material_cost=round(cost_amount * 0.45, 2),
                labour_cost=round(cost_amount * 0.25, 2),
                transport_cost=round(cost_amount * 0.08, 2),
                machine_cost=round(cost_amount * 0.12, 2),
                overhead_cost=round(cost_amount * 0.10, 2),
                total_cost=round(cost_amount, 2),
            )
            await db.costs.insert_one(cost.model_dump())


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.leads.create_index("id", unique=True)
    await db.projects.create_index("id", unique=True)
    await db.materials.create_index("id", unique=True)
    await db.suppliers.create_index("id", unique=True)
    await db.purchases.create_index("id", unique=True)
    await db.installations.create_index("id", unique=True)
    await seed_users()
    await seed_demo_data()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
