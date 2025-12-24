import time
import asyncio
import random
from typing import List, Dict, Optional, Any
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
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
    # 🔴【核心修改】必须有这个，否则前端传来的明细会被丢弃
    extra: Optional[str] = None

class ConfigUpdate(BaseModel):
    webhook_url: str

# --- 3. 启动时的数据库自动维护 ---
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        # 1. 自动创建/重置管理员
        hashed = pwd_context.hash("admin888")
        user = db.query(models.User).filter(models.User.username == "admin").first()
        if not user:
            print(">>> [INIT] Creating admin user...")
            db.add(models.User(username="admin", hashed_password=hashed))
        else:
            user.hashed_password = hashed
        
        # 2. 【核心】自动检测并修复数据库字段
        with db_engine.connect() as conn:
            # 2.1 检查 assets 表是否有 extra 字段
            try:
                # 尝试查询 extra 字段，如果报错说明不存在
                conn.execute(text("SELECT extra FROM assets LIMIT 1"))
            except Exception:
                print(">>> [AUTO-FIX] Adding 'extra' column to assets table...")
                try:
                    conn.execute(text("ALTER TABLE assets ADD COLUMN extra VARCHAR"))
                    conn.commit()
                    print(">>> [AUTO-FIX] Success: 'extra' column added.")
                except Exception as e:
                    print(f">>> [AUTO-FIX] Failed adding extra: {e}")

            # 2.2 检查 asset_history 表的新字段
            try:
                conn.execute(text("SELECT stock_profit FROM asset_history LIMIT 1"))
            except Exception:
                print(">>> [AUTO-FIX] Upgrading asset_history table...")
                try:
                    conn.execute(text("ALTER TABLE asset_history ADD COLUMN total_principal FLOAT DEFAULT 0"))
                    conn.execute(text("ALTER TABLE asset_history ADD COLUMN stock_profit FLOAT DEFAULT 0"))
                    conn.execute(text("ALTER TABLE asset_history ADD COLUMN fund_profit FLOAT DEFAULT 0"))
                    conn.execute(text("ALTER TABLE asset_history ADD COLUMN fixed_profit FLOAT DEFAULT 0"))
                    conn.commit()
                except Exception as e:
                    print(f">>> [AUTO-FIX] History upgrade failed: {e}")

        db.commit()
    except Exception as e:
        print(f"Startup maintenance failed: {e}")
    finally:
        db.close()

# --- 4. 认证模块 ---
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

# --- 5. 资产管理接口 ---

@app.post("/api/assets")
def add_or_increase_asset(asset: AssetCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    # 先查重
    existing = db.query(models.Asset).filter(
        models.Asset.owner_id == user.id, 
        models.Asset.code == asset.code, 
        models.Asset.asset_type == asset.asset_type
    ).first()
    
    if existing:
        # 如果已存在，更新基础信息
        # 注意：理财通常 code 是唯一的（带时间戳），所以很少走这里
        old_val = existing.cost_price * existing.quantity
        new_val = asset.cost_price * asset.quantity
        new_qty = existing.quantity + asset.quantity
        
        if new_qty > 0:
            existing.cost_price = (old_val + new_val) / new_qty
            existing.quantity = new_qty
            existing.name = asset.name 
            # 如果是追加模式，这里可以选择是否覆盖 extra，目前逻辑是覆盖
            if asset.extra:
                existing.extra = asset.extra
        else:
            existing.quantity = 0
    else:
        # 新增资产：🔴 必须要把 extra 存进去
        new_asset = models.Asset(
            owner_id=user.id, asset_type=asset.asset_type, 
            name=asset.name, code=asset.code, 
            cost_price=asset.cost_price, quantity=asset.quantity, 
            tag=asset.tag, start_date=asset.start_date, apy=asset.apy,
            extra=asset.extra 
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
    if asset.apy is not None: target.apy = asset.apy
    
    # 🔴 更新逻辑：允许更新 extra 字段
    if asset.extra is not None: 
        target.extra = asset.extra
    
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
            "quantity": a.quantity, "start_date": a.start_date, 
            "apy": a.apy,
            # 🔴 读取逻辑：必须把 extra 返回给前端
            "extra": a.extra
        }
        if a.asset_type == 'stock': res["stocks"].append(data)
        elif a.asset_type == 'fund': res["funds"].append(data)
        elif a.asset_type == 'fixed': res["fixed_income"].append(data)
    return res

@app.delete("/api/assets/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    db.query(models.Asset).filter(
        models.Asset.owner_id == user.id, 
        models.Asset.id == asset_id
    ).delete()
    db.commit()
    return {"status": "deleted"}

# --- 6. 行情接口 ---

@app.get("/api/market/refresh")
async def refresh_market(source: str = "sina", db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    stocks = db.query(models.Asset).filter(models.Asset.owner_id == user.id, models.Asset.asset_type == "stock").all()
    funds = db.query(models.Asset).filter(models.Asset.owner_id == user.id, models.Asset.asset_type == "fund").all()
    return market_engine.get_real_time_data([s.code for s in stocks], [f.code for f in funds], source=source)

@app.get("/api/market/check")
def check_asset_code(code: str, type: str = 'stock'): 
    if not code: return {"valid": False}
    if type == 'stock':
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

# --- 7. 历史与配置 ---

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
    return [{
        "date": h.date.strftime("%Y-%m-%d"),
        "total": h.total_asset,        
        "profit": h.total_profit,      
        "total_asset": h.total_asset,  
        "total_profit": h.total_profit,
        "total_principal": getattr(h, 'total_principal', 0),
        "stock_profit": getattr(h, 'stock_profit', 0),
        "fund_profit": getattr(h, 'fund_profit', 0),
        "fixed_profit": getattr(h, 'fixed_profit', 0)
    } for h in history]

# --- 8. 核心任务：快照与推送 (满血复活版：精准分账 + 理财推送) ---

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
        
        # 初始化分账统计
        stock_val = 0.0
        stock_profit_day = 0.0
        stock_principal = 0.0

        fund_val = 0.0
        fund_profit_day = 0.0
        fund_principal = 0.0

        fixed_val = 0.0
        fixed_profit_day = 0.0
        fixed_principal = 0.0

        details_text = [] 

        # 2. 计算股票 (反推逻辑，对齐前端)
        if stocks: details_text.append("【股票/ETF】")
        for s in stocks:
            m = market['stocks'].get(s.code, {'price': s.cost_price, 'change': 0})
            price = m['price']
            qty = s.quantity
            change = m['change']
            
            mv = price * qty
            cost = s.cost_price * qty
            
            # 日盈亏 = 市值 * 涨幅 / (100+涨幅)
            day_p = 0
            if (100 + change) != 0:
                day_p = (mv * change) / (100 + change)
            
            stock_val += mv
            stock_principal += cost
            stock_profit_day += day_p
            
            if abs(change) > 0.1:
                icon = "📈" if change > 0 else "📉"
                details_text.append(f"{icon} {s.name}: {change}%")

        # 3. 计算基金 (估值)
        if funds: details_text.append("\n【场外基金】")
        for f in funds:
            m = market['funds'].get(f.code)
            if m:
                price = m.get('price', m.get('nav', f.cost_price))
                change = m.get('estimatedChange', m.get('change', 0)) 
                nav_date = m.get('navDate', '') 
            else:
                price = f.cost_price
                change = 0
                nav_date = ""

            qty = f.quantity
            mv = price * qty
            cost = f.cost_price * qty
            
            day_p = mv * (change / 100)
            
            fund_val += mv
            fund_principal += cost
            fund_profit_day += day_p
            
            if abs(change) > 0.1:
                icon = "📈" if change > 0 else "📉"
                d_str = f"({nav_date})" if nav_date else ""
                details_text.append(f"{icon} {f.name}: {change}% {d_str}")

        # 4. 计算固收 (按 APY 推算)
        fixed_items_text = []
        for x in fixed:
            principal = x.quantity
            # 优先用市值，没市值用本金
            current_mv = x.cost_price if x.cost_price > 0 else principal 
            
            # 修正：日收益 = 市值 * APY% / 365
            day_earn = (current_mv * (x.apy or 0) / 100) / 365
            
            fixed_val += current_mv
            fixed_principal += principal
            fixed_profit_day += day_earn
            
            # 收集理财明细 (只显示日赚大于 0.01 的)
            if day_earn > 0.01:
                fixed_items_text.append(f"💰 {x.name}: +{day_earn:.2f}")

        # 【新增】将理财明细加入日报
        if fixed_items_text:
            details_text.append("\n【理财固收】")
            details_text.extend(fixed_items_text)

        # 汇总
        total_asset = stock_val + fund_val + fixed_val
        total_profit_day = stock_profit_day + fund_profit_day + fixed_profit_day
        total_principal = stock_principal + fund_principal + fixed_principal

        # 5. 存入数据库快照
        today = date.today()
        existing = db.query(models.AssetHistory).filter(models.AssetHistory.owner_id==admin.id, models.AssetHistory.date==today).first()
        
        if not existing:
            db.add(models.AssetHistory(
                owner_id=admin.id, 
                date=today, 
                total_asset=total_asset, 
                total_profit=total_profit_day,
                total_principal=total_principal,
                stock_profit=stock_profit_day,
                fund_profit=fund_profit_day,
                fixed_profit=fixed_profit_day
            ))
        else:
            existing.total_asset = total_asset
            existing.total_profit = total_profit_day
            existing.total_principal = total_principal
            existing.stock_profit = stock_profit_day
            existing.fund_profit = fund_profit_day
            existing.fixed_profit = fixed_profit_day
            
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
            
            payload = { "msgtype": "text", "text": { "content": content } }
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