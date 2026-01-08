import logging
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

# Framework e Utilitários Web
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse

# Segurança e Criptografia
from passlib.context import CryptContext
from jose import JWTError, jwt

# Banco de Dados (ORM)
from sqlalchemy.orm import Session
from database import get_db
from models import User

# Carrega as variáveis do arquivo .env
load_dotenv()

# --- CONFIGURAÇÕES DE SEGURANÇA ---
SECRET_KEY = os.getenv("SECRET_KEY", "chave_padrao_insegura")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# Configuração de Logs
logging.basicConfig(level=logging.INFO, filename="auditoria_acessos.log", format="%(asctime)s - %(message)s")

app = FastAPI(title="Portal ABV - STF Level")

# --- SCHEMAS (Modelos de Entrada) ---
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "user" # 'admin' ou 'user'

class UserPasswordUpdate(BaseModel):
    old_password: str
    new_password: str

# --- ARQUIVOS ESTÁTICOS E TEMPLATES ---
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- UTILITÁRIOS DE SEGURANÇA ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    """Verifica se a senha bate com o hash do banco."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Gera o Token JWT assinado."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Decodifica o token para identificar o usuário atual (Middleware)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# --- ROTAS DE PÁGINAS (FRONTEND) ---

@app.get("/")
async def read_login(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/dashboard")
async def read_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

# --- ROTAS DE API (BACKEND) ---

@app.post("/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """
    Recebe usuário e senha, valida no Banco de Dados SQLite
    e retorna o Token de acesso.
    """
    # Busca o usuário no banco
    user = db.query(User).filter(User.username == form_data.username).first()
    
    # Validações
    if not user:
        logging.warning(f"TENTATIVA FALHA (Usuário não existe): {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais incorretas",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(form_data.password, user.hashed_password):
        logging.warning(f"TENTATIVA FALHA (Senha incorreta): {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais incorretas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Sucesso
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    logging.info(f"LOGIN SUCESSO: {user.username} ({user.role})")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Rota para o Frontend verificar se o token ainda é válido."""
    return {"username": current_user.username, "full_name": current_user.full_name, "role": current_user.role}

# --- ROTAS DE GESTÃO DE USUÁRIOS ---

@app.post("/users/create")
async def create_user(
    user_data: UserCreate, 
    current_user: User = Depends(get_current_user), # Exige estar logado
    db: Session = Depends(get_db)
):
    """
    Cria novo usuário. Apenas ADMINS podem fazer isso.
    """
    # 1. Verifica Permissão
    if current_user.role != "admin":
        logging.warning(f"TENTATIVA NÃO AUTORIZADA: {current_user.username} tentou criar usuário.")
        raise HTTPException(status_code=403, detail="Apenas administradores podem criar usuários.")

    # 2. Verifica se usuário já existe
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Nome de usuário indisponível.")

    # 3. Cria o usuário
    hashed_password = pwd_context.hash(user_data.password)
    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    
    logging.info(f"USUÁRIO CRIADO: {user_data.username} criado por {current_user.username}")
    return {"message": f"Usuário {user_data.username} criado com sucesso!"}


@app.post("/users/me/password")
async def change_password(
    password_data: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Usuário logado troca a própria senha.
    """
    # 1. Verifica se a senha antiga está correta
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    
    # 2. Atualiza para a nova senha
    current_user.hashed_password = pwd_context.hash(password_data.new_password)
    db.commit()
    
    logging.info(f"SENHA ALTERADA: Usuário {current_user.username} alterou sua senha.")
    return {"message": "Senha alterada com sucesso!"}