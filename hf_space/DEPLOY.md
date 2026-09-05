# Deploy to Hugging Face Spaces

This folder is a self-contained **Docker + Streamlit** Space for the RAG demo.

## Blocker (free accounts)

As of 2026, Hugging Face requires **[PRO](https://huggingface.co/pro)** to host Gradio/Docker Spaces (even on free `cpu-basic`). Static Spaces remain free, but cannot run this Python app.

## After you enable PRO

From the **repo root**:

```powershell
.\.venv\Scripts\Activate.ps1

# 1) Create the Space
hf repos create pankaj74/rag-financial-multimodal --type space --space-sdk docker --public --exist-ok

# 2) Add secrets (do not commit these)
hf spaces secrets add pankaj74/rag-financial-multimodal --secrets-file .env.hf.secrets

# 3) Upload this folder
hf upload pankaj74/rag-financial-multimodal ./hf_space --repo-type space
```

Create `.env.hf.secrets` (gitignored) with:

```env
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=...   # optional, for vision
```

Space URL: https://huggingface.co/spaces/pankaj74/rag-financial-multimodal

First build downloads `BAAI/bge-small-en-v1.5` — allow several minutes.
