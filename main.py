import logging
import os
import html
import time
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, field_validator
from starlette.middleware.base import BaseHTTPMiddleware

# Framework e Utilitários Web
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Segurança e Criptografia
from passlib.context import CryptContext
from jose import JWTError, jwt

# Banco de Dados (ORM)
from sqlalchemy.orm import Session
from database import get_db
from models import User

# Carrega as variáveis do arquivo .env
load_dotenv()

# --- CONFIGURAÇÕES DO AMBIENTE ---
ENVIRONMENT = os.getenv("ENVIRONMENT", "development") 
SHOW_DOCS = ENVIRONMENT == "development"

# --- CONFIGURAÇÕES DE SEGURANÇA ---
SECRET_KEY = os.getenv("SECRET_KEY", "chave_padrao_insegura_mude_em_producao")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# Configuração de Logs
logging.basicConfig(level=logging.INFO, filename="auditoria_acessos.log", format="%(asctime)s - %(message)s")

# Inicialização da App
app = FastAPI(
    title="Portal de Solicitações",
    docs_url="/docs" if SHOW_DOCS else None,
    redoc_url="/redoc" if SHOW_DOCS else None
)

# =================================================================
# MIDDLEWARE DE SEGURANÇA (HEADERS) - ADICIONE ISSO AQUI
# =================================================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # 1. Proteção contra Clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # 2. Proteção contra MIME Sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # 3. Força HTTPS (HSTS) - O navegador vai ignorar isso no localhost (http), 
        # mas é importante o header estar lá para quando for pra produção (https)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # 4. Esconde a tecnologia do servidor (Uvicorn)
        response.headers["Server"] = "Hidden" 
        
        return response

app.add_middleware(SecurityHeadersMiddleware)

# --- SCHEMAS (Modelos de Entrada) ---
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "solicitante" 

    # CORREÇÃO PYDANTIC V2: Usar @field_validator com @classmethod
    @field_validator('full_name', 'username')
    @classmethod
    def sanitize_input(cls, v: str) -> str:
        # Transforma <script> em &lt;script&gt;
        return html.escape(v)

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class UserPasswordUpdate(BaseModel):
    old_password: str
    new_password: str

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    disabled: bool
    
    class Config:
        from_attributes = True # Pydantic V2 usa from_attributes em vez de orm_mode

# --- ARQUIVOS ESTÁTICOS E TEMPLATES ---
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- UTILITÁRIOS DE SEGURANÇA ---
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- DEPENDÊNCIAS DE AUTENTICAÇÃO E AUTORIZAÇÃO ---

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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

def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        logging.warning(f"ACESSO NEGADO: Usuário {current_user.username} tentou acessar rota de admin.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Você não tem permissão de administrador."
        )
    return current_user

# --- ROTAS DE PÁGINAS (FRONTEND) ---

@app.get("/")
async def read_login(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/dashboard")
async def read_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/admin_panel")
async def read_admin_panel(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

# --- ROTAS DE API (AUTENTICAÇÃO) ---

@app.post("/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    # INICIO DO CONTROLE DE TEMPO (Timing Attack Prevention)
    start_time = time.time()
    
    user = db.query(User).filter(User.username == form_data.username).first()
    
    # Se falhar (usuário não existe OU senha errada)
    if not user or not verify_password(form_data.password, user.hashed_password):
        
        # FORÇA O SISTEMA A ESPERAR SE A RESPOSTA FOR RÁPIDA DEMAIS
        process_time = time.time() - start_time
        if process_time < 1.0:
            time.sleep(1.0 - process_time) # Dorme até completar 1 segundo
            
        logging.warning(f"LOGIN FALHO: Tentativa inválida para {form_data.username}")
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Usuário ou senha incorretos", 
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Se passar, segue normal...
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    logging.info(f"LOGIN SUCESSO: {user.username} ({user.role})")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/users/me/password")
async def change_password(
    password_data: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    
    current_user.hashed_password = pwd_context.hash(password_data.new_password)
    db.commit()
    logging.info(f"SENHA ALTERADA: Usuário {current_user.username}")
    return {"message": "Senha alterada com sucesso!"}

# --- ROTAS DE GESTÃO (PROTEGIDAS PARA ADMIN) ---

@app.post("/users/create")
async def create_user(
    user_data: UserCreate, 
    current_user: User = Depends(get_current_admin_user), 
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Nome de usuário indisponível.")

    hashed_password = pwd_context.hash(user_data.password)
    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    logging.info(f"ADMIN AÇÃO: {current_user.username} criou usuário {user_data.username}")
    return {"message": f"Usuário {user_data.username} criado com sucesso!"}

@app.get("/users", response_model=List[UserResponse])
async def read_all_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users

@app.put("/users/{user_id}")
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if user_update.full_name:
        db_user.full_name = user_update.full_name
    if user_update.role:
        db_user.role = user_update.role
    if user_update.password:
        db_user.hashed_password = pwd_context.hash(user_update.password)
    
    db.commit()
    logging.info(f"ADMIN AÇÃO: {current_user.username} atualizou {db_user.username}")
    return {"message": "Usuário atualizado com sucesso"}

# --- ROTA DE POWER BI (PROTEGIDA) ---

@app.get("/bi-config")
async def get_bi_config(
    current_user: User = Depends(get_current_user), # Verifica se tá logado
    db: Session = Depends(get_db)
):
    """
    Retorna a URL do Power BI apenas para usuários autorizados.
    Correção Vuln. #4 (Power BI Exposto)
    """
    # Lista de cargos permitidos
    allowed_roles = ["admin", "supervisor"]
    
    if current_user.role not in allowed_roles:
        logging.warning(f"ACESSO NEGADO BI: Usuário {current_user.username} tentou acessar o BI.")
        raise HTTPException(status_code=403, detail="Acesso não autorizado aos relatórios.")
    
    # Pega a URL do arquivo .env (Oculta do código fonte)
    embed_url = os.getenv("POWERBI_EMBED_URL")
    
    if not embed_url:
        raise HTTPException(status_code=500, detail="Configuração de BI ausente no servidor.")
        
    return {"embed_url": embed_url}

@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Você não pode deletar a si mesmo.")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    db.delete(db_user)
    db.commit()
    logging.info(f"ADMIN AÇÃO: {current_user.username} deletou {db_user.username}")
    return {"message": "Usuário deletado com sucesso"}