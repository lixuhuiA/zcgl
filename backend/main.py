import time
import asyncio
import random
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from apscheduler.schedulers.background import BackgroundScheduler
from pydantic import BaseModel
from datetime import timedelta, datetime, date
import httpx
import requests 
import models
from database import engine as db_engine, SessionLocal
from market_engine import MarketEngine

# --- 1. 初始化 ---
models.Base.metadata.create_all(bind=db_engine)
app = FastAPI(title="PACC Backend - Professional Edition")
market_engine = MarketEngine()

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- 2. 数据传输模型 ---
class AssetCreate(BaseModel):
    asset_type: str  # stock, fund, fixed
    name: str
    code: str
    cost_price: float = 0
    quantity: float = 0
    tag: str = "稳健"
    start_date: Optional[str] = None
    apy: Optional[float] = None

class ConfigUpdate(BaseModel):
    webhook_url: str

# --- 3. 认证逻辑 ---
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # 演示版简化：锁定 admin 用户
    user = db.query(models.User).filter(models.User.username == "admin").first()
    if not user: raise HTTPException(status_code=401, detail="Invalid auth")
    return user

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    return {"access_token": user.username, "token_type": "bearer"}

@app.on_event("startup")
def create_default_user():
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.username == "admin").first()
    if not user:
        hashed = pwd_context.hash("admin888")
        db.add(models.User(username="admin", hashed_password=hashed))
        db.commit()
    db.close()

# --- 4. 资产管理核心逻辑 (增、删、改、查) ---

# A. 【加仓/新增】POST 接口：执行加权平均逻辑
@app.post("/api/assets")
def add_or_increase_asset(asset: AssetCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    existing = db.query(models.Asset).filter(
        models.Asset.owner_id == user.id, 
        models.Asset.code == asset.code, 
        models.Asset.asset_type == asset.asset_type
    ).first()
    
    if existing:
        # 计算加权平均成本
        # 新成本 = (旧持仓量 * 旧单价 + 新买入量 * 新单价) / 总量
        old_total_cost = existing.cost_price * existing.quantity
        new_buy_cost = asset.cost_price * asset.quantity
        new_total_quantity = existing.quantity + asset.quantity
        
        if new_total_quantity > 0:
            existing.cost_price = (old_total_cost + new_buy_cost) / new_total_quantity
            existing.quantity = new_total_quantity
            existing.name = asset.name # 同步更新名字
        else:
            existing.quantity = 0 # 防止出现负数
    else:
        # 第一次买入，直接创建
        new_asset = models.Asset(
            owner_id=user.id, asset_type=asset.asset_type, 
            name=asset.name, code=asset.code, 
            cost_price=asset.cost_price, quantity=asset.quantity, 
            tag=asset.tag, start_date=asset.start_date, apy=asset.apy
        )
        db.add(new_asset)
    
    db.commit()
    return {"status": "ok", "msg": "加仓/创建成功"}

# B. 【修正/编辑】PUT 接口：直接覆盖数据
@app.put("/api/assets/{code}")
def update_asset_directly(code: str, asset: AssetCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    target = db.query(models.Asset).filter(
        models.Asset.owner_id == user.id, 
        models.Asset.code == code, 
        models.Asset.asset_type == asset.asset_type
    ).first()
    
    if not target:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 直接覆盖模式
    target.cost_price = asset.cost_price
    target.quantity = asset.quantity
    target.name = asset.name
    target.tag = asset.tag
    if asset.start_date: target.start_date = asset.start_date
    if asset.apy: target.apy = asset.apy
    
    db.commit()
    return {"status": "updated", "msg": "成本已手动修正"}

# C. 【获取列表】
@app.get("/api/assets")
def read_assets(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    assets = db.query(models.Asset).filter(models.Asset.owner_id == user.id).all()
    res = {"stocks": [], "funds": [], "fixed_income": []}
    for a in assets:
        data = { "id": a.id, "name": a.name, "code": a.code, "tag": a.tag, "costPrice": a.cost_price, "quantity": a.quantity, "startDate": a.start_date, "apy": a.apy }
        if a.asset_type == 'stock': res["stocks"].append(data)
        elif a.asset_type == 'fund': res["funds"].append(data)
        elif a.asset_type == 'fixed': res["fixed_income"].append(data)
    return res

# D. 【删除】
@app.delete("/api/assets/{code}")
def delete_asset(code: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    db.query(models.Asset).filter(models.Asset.owner_id == user.id, models.Asset.code == code).delete()
    db.commit()
    return {"status": "deleted"}

# --- 5. 实时行情聚合查询 ---
@app.get("/api/market/refresh")
async def refresh_market(source: str = "sina", db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    stocks = db.query(models.Asset).filter(models.Asset.owner_id == user.id, models.Asset.asset_type == "stock").all()
    funds = db.query(models.Asset).filter(models.Asset.owner_id == user.id, models.Asset.asset_type == "fund").all()
    return market_engine.get_real_time_data([s.code for s in stocks], [f.code for f in funds], source=source)

# --- 6. 【重头戏】智能录入校验 (彻底解决基金查不到) ---
@app.get("/api/market/check")
def check_asset_code(code: str, type: str = 'stock'): 
    if not code: return {"valid": False}
    
    if type == 'stock':
        # 股票/ETF 逻辑 (修正前缀判断)
        if code.startswith(('5', '6', '9')): full_code = f"sh{code}"
        elif code.startswith(('0', '1', '3')): full_code = f"sz{code}"
        elif code.startswith(('4', '8')): full_code = f"bj{code}"
        else: full_code = f"sh{code}"
        
        try:
            url = f"http://hq.sinajs.cn/list={full_code}"
            headers = {"Referer": "https://finance.sina.com.cn/"}
            resp = requests.get(url, headers=headers, timeout=3)
            if '="' in resp.text:
                content = resp.text.split('="')[1]
                if len(content) > 10:
                    data = content.split(',')
                    price = float(data[3]) if float(data[3]) > 0 else float(data[2])
                    return {"valid": True, "name": data[0], "price": price}
        except: pass

    elif type == 'fund':
        # 基金逻辑：增加腾讯源对场外基金(005827)的支持
        # 探测1: 腾讯财经接口 (最强场外源)
        try:
            t_url = f"http://qt.gtimg.cn/q=jj{code}"
            resp = requests.get(t_url, timeout=3)
            if '="' in resp.text and len(resp.text) > 20:
                # 腾讯返回: v_jj005827="005827~易方达蓝筹~1.51~..."
                parts = resp.text.split('="')[1].split('~')
                if len(parts) > 2:
                    return {"valid": True, "name": parts[1], "price": float(parts[2])}
        except: pass
        
        # 探测2: 新浪基金接口 (保底)
        try:
            s_url = f"http://hq.sinajs.cn/list=f_{code}"
            resp = requests.get(s_url, timeout=3)
            if '="' in resp.text:
                content = resp.text.split('="')[1]
                if len(content) > 5:
                    data = content.split(',')
                    return {"valid": True, "name": data[0], "price": float(data[1])}
        except: pass
             
    return {"valid": False}

# --- 7. 推送与历史快照 ---
@app.post("/api/config/webhook")
def set_webhook(config: ConfigUpdate, db: Session = Depends(get_db)):
    item = db.query(models.SystemConfig).filter(models.SystemConfig.key == "webhook_url").first()
    if not item:
        item = models.SystemConfig(key="webhook_url", value=config.webhook_url)
        db.add(item)
    else:
        item.value = config.webhook_url
    db.commit()
    return {"status": "saved"}

@app.get("/api/history")
def get_history(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    history = db.query(models.AssetHistory).filter(models.AssetHistory.owner_id == user.id).order_by(models.AssetHistory.date).all()
    if history:
         return [{"date": h.date.strftime("%Y-%m-%d"), "total": h.total_asset, "profit": h.total_profit} for h in history]
    # 模拟数据略...
    return []

async def perform_push_and_snapshot():
    # 这里复用之前的计算总资产逻辑，并存入 AssetHistory
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin: return
        stocks = db.query(models.Asset).filter(models.Asset.owner_id == admin.id, models.Asset.asset_type == "stock").all()
        funds = db.query(models.Asset).filter(models.Asset.owner_id == admin.id, models.Asset.asset_type == "fund").all()
        fixed = db.query(models.Asset).filter(models.Asset.owner_id == admin.id, models.Asset.asset_type == "fixed").all()
        market = market_engine.get_real_time_data([s.code for s in stocks], [f.code for f in funds])
        
        total = 0; day_profit = 0
        for s in stocks:
            m = market['stocks'].get(s.code, {'price': s.cost_price, 'change': 0})
            total += m['price'] * s.quantity
            day_profit += (m['price'] * s.quantity) * (m['change']/100)
        for f in funds:
            m = market['funds'].get(f.code, {'nav': f.cost_price, 'change': 0})
            total += m['nav'] * f.quantity
            day_profit += (m['nav'] * f.quantity) * (m['change']/100)
        for x in fixed: total += x.quantity; day_profit += (x.quantity * (x.apy or 0)/100)/365

        today = date.today()
        # 存快照
        if not db.query(models.AssetHistory).filter(models.AssetHistory.owner_id==admin.id, models.AssetHistory.date==today).first():
            db.add(models.AssetHistory(owner_id=admin.id, date=today, total_asset=total, total_profit=day_profit))
            db.commit()
    finally: db.close()

@app.post("/api/push/test")
async def manual_push():
    await perform_push_and_snapshot()
    return {"status": "pushed"}

scheduler = BackgroundScheduler()
scheduler.add_job(lambda: asyncio.run(perform_push_and_snapshot()), 'cron', hour=15, minute=5)
scheduler.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)