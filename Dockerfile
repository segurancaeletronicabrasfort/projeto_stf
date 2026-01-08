# 1. Escolhemos uma imagem base leve e estável (Python 3.11 Slim)
FROM python:3.11-slim

# 2. Definimos variáveis de ambiente para o Python não gerar cache (.pyc)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Criamos a pasta de trabalho dentro do container
WORKDIR /app

# 4. Instalamos dependências do sistema operacional (necessário para compilar algumas libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 5. Copiamos APENAS o requirements.txt primeiro (para aproveitar o cache do Docker)
COPY requirements.txt .

# 6. Instalamos as bibliotecas Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 7. Agora sim, copiamos todo o resto do seu código para dentro
COPY . .

# 8. Expomos a porta 8000 (onde o Uvicorn roda)
EXPOSE 8000

# 9. Comando para rodar o servidor quando o container ligar
CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]