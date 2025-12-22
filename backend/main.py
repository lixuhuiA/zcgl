import time
import asyncio
import random
from typing import List, Dict, Optional, Any
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
import re
import json
import models
from database import engine as db_engine, SessionLocal
from market_engine import MarketEngine

# --- 1. 初始化配置 ---
models.Base.metadata.create_all(bind=db_engine)
app = FastAPI(title="PACC Backend - Ultimate Edition")
market_engine = MarketEngine()

# 允许跨域
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

# --- 2. 数据模型 ---
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

# --- 3. 认证模块 ---
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == "admin").first()
    if not user: raise HTTPException(status_code=401, detail="Invalid auth")
    return user

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    return {"access_token": user.username, "token_type": "bearer"}

# [启动] 强制重置密码逻辑
@app.on_event("startup")
def create_default_user():
    db = SessionLocal()
    try:
        hashed = pwd_context.hash("admin888")
        user = db.query(models.User).filter(models.User.username == "admin").first()
        
        if not user:
            print(">>> [INIT] Creating admin user...")
            db.add(models.User(username="admin", hashed_password=hashed))
        else:
            print(">>> [INIT] Resetting admin password to admin888...")
            user.hashed_password = hashed
            
        db.commit()
    except Exception as e:
        print(f"初始化用户失败: {e}")
    finally:
        db.close()

# --- 4. 资产管理接口 ---

@app.post("/api/assets")
def add_or_increase_asset(asset: AssetCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    existing = db.query(models.Asset).filter(
        models.Asset.owner_id == user.id, 
        models.Asset.code == asset.code, 
        models.Asset.asset_type == asset.asset_type
    ).first()
    
    if existing:
        old_val = existing.cost_price * existing.quantity
        new_val = asset.cost_price * asset.quantity
        new_qty = existing.quantity + asset.quantity
        
        if new_qty > 0:
            existing.cost_price = (old_val + new_val) / new_qty
            existing.quantity = new_qty
            existing.name = asset.name 
        else:
            existing.quantity = 0
    else:
        new_asset = models.Asset(
            owner_id=user.id, asset_type=asset.asset_type, 
            name=asset.name, code=asset.code, 
            cost_price=asset.cost_price, quantity=asset.quantity, 
            tag=asset.tag, start_date=asset.start_date, apy=asset.apy
        )
        db.add(new_asset)
    
    db.commit()
    return {"status": "ok", "msg": "Asset updated"}

@app.put("/api/assets/{code}")
def update_asset_directly(code: str, asset: AssetCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    target = db.query(models.Asset).filter(
        models.Asset.owner_id == user.id, 
        models.Asset.code == code, 
        models.Asset.asset_type == asset.asset_type
    ).first()
    
    if not target: raise HTTPException(status_code=404, detail="Asset not found")
    
    target.cost_price = asset.cost_price
    target.quantity = asset.quantity
    target.name = asset.name
    target.tag = asset.tag
    if asset.start_date: target.start_date = asset.start_date
    if asset.apy: target.apy = asset.apy
    
    db.commit()
    return {"status": "updated"}

@app.get("/api/assets")
def read_assets(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    assets = db.query(models.Asset).filter(models.Asset.owner_id == user.id).all()
    res = {"stocks": [], "funds": [], "fixed_income": []}
    for a in assets:
        data = { 
            "id": a.id, "name": a.name, "code": a.code, 
            "tag": a.tag, "cost_price": a.cost_price, 
            "quantity": a.quantity, "start_date": a.start_date, "apy": a.apy 
        }
        if a.asset_type == 'stock': res["stocks"].append(data)
        elif a.asset_type == 'fund': res["funds"].append(data)
        elif a.asset_type == 'fixed': res["fixed_income"].append(data)
    return res

# ⚠️ 修复后的删除逻辑：只校验 owner_id 和 code
@app.delete("/api/assets/{code}")
# 找到原来的 delete_asset 函数，删掉，换成这个：
@app.delete("/api/assets/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    # 按照 ID 精准打击，绝对不会删错
    db.query(models.Asset).filter(
        models.Asset.owner_id == user.id, 
        models.Asset.id == asset_id
    ).delete()
    db.commit()
    return {"status": "deleted"}

# --- 5. 行情接口 ---

@app.get("/api/market/refresh")
async def refresh_market(source: str = "sina", db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    stocks = db.query(models.Asset).filter(models.Asset.owner_id == user.id, models.Asset.asset_type == "stock").all()
    funds = db.query(models.Asset).filter(models.Asset.owner_id == user.id, models.Asset.asset_type == "fund").all()
    # 调用 MarketEngine (已修复前缀问题)
    return market_engine.get_real_time_data([s.code for s in stocks], [f.code for f in funds], source=source)

@app.get("/api/market/check")
def check_asset_code(code: str, type: str = 'stock'): 
    if not code: return {"valid": False}
    
    if type == 'stock':
        # 简单的回显逻辑
        prefix = "sh" if code.startswith(('5','6','9')) else "sz" if code.startswith(('0','1','3')) else "bj"
        full_code = f"{prefix}{code}"
        try:
            url = f"http://hq.sinajs.cn/list={full_code}"
            headers = {"Referer": "https://finance.sina.com.cn/"}
            resp = requests.get(url, headers=headers, timeout=3)
            if '="' in resp.text:
                content = resp.text.split('="')[1]
                if len(content) > 10:
                    data = content.split(',')
                    price = float(data[3])
                    if price == 0: price = float(data[2])
                    return {"valid": True, "name": data[0], "price": price}
        except: pass
    elif type == 'fund':
        try:
            ts = int(time.time()*1000)
            url = f"http://fundgz.1234567.com.cn/js/{code}.js?rt={ts}"
            resp = requests.get(url, timeout=3)
            match = re.search(r'jsonpgz\((.*?)\);', resp.text)
            if match:
                data = json.loads(match.group(1))
                return {"valid": True, "name": data.get('name'), "price": float(data.get('dwjz',0))}
        except: pass
             
    return {"valid": False}

# --- 6. 历史与配置 ---

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
    return [{"date": h.date.strftime("%m-%d"), "total": h.total_asset, "profit": h.total_profit} for h in history]

# --- 7. 核心任务：快照与推送 (满血复活版) ---

async def perform_push_and_snapshot():
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin: return

        stocks = db.query(models.Asset).filter(models.Asset.owner_id == admin.id, models.Asset.asset_type == "stock").all()
        funds = db.query(models.Asset).filter(models.Asset.owner_id == admin.id, models.Asset.asset_type == "fund").all()
        fixed = db.query(models.Asset).filter(models.Asset.owner_id == admin.id, models.Asset.asset_type == "fixed").all()
        
        # 1. 抓取行情
        market = market_engine.get_real_time_data([s.code for s in stocks], [f.code for f in funds])
        
        total_asset = 0.0
        total_profit_day = 0.0
        details_text = [] # 用于构建详细消息

        # 2. 计算股票
        if stocks: details_text.append("【股票/ETF】")
        for s in stocks:
            m = market['stocks'].get(s.code, {'price': s.cost_price, 'change': 0})
            price = m['price']
            val = price * s.quantity
            day_p = val * (m['change'] / 100)
            
            total_asset += val
            total_profit_day += day_p
            
            # 只有变动超过 0.1% 才显示，避免刷屏
            if abs(m['change']) > 0.1:
                icon = "📈" if m['change'] > 0 else "📉"
                details_text.append(f"{icon} {s.name}: {m['change']}%")

        # 3. 计算基金
        if funds: details_text.append("\n【场外基金】")
        for f in funds:
            m = market['funds'].get(f.code)
            if m:
                price = m.get('price', m.get('nav', f.cost_price))
                change = m.get('change', 0)
                nav_date = m.get('navDate', '') 
            else:
                price = f.cost_price
                change = 0
                nav_date = ""

            val = price * f.quantity
            day_p = val * (change / 100)
            
            total_asset += val
            total_profit_day += day_p
            
            if abs(change) > 0.1:
                icon = "📈" if change > 0 else "📉"
                d_str = f"({nav_date})" if nav_date else ""
                details_text.append(f"{icon} {f.name}: {change}% {d_str}")

        # 4. 计算固收
        for x in fixed:
            val = x.quantity
            day_earn = (val * (x.apy or 0) / 100) / 365
            total_asset += val
            total_profit_day += day_earn

        # 5. 存入数据库快照
        today = date.today()
        existing = db.query(models.AssetHistory).filter(models.AssetHistory.owner_id==admin.id, models.AssetHistory.date==today).first()
        if not existing:
            db.add(models.AssetHistory(owner_id=admin.id, date=today, total_asset=total_asset, total_profit=total_profit_day))
        else:
            existing.total_asset = total_asset
            existing.total_profit = total_profit_day
        db.commit()

        # 6. 发送 Webhook
        webhook_cfg = db.query(models.SystemConfig).filter(models.SystemConfig.key == "webhook_url").first()
        if webhook_cfg and webhook_cfg.value and webhook_cfg.value.startswith("http"):
            
            sign = "+" if total_profit_day >= 0 else ""
            content = (
                f"📅 资产日报 {today.strftime('%Y-%m-%d')}\n"
                f"----------------\n"
                f"💰 总资产: ¥{total_asset:,.2f}\n"
                f"📊 今日盈亏: {sign}¥{total_profit_day:,.2f}\n"
                f"----------------\n"
                + "\n".join(details_text)
            )
            
            payload = {
                "msgtype": "text",
                "text": { "content": content }
            }
            try:
                requests.post(webhook_cfg.value, json=payload, timeout=5)
                print("Webhook push success")
            except Exception as e:
                print(f"Webhook push failed: {e}")

    except Exception as e:
        print(f"Task error: {e}")
    finally:
        db.close()

@app.post("/api/push/test")
async def manual_push():
    await perform_push_and_snapshot()
    return {"status": "ok"}

# 定时任务
scheduler = BackgroundScheduler()
scheduler.add_job(lambda: asyncio.run(perform_push_and_snapshot()), 'cron', hour=15, minute=5)
scheduler.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)