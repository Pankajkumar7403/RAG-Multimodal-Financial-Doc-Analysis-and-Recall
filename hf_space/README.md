---
title: RAG Financial Multimodal
emoji: 🏦
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Multimodal RAG demo for financial PDF Q&A
startup_duration_timeout: 1h
---

# RAG Financial Multimodal

Upload a financial PDF and ask grounded questions with citations.

**Secrets required (Space Settings → Secrets):**

- `GROQ_API_KEY` — required (default LLM provider)
- `GOOGLE_API_KEY` — optional, enables chart/vision extraction

Built from the open-source [RAG Multimodal Financial Doc Analysis](https://github.com/) demo.
