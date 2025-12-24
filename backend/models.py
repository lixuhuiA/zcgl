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
    
    # 【新增】万能扩展字段，用于存储买入明细的 JSON 字符串
    extra = Column(String, nullable=True)      
    
    owner = relationship("User", back_populates="assets")

class SystemConfig(Base):
    __tablename__ = "system_config"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)

# 你的 AssetHistory 保持现状即可，它是完美的
class AssetHistory(Base):
    __tablename__ = "asset_history"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, index=True)
    
    # --- 旧字段 ---
    total_asset = Column(Float)           # 总资产 (市值)
    total_profit = Column(Float)          # 当日总盈亏 (合计)
    
    # --- 新字段 ---
    total_principal = Column(Float, default=0) # 总本金
    stock_profit = Column(Float, default=0)    # 股票当日盈亏
    fund_profit = Column(Float, default=0)     # 基金当日盈亏
    fixed_profit = Column(Float, default=0)    # 理财当日收益
    
    owner = relationship("User", back_populates="history")