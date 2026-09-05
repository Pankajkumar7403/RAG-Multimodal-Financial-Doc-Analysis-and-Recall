# Railway deploy (Streamlit RAG demo)

This uses the slim Streamlit package in `hf_space/`.

## One-time setup

```powershell
# From repo root
npm i -g @railway/cli
railway login
```

## Deploy

```powershell
cd hf_space
railway init          # create / link a project
railway up            # build + deploy from this folder

# Required secrets (never commit)
railway variables set LLM_CONFIG__PROVIDER=grok
railway variables set LLM_CONFIG__MODEL=openai/gpt-oss-120b
railway variables set LOCAL_VLLM_GENERATOR_BASE_URL=https://api.groq.com/openai/v1
railway variables set GROQ_API_KEY=YOUR_GROQ_KEY
# optional vision:
# railway variables set GOOGLE_API_KEY=YOUR_GOOGLE_KEY

railway domain        # attach a public *.up.railway.app URL
```

Open the printed URL. First boot downloads the embedding model (~1–3 min).
