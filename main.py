import logging
from datetime import datetime, timedelta
from typing import Optional

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

# --- CONFIGURAÇÕES DE SEGURANÇA (NÍVEL STF) ---
# Em produção, isso deve vir de uma variável de ambiente (.env)
SECRET_KEY = "segredo_abv_federal_2026_change_this_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Configuração de Logs
logging.basicConfig(level=logging.INFO, filename="auditoria_acessos.log", format="%(asctime)s - %(message)s")

app = FastAPI(title="Portal ABV - STF Level")

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