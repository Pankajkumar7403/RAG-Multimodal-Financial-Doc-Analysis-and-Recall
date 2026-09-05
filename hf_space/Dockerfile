# Hugging Face Spaces — Streamlit Docker image
FROM python:3.11-slim

WORKDIR /home/user/app

# System deps for PDF + sentence-transformers / torch CPU wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Force CPU torch before the rest so sentence-transformers does not pull CUDA.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/home/user/app
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/home/user/.cache/huggingface

# Railway sets PORT; Hugging Face Spaces use 7860.
ENV PORT=7860
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD curl --fail "http://localhost:${PORT}/_stcore/health" || exit 1

# Use shell form so ${PORT} expands at runtime (Railway injects PORT).
CMD streamlit run app.py \
    --server.port=${PORT:-7860} \
    --server.address=0.0.0.0 \
    --server.headless=true \
    --browser.gatherUsageStats=false
