from database import engine, SessionLocal
from models import Base, User
from passlib.context import CryptContext

# Cria as tabelas no arquivo .db
Base.metadata.create_all(bind=engine)

# Configuração de Hash
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    db = SessionLocal()
    
    # Verifica se já existe o usuário
    user = db.query(User).filter(User.username == "danilo.vinicius").first()
    if not user:
        print("Criando usuário admin...")
        hashed_password = pwd_context.hash("Braseg26")
        
        db_user = User(
            username="Brasfort",
            full_name="Segurança Eletrônica",
            email="segurancaeletronicabrasfort@gmail.com.br",
            hashed_password=hashed_password,
            role="admin",
            disabled=False
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        print("Usuário criado com sucesso!")
    else:
        print("Usuário já existe.")
    
    db.close()

if __name__ == "__main__":
    init_db()