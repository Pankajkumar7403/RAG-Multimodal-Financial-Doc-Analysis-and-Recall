# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — install runtime dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    libmagic1 \
    gcc \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt pyproject.toml ./

# CPU torch first so sentence-transformers does not pull a CUDA wheel.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir \
        "pydantic>=2.7.0" \
        "pydantic-settings>=2.3.0" \
        "structlog>=24.1.0" \
        "fastapi>=0.111.0" \
        "uvicorn[standard]>=0.30.0" \
        "httpx>=0.27.0" \
        "python-multipart>=0.0.9" \
        "typer[all]>=0.12.0" \
        "rich>=13.7.0" \
        "pypdf>=4.0.0" \
        "pdf2image>=1.17.0" \
        "Pillow>=10.3.0" \
        "openai>=1.30.0" \
        "anthropic>=0.25.0" \
        "numpy>=1.26.0" \
        "pandas>=2.2.0" \
        "tqdm>=4.66.0" \
        "deeplake>=4.0.0,<5" \
        "redis[hiredis]>=5.0.0" \
        "pyyaml>=6.0.1" \
        "psutil>=5.9.0" \
        "tiktoken>=0.7.0" \
        "prometheus-client>=0.20.0" \
        "opentelemetry-api>=1.24.0" \
        "opentelemetry-sdk>=1.24.0" \
        "opentelemetry-exporter-otlp-proto-grpc>=1.24.0" \
        "opentelemetry-instrumentation-fastapi>=0.45b0" \
        "sentence-transformers>=3.0.0" \
        "unstructured>=0.14.0" \
        "python-magic>=0.4.27"


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime — minimal, non-root
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

RUN groupadd --gid 1001 raguser && \
    useradd --uid 1001 --gid raguser --shell /bin/bash --create-home raguser

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY --chown=raguser:raguser src/ ./src/
COPY --chown=raguser:raguser evals/ ./evals/
COPY --chown=raguser:raguser pyproject.toml ./

RUN mkdir -p /app/data/vectorstore /app/audit_logs /app/logs /home/raguser/.cache/huggingface && \
    chown -R raguser:raguser /app/data /app/audit_logs /app/logs /home/raguser/.cache

USER raguser

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

EXPOSE 8000 8001

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=development \
    HF_HOME=/home/raguser/.cache/huggingface

CMD ["uvicorn", "src.rag_system.api.app:create_app", \
     "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
