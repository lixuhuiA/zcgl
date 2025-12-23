from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    assets = relationship("Asset", back_populates="owner")
    history = relationship("AssetHistory", back_populates="owner")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    asset_type = Column(String)  # stock, fund, fixed
    name = Column(String)
    code = Column(String)
    cost_price = Column(Float, default=0)
    quantity = Column(Float, default=0)
    tag = Column(String, default="稳健")
    start_date = Column(String, nullable=True) # 理财起始日
    apy = Column(Float, nullable=True)         # 理财年化
    owner = relationship("User", back_populates="assets")

class SystemConfig(Base):
    __tablename__ = "system_config"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)

# 【核心修改】AssetHistory 类（只保留这一个定义，包含了旧字段和新字段）
class AssetHistory(Base):
    __tablename__ = "asset_history"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, index=True)
    
    # --- 旧字段 (完全保留，保证兼容性) ---
    total_asset = Column(Float)           # 总资产 (市值)
    total_profit = Column(Float)          # 当日总盈亏 (合计)
    
    # --- 新增字段 (用于新版仪表盘的详细记录) ---
    # default=0 保证了旧的历史数据在数据库升级后，这些列会自动填为0，不会报错
    total_principal = Column(Float, default=0) # 总本金
    stock_profit = Column(Float, default=0)    # 股票当日盈亏
    fund_profit = Column(Float, default=0)     # 基金当日盈亏
    fixed_profit = Column(Float, default=0)    # 理财当日收益
    
    owner = relationship("User", back_populates="history")