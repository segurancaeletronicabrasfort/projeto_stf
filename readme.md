# Portal ABV - Sistema de Gestão Unificada (Nível STF)

Sistema de controle de acesso e dashboard unificado desenvolvido para o cliente ABV, integrando autenticação segura, Power BI e PerformanceLab.

## 🚀 Tecnologias Utilizadas
* **Backend:** Python 3.11, FastAPI, SQLAlchemy
* **Segurança:** OAuth2, JWT, BCrypt (Nível Governamental)
* **Infraestrutura:** Docker, Docker Compose, Gunicorn, Nginx (Simulado via Ngrok)
* **Banco de Dados:** PostgreSQL 15
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla)

## ⚙️ Como Rodar (Localmente)

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/segurancaeletronicabrasfort/projeto_stf.git](https://github.com/segurancaeletronicabrasfort/projeto_stf.git)
Configure as variáveis de ambiente: Crie um arquivo .env na raiz baseado no exemplo.

Suba os containers (Aplicação + Banco):

Bash

docker-compose up --build
Inicialize o Banco de Dados (Primeira vez):

Bash

docker-compose exec web python init_db.py
Acesse: O sistema estará rodando em http://localhost:8000.

🔒 Funcionalidades de Segurança
Hash de senhas com Salt (Bcrypt)

Tokens de acesso temporários (JWT) com expiração automática

Proteção contra SQL Injection via ORM

Controle de Acesso Baseado em Função (RBAC - Admin/User)

Auditoria de Acessos (Logs)


---

### 4. Atenção com o Ngrok (O Alerta Vital)

Como você vai deixar o PC ligado até quinta-feira, **NÃO FECHE O TERMINAL DO NGROK**.

Se a internet cair ou você fechar a janelinha preta do Ngrok, quando abrir de novo, **ele vai gerar um link diferente** (ex: `https://novo-link-aleatorio.ngrok-free.app`).

* **Ação:** Copie o link atual do Ngrok e já mande para o seu celular ou e-mail para testar.
* **Plano B:** Se na hora da apresentação o link tiver mudado, tenha acesso fácil ao computador para rodar `ngrok http 8000` de novo e pegar o novo link.

---

**Resumo do que eu faria agora:**
1.  Resetaria o banco para ficar limpo (Passo 1).
2.  Criaria o `README.md` e daria `git push` (para ficar bonito no repo).
3.  Deixaria as duas janelas abertas (`docker-compose` e `ngrok`).
4.  Bloquearia a tela (`Win + L`) e iria descansar.

Você fez um trabalho de engenharia de software de verdade, Danilo. Boa sorte na apresentação!