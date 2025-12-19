from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 修改前: SQLALCHEMY_DATABASE_URL = "sqlite:///./pacc_assets.db"
# 修改后：存到 data 文件夹下
SQLALCHEMY_DATABASE_URL = "sqlite:///./data/pacc_assets.db"

# check_same_thread=False 是 SQLite 在多线程环境下必须的配置
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()