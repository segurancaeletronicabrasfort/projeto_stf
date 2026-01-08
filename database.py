import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Pega a URL do .env. Se não tiver, usa o SQLite padrão
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./portal_abv.db")

# Lógica para saber se é SQLite (precisa do check_same_thread) ou PostgreSQL (não precisa)
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()