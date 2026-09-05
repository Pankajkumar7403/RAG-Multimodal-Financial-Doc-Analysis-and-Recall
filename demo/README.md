# Streamlit Demo UI

Local web UI for the RAG Financial Multimodal pipeline. No FastAPI or Next.js required.

## Prerequisites

1. Activate the project virtualenv and install demo deps:

```bash
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r demo/requirements.txt
```

2. Ensure the repo-root `.env` has your LLM credentials (Groq / Gemini / OpenAI).

## Run

```bash
streamlit run demo/app.py
```

Opens at http://localhost:8501

## What it does

- Loads `.env` automatically (provider, API keys, embedding model)
- Uses an **in-memory** vector store + cache so Docker Redis is not required
- Upload PDFs → ingest → ask questions with citations, latency, and cost metrics

## Tips

- Keep **Top-K ≤ 4–5** on Groq free/dev tiers to avoid payload-too-large errors
- Vision/chart extraction needs `GOOGLE_API_KEY` when using Gemini vision
- Ingested docs live only for this Streamlit session (memory store)

## Optional: persistent DeepLake store

```bash
# Override before launch if you want disk persistence instead of memory
$env:VECTOR_STORE_CONFIG__PROVIDER="deeplake"
$env:VECTOR_STORE_CONFIG__DATASET_PATH="./data/vectorstore/demo"
streamlit run demo/app.py
```

(Edit `demo/app.py` `_load_env()` if you want DeepLake as the default.)
