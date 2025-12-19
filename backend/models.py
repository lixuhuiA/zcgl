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
    # 新增关联
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

# 【新增】历史资产快照表
class AssetHistory(Base):
    __tablename__ = "asset_history"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, index=True)       # 记录日期 2023-12-01
    total_asset = Column(Float)           # 当日总资产
    total_profit = Column(Float)          # 当日总盈利
    owner = relationship("User", back_populates="history")