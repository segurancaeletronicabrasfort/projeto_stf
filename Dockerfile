# 1. Imagem base (Mantemos a slim que é boa)
FROM python:3.11-slim

# 2. Variáveis de ambiente
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. SEGURANÇA: Criação de um usuário não-root
# Criamos um grupo e um usuário de sistema sem senha
RUN addgroup --system appgroup && adduser --system --group appuser

# 4. Define pasta de trabalho
WORKDIR /app

# 5. Instalação de dependências do SO e Limpeza
# DICA: Instalamos build-essential, usamos e removemos na mesma camada para economizar espaço e segurança
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 6. Dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 7. Copia o código da aplicação
COPY . .

# 8. PERMISSÕES: Passa a posse da pasta /app para o usuário criado
# Sem isso, o appuser não conseguiria ler/escrever arquivos se precisasse
RUN chown -R appuser:appgroup /app

# 9. TROCA DE USUÁRIO (O Pulo do Gato)
# A partir desta linha, nada roda como root.
USER appuser

# 10. Expõe a porta
EXPOSE 8000

# 11. Comando de inicialização
CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]