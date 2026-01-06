from sqlalchemy import Column, Integer, String, Boolean
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True) # Nome de usuário único
    full_name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String) # A senha criptografada
    role = Column(String, default="user") # admin ou user
    disabled = Column(Boolean, default=False)