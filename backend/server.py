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
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

ROLES = ["admin", "sales", "production", "store", "accounts", "installation"]
RoleType = Literal["admin", "sales", "production", "store", "accounts", "installation"]


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


# ---------- Models ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str


class Lead(BaseModel):
    id: str = Field(default_factory=gen_id)
    name: str
    company: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    source: Optional[str] = "Website"
    status: str = "new"  # new, contacted, qualified, lost, won
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
    status: str = "draft"  # draft, sent, approved, rejected
    created_at: str = Field(default_factory=now_iso)


class QuotationCreate(BaseModel):
    client_name: str
    lead_id: Optional[str] = None
    items: List[QuotationItem] = []
    tax_pct: float = 18.0
    status: str = "draft"


class Project(BaseModel):
    id: str = Field(default_factory=gen_id)
    project_no: str
    name: str
    client_name: str
    quotation_id: Optional[str] = None
    contract_value: float = 0.0
    status: str = "new"  # new, in_production, installation, completed, cancelled
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


class Material(BaseModel):
    id: str = Field(default_factory=gen_id)
    code: str
    name: str
    category: str = "General"
    unit: str = "pcs"
    stock_qty: float = 0.0
    reorder_level: float = 0.0
    unit_cost: float = 0.0
    created_at: str = Field(default_factory=now_iso)


class MaterialCreate(BaseModel):
    code: str
    name: str
    category: str = "General"
    unit: str = "pcs"
    stock_qty: float = 0.0
    reorder_level: float = 0.0
    unit_cost: float = 0.0


class StockMovement(BaseModel):
    id: str = Field(default_factory=gen_id)
    material_id: str
    material_name: Optional[str] = ""
    type: str  # "in" or "out"
    qty: float
    project_id: Optional[str] = None
    note: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class StockMovementCreate(BaseModel):
    material_id: str
    type: str
    qty: float
    project_id: Optional[str] = None
    note: Optional[str] = ""


class Purchase(BaseModel):
    id: str = Field(default_factory=gen_id)
    po_no: str
    vendor: str
    material_id: Optional[str] = None
    material_name: Optional[str] = ""
    qty: float = 0.0
    unit_price: float = 0.0
    total: float = 0.0
    status: str = "ordered"  # ordered, received, cancelled
    created_at: str = Field(default_factory=now_iso)


class PurchaseCreate(BaseModel):
    vendor: str
    material_id: Optional[str] = None
    material_name: Optional[str] = ""
    qty: float = 0.0
    unit_price: float = 0.0
    status: str = "ordered"


class Installation(BaseModel):
    id: str = Field(default_factory=gen_id)
    project_id: str
    project_name: Optional[str] = ""
    site_address: str
    scheduled_date: Optional[str] = None
    team: Optional[str] = ""
    status: str = "scheduled"  # scheduled, in_progress, completed
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class InstallationCreate(BaseModel):
    project_id: str
    site_address: str
    scheduled_date: Optional[str] = None
    team: Optional[str] = ""
    status: str = "scheduled"
    notes: Optional[str] = ""


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


class ProductionJob(BaseModel):
    id: str = Field(default_factory=gen_id)
    project_id: str
    project_name: Optional[str] = ""
    stage: str = "queued"  # queued, cutting, printing, fabrication, finishing, qc, done
    assigned_to: Optional[str] = ""
    progress: int = 0
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class ProductionJobCreate(BaseModel):
    project_id: str
    stage: str = "queued"
    assigned_to: Optional[str] = ""
    progress: int = 0
    notes: Optional[str] = ""


class ProductionJobUpdate(BaseModel):
    stage: Optional[str] = None
    assigned_to: Optional[str] = None
    progress: Optional[int] = None
    notes: Optional[str] = None


# ---------- FastAPI app ----------
app = FastAPI(title="LUMIASIGN ERP")
api = APIRouter(prefix="/api")


# ---------- Auth Routes ----------
@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    projects = await db.projects.find({}, {"_id": 0}).to_list(10000)
    materials = await db.materials.find({}, {"_id": 0}).to_list(10000)
    costs = await db.costs.find({}, {"_id": 0}).to_list(10000)

    completed = [p for p in projects if p["status"] == "completed"]
    pending = [p for p in projects if p["status"] not in ("completed", "cancelled")]
    revenue = sum(p.get("contract_value", 0) for p in completed)
    cost_map = {c["project_id"]: c.get("total_cost", 0) for c in costs}
    profit = sum(p.get("contract_value", 0) - cost_map.get(p["id"], 0) for p in completed)
    low_stock = [m for m in materials if m["stock_qty"] <= m["reorder_level"]]

    # last 6 months revenue trend (from completed projects)
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

    return {
        "revenue": revenue,
        "profit": profit,
        "pending_projects": len(pending),
        "completed_projects": len(completed),
        "total_projects": len(projects),
        "low_stock_count": len(low_stock),
        "low_stock_items": low_stock[:10],
        "revenue_trend": trend_list,
        "status_breakdown": [{"name": k, "value": v} for k, v in status_breakdown.items()],
    }


# ---------- Generic CRUD helpers ----------
async def _list(collection, query: dict = None) -> List[dict]:
    return await db[collection].find(query or {}, {"_id": 0}).sort("created_at", -1).to_list(10000)


async def _get(collection: str, item_id: str) -> dict:
    doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


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
    q = Quotation(
        quote_no=quote_no,
        client_name=data.client_name,
        lead_id=data.lead_id,
        items=data.items,
        subtotal=subtotal,
        tax_pct=data.tax_pct,
        total=total,
        status=data.status,
    )
    await db.quotations.insert_one(q.model_dump())
    return q.model_dump()


@api.put("/quotations/{quote_id}")
async def update_quotation(
    quote_id: str, data: QuotationCreate, user: dict = Depends(require_roles("sales"))
):
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
async def list_projects(
    q: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if status:
        query["status"] = status
    docs = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    if q:
        qlow = q.lower()
        docs = [
            d
            for d in docs
            if qlow in d.get("name", "").lower()
            or qlow in d.get("client_name", "").lower()
            or qlow in d.get("project_no", "").lower()
        ]
    return docs


@api.post("/projects")
async def create_project(data: ProjectCreate, user: dict = Depends(require_roles("sales"))):
    count = await db.projects.count_documents({})
    project_no = f"PRJ-{2000 + count + 1}"
    p = Project(project_no=project_no, **data.model_dump())
    await db.projects.insert_one(p.model_dump())
    # init zero-cost entry
    cost = Cost(project_id=p.id, total_cost=0.0)
    await db.costs.insert_one(cost.model_dump())
    return p.model_dump()


@api.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    return await _get("projects", project_id)


@api.put("/projects/{project_id}")
async def update_project(
    project_id: str, data: ProjectUpdate, user: dict = Depends(require_roles("sales", "production"))
):
    await _get("projects", project_id)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.projects.update_one({"id": project_id}, {"$set": update})
    return await _get("projects", project_id)


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(require_roles("sales"))):
    await db.projects.delete_one({"id": project_id})
    await db.costs.delete_many({"project_id": project_id})
    return {"ok": True}


# ---------- Production ----------
@api.get("/production")
async def list_production(user: dict = Depends(require_roles("production"))):
    return await _list("production_jobs")


@api.post("/production")
async def create_production(
    data: ProductionJobCreate, user: dict = Depends(require_roles("production"))
):
    project = await _get("projects", data.project_id)
    job = ProductionJob(
        project_id=data.project_id,
        project_name=project["name"],
        stage=data.stage,
        assigned_to=data.assigned_to,
        progress=data.progress,
        notes=data.notes,
    )
    await db.production_jobs.insert_one(job.model_dump())
    # also set project status if first job
    if project["status"] == "new":
        await db.projects.update_one(
            {"id": project["id"]}, {"$set": {"status": "in_production"}}
        )
    return job.model_dump()


@api.put("/production/{job_id}")
async def update_production(
    job_id: str, data: ProductionJobUpdate, user: dict = Depends(require_roles("production"))
):
    await _get("production_jobs", job_id)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.production_jobs.update_one({"id": job_id}, {"$set": update})
    return await _get("production_jobs", job_id)


@api.delete("/production/{job_id}")
async def delete_production(job_id: str, user: dict = Depends(require_roles("production"))):
    await db.production_jobs.delete_one({"id": job_id})
    return {"ok": True}


# ---------- Inventory: Materials ----------
@api.get("/materials")
async def list_materials(user: dict = Depends(get_current_user)):
    return await _list("materials")


@api.post("/materials")
async def create_material(data: MaterialCreate, user: dict = Depends(require_roles("store"))):
    m = Material(**data.model_dump())
    await db.materials.insert_one(m.model_dump())
    return m.model_dump()


@api.put("/materials/{material_id}")
async def update_material(
    material_id: str, data: MaterialCreate, user: dict = Depends(require_roles("store"))
):
    await _get("materials", material_id)
    await db.materials.update_one({"id": material_id}, {"$set": data.model_dump()})
    return await _get("materials", material_id)


@api.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(require_roles("store"))):
    await db.materials.delete_one({"id": material_id})
    return {"ok": True}


# Stock movements
@api.get("/stock-movements")
async def list_stock_moves(user: dict = Depends(require_roles("store", "production"))):
    return await _list("stock_movements")


@api.post("/stock-movements")
async def create_stock_move(
    data: StockMovementCreate, user: dict = Depends(require_roles("store", "production"))
):
    mat = await _get("materials", data.material_id)
    delta = data.qty if data.type == "in" else -data.qty
    new_qty = mat["stock_qty"] + delta
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    sm = StockMovement(
        material_id=data.material_id,
        material_name=mat["name"],
        type=data.type,
        qty=data.qty,
        project_id=data.project_id,
        note=data.note,
    )
    await db.stock_movements.insert_one(sm.model_dump())
    await db.materials.update_one({"id": data.material_id}, {"$set": {"stock_qty": new_qty}})
    return sm.model_dump()


# ---------- Purchases ----------
@api.get("/purchases")
async def list_purchases(user: dict = Depends(require_roles("store", "accounts"))):
    return await _list("purchases")


@api.post("/purchases")
async def create_purchase(data: PurchaseCreate, user: dict = Depends(require_roles("store"))):
    count = await db.purchases.count_documents({})
    po_no = f"PO-{3000 + count + 1}"
    mat_name = data.material_name or ""
    if data.material_id:
        try:
            mat = await _get("materials", data.material_id)
            mat_name = mat["name"]
        except HTTPException:
            pass
    total = round(data.qty * data.unit_price, 2)
    p = Purchase(
        po_no=po_no,
        vendor=data.vendor,
        material_id=data.material_id,
        material_name=mat_name,
        qty=data.qty,
        unit_price=data.unit_price,
        total=total,
        status=data.status,
    )
    await db.purchases.insert_one(p.model_dump())
    return p.model_dump()


@api.put("/purchases/{po_id}/receive")
async def receive_purchase(po_id: str, user: dict = Depends(require_roles("store"))):
    po = await _get("purchases", po_id)
    if po["status"] == "received":
        return po
    if po.get("material_id"):
        mat = await db.materials.find_one({"id": po["material_id"]}, {"_id": 0})
        if mat:
            await db.materials.update_one(
                {"id": po["material_id"]},
                {"$set": {"stock_qty": mat["stock_qty"] + po["qty"]}},
            )
            sm = StockMovement(
                material_id=po["material_id"],
                material_name=mat["name"],
                type="in",
                qty=po["qty"],
                note=f"PO {po['po_no']} received",
            )
            await db.stock_movements.insert_one(sm.model_dump())
    await db.purchases.update_one({"id": po_id}, {"$set": {"status": "received"}})
    return await _get("purchases", po_id)


@api.delete("/purchases/{po_id}")
async def delete_purchase(po_id: str, user: dict = Depends(require_roles("store"))):
    await db.purchases.delete_one({"id": po_id})
    return {"ok": True}


# ---------- Installation ----------
@api.get("/installations")
async def list_installations(user: dict = Depends(require_roles("installation"))):
    return await _list("installations")


@api.post("/installations")
async def create_installation(
    data: InstallationCreate, user: dict = Depends(require_roles("installation", "sales"))
):
    project = await _get("projects", data.project_id)
    inst = Installation(
        project_id=data.project_id,
        project_name=project["name"],
        site_address=data.site_address,
        scheduled_date=data.scheduled_date,
        team=data.team,
        status=data.status,
        notes=data.notes,
    )
    await db.installations.insert_one(inst.model_dump())
    if data.status == "completed":
        await db.projects.update_one({"id": project["id"]}, {"$set": {"status": "completed"}})
    elif project["status"] in ("new", "in_production"):
        await db.projects.update_one({"id": project["id"]}, {"$set": {"status": "installation"}})
    return inst.model_dump()


@api.put("/installations/{inst_id}")
async def update_installation(
    inst_id: str,
    data: InstallationCreate,
    user: dict = Depends(require_roles("installation")),
):
    existing = await _get("installations", inst_id)
    update = data.model_dump()
    await db.installations.update_one({"id": inst_id}, {"$set": update})
    if data.status == "completed":
        await db.projects.update_one(
            {"id": existing["project_id"]}, {"$set": {"status": "completed"}}
        )
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
async def update_cost(
    project_id: str, data: CostUpdate, user: dict = Depends(require_roles("accounts", "production"))
):
    cost = await db.costs.find_one({"project_id": project_id}, {"_id": 0})
    if not cost:
        cost = Cost(project_id=project_id).model_dump()
        await db.costs.insert_one(cost)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    new_cost = {**cost, **update}
    new_cost["total_cost"] = round(
        new_cost["material_cost"]
        + new_cost["labour_cost"]
        + new_cost["transport_cost"]
        + new_cost["machine_cost"]
        + new_cost["overhead_cost"],
        2,
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
        results.append(
            {
                "project_id": p["id"],
                "project_no": p["project_no"],
                "name": p["name"],
                "client_name": p["client_name"],
                "status": p["status"],
                "revenue": revenue,
                "total_cost": total_cost,
                "profit": round(profit, 2),
                "margin_pct": round(margin, 2),
                "material_cost": c.get("material_cost", 0),
                "labour_cost": c.get("labour_cost", 0),
                "transport_cost": c.get("transport_cost", 0),
                "machine_cost": c.get("machine_cost", 0),
                "overhead_cost": c.get("overhead_cost", 0),
            }
        )
    return results


# ---------- Reports ----------
@api.get("/reports/summary")
async def reports_summary(user: dict = Depends(require_roles("accounts"))):
    projects = await _list("projects")
    costs = await _list("costs")
    cost_map = {c["project_id"]: c.get("total_cost", 0) for c in costs}
    total_revenue = sum(p.get("contract_value", 0) for p in projects if p["status"] == "completed")
    total_cost = sum(
        cost_map.get(p["id"], 0) for p in projects if p["status"] == "completed"
    )
    total_profit = total_revenue - total_cost

    materials = await _list("materials")
    inventory_value = sum(m["stock_qty"] * m["unit_cost"] for m in materials)

    leads = await _list("leads")
    quotes = await _list("quotations")

    return {
        "total_revenue": total_revenue,
        "total_cost": total_cost,
        "total_profit": total_profit,
        "margin_pct": round((total_profit / total_revenue * 100) if total_revenue > 0 else 0, 2),
        "inventory_value": round(inventory_value, 2),
        "leads_count": len(leads),
        "quotations_count": len(quotes),
        "projects_count": len(projects),
        "won_leads": len([ld for ld in leads if ld["status"] == "won"]),
    }


@api.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


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
            await db.users.insert_one(
                {
                    "id": gen_id(),
                    "name": name,
                    "email": email,
                    "password_hash": hash_password(pwd),
                    "role": role,
                    "created_at": now_iso(),
                }
            )
        elif not verify_password(pwd, existing["password_hash"]):
            await db.users.update_one(
                {"email": email}, {"$set": {"password_hash": hash_password(pwd)}}
            )


async def seed_demo_data():
    if await db.materials.count_documents({}) > 0:
        return
    materials_seed = [
        {"code": "ACP-3MM", "name": "ACP Sheet 3mm Silver", "category": "Panel", "unit": "sqft", "stock_qty": 240, "reorder_level": 80, "unit_cost": 95.0},
        {"code": "LED-12V", "name": "LED Module 12V White", "category": "Electrical", "unit": "pcs", "stock_qty": 1200, "reorder_level": 500, "unit_cost": 18.5},
        {"code": "ACR-5MM", "name": "Acrylic Sheet 5mm Clear", "category": "Panel", "unit": "sqft", "stock_qty": 60, "reorder_level": 100, "unit_cost": 145.0},
        {"code": "SMPS-12V", "name": "SMPS Power Supply 12V 100W", "category": "Electrical", "unit": "pcs", "stock_qty": 35, "reorder_level": 40, "unit_cost": 540.0},
        {"code": "VINYL-W", "name": "Vinyl Sticker White Roll", "category": "Print Media", "unit": "roll", "stock_qty": 28, "reorder_level": 10, "unit_cost": 1850.0},
        {"code": "MS-PIPE", "name": "MS Square Pipe 20mm", "category": "Hardware", "unit": "mtr", "stock_qty": 420, "reorder_level": 150, "unit_cost": 78.0},
        {"code": "PAINT-AUTO", "name": "Automotive Paint Black", "category": "Paint", "unit": "ltr", "stock_qty": 14, "reorder_level": 20, "unit_cost": 680.0},
    ]
    for m in materials_seed:
        await db.materials.insert_one(Material(**m).model_dump())

    leads_seed = [
        {"name": "Rakesh Sharma", "company": "Sharma Hotels", "phone": "+91 98100 11122", "email": "rakesh@sharmahotels.in", "source": "Referral", "status": "qualified", "estimated_value": 250000},
        {"name": "Priya Iyer", "company": "BlueCart Retail", "phone": "+91 98404 99812", "email": "priya@bluecart.com", "source": "Website", "status": "contacted", "estimated_value": 540000},
        {"name": "Mohit Verma", "company": "Verma Industries", "phone": "+91 99711 23311", "email": "mohit@vermaindustries.com", "source": "Cold Call", "status": "new", "estimated_value": 180000},
        {"name": "Kavya Reddy", "company": "Reddy Foods", "phone": "+91 90099 11221", "email": "kavya@reddyfoods.in", "source": "Exhibition", "status": "won", "estimated_value": 720000},
    ]
    for ld in leads_seed:
        await db.leads.insert_one(Lead(**ld).model_dump())

    projects_seed = [
        {"name": "Sharma Hotels — Rooftop Signage", "client_name": "Sharma Hotels", "contract_value": 260000, "status": "in_production", "description": "Backlit ACP letters with halo lighting"},
        {"name": "BlueCart Storefront Branding", "client_name": "BlueCart Retail", "contract_value": 540000, "status": "installation", "description": "Front facade with acrylic 3D letters + LED"},
        {"name": "Reddy Foods Factory Board", "client_name": "Reddy Foods", "contract_value": 320000, "status": "completed", "description": "MS frame board with vinyl print"},
        {"name": "Verma Plant Wayfinding", "client_name": "Verma Industries", "contract_value": 180000, "status": "new", "description": "Internal wayfinding signage set of 24"},
        {"name": "Skyline Mall Pylon", "client_name": "Skyline Developers", "contract_value": 880000, "status": "completed", "description": "Double-sided pylon sign 18ft"},
    ]
    project_ids = []
    for idx, p in enumerate(projects_seed):
        count = idx
        prj = Project(project_no=f"PRJ-{2001 + count}", **p)
        await db.projects.insert_one(prj.model_dump())
        project_ids.append(prj.id)
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
    await seed_users()
    await seed_demo_data()


# ---------- Mount router ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
