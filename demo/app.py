"""Streamlit demo UI for RAG Financial Multimodal.

Usage (from repo root, with .venv active):
    streamlit run demo/app.py

Loads the project .env (Groq / Gemini / OpenAI) and runs the SDK pipeline
locally — no FastAPI or Next.js frontend required.
"""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    import streamlit as st
except ImportError:
    print("Install streamlit: pip install -r demo/requirements.txt")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[assignment]


def _load_env() -> None:
    """Load repo .env, then force demo-safe local overrides."""
    if load_dotenv is not None:
        load_dotenv(ROOT / ".env", override=False)

    # Demo must work without Docker Redis / remote OTEL.
    os.environ["CACHE_CONFIG__BACKEND"] = "memory"
    os.environ["CACHE_CONFIG__REDIS_URL"] = ""
    os.environ["CACHE_CONFIG__SEMANTIC_CACHE_ENABLED"] = "false"
    os.environ["OBSERVABILITY_CONFIG__OTLP_ENDPOINT"] = ""
    # Avoid clashing with another local API metrics server.
    os.environ["OBSERVABILITY_CONFIG__PROMETHEUS_PORT"] = "0"

    # Isolated in-memory store so the demo does not touch production DeepLake.
    os.environ["VECTOR_STORE_CONFIG__PROVIDER"] = "memory"
    os.environ.setdefault(
        "VECTOR_STORE_CONFIG__EMBEDDING_PROVIDER",
        os.environ.get("VECTOR_STORE_CONFIG__EMBEDDING_PROVIDER", "local"),
    )


def _run_async(coro):
    """Run a coroutine safely under Streamlit (no nested-loop crash)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Streamlit sometimes already has a loop; use a fresh one.
            return asyncio.new_event_loop().run_until_complete(coro)
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


def _provider_label() -> str:
    return (os.environ.get("LLM_CONFIG__PROVIDER") or "openai").lower()


def _has_llm_credentials() -> bool:
    provider = _provider_label()
    if provider in ("grok", "groq"):
        return bool(os.environ.get("GROQ_API_KEY", "").strip())
    if provider == "xai":
        return bool(os.environ.get("XAI_API_KEY", "").strip())
    if provider in ("gemini", "google"):
        return bool(os.environ.get("GOOGLE_API_KEY", "").strip())
    if provider == "anthropic":
        return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def _credential_hint() -> str:
    provider = _provider_label()
    hints = {
        "grok": "Set GROQ_API_KEY in .env (or paste it in the sidebar).",
        "groq": "Set GROQ_API_KEY in .env (or paste it in the sidebar).",
        "xai": "Set XAI_API_KEY in .env (or paste it in the sidebar).",
        "gemini": "Set GOOGLE_API_KEY in .env (or paste it in the sidebar).",
        "google": "Set GOOGLE_API_KEY in .env (or paste it in the sidebar).",
        "anthropic": "Set ANTHROPIC_API_KEY in .env (or paste it in the sidebar).",
    }
    return hints.get(provider, "Set OPENAI_API_KEY in .env (or paste it in the sidebar).")


def get_pipeline():
    """Create the SDK pipeline once and cache it in session state."""
    if "pipeline" not in st.session_state:
        with st.spinner("Initialising RAG pipeline (first load may download the embedding model)…"):
            from src.rag_system.config import reset_config
            from src.rag_system.sdk import RAGPipeline

            _load_env()
            reset_config()
            pipeline = _run_async(RAGPipeline.create(tenant_id="demo"))
            st.session_state["pipeline"] = pipeline
            st.session_state.setdefault("ingested_files", [])
    return st.session_state["pipeline"]


def _render_sources(sources: List[Dict[str, Any]]) -> None:
    if not sources:
        return
    with st.expander(f"Sources ({len(sources)} chunks)"):
        for i, src in enumerate(sources, 1):
            score = src.get("score")
            score_txt = f"{score:.3f}" if isinstance(score, (int, float)) else "?"
            st.markdown(
                f"**[{i}] {src.get('document', 'unknown')}** — "
                f"Page {src.get('page', '?')} (relevance: {score_txt})"
            )
            preview = src.get("text_preview") or ""
            if preview:
                st.caption(preview[:400])
            st.divider()


def main() -> None:
    _load_env()

    st.set_page_config(
        page_title="RAG Financial Multimodal",
        page_icon="🏦",
        layout="wide",
    )

    st.title("RAG Financial Multimodal")
    st.caption(
        "Local Streamlit demo — upload PDFs, ask grounded questions, inspect citations."
    )

    provider = _provider_label()
    st.info(f"Active LLM provider: **{provider}** (from `.env`). {_credential_hint()}")

    with st.sidebar:
        st.header("Settings")

        # Provider-aware API key field (does not overwrite a valid .env key unless typed).
        key_label = {
            "grok": "Groq API Key",
            "groq": "Groq API Key",
            "xai": "xAI API Key",
            "gemini": "Google API Key",
            "google": "Google API Key",
            "anthropic": "Anthropic API Key",
        }.get(provider, "OpenAI API Key")
        env_key_name = {
            "grok": "GROQ_API_KEY",
            "groq": "GROQ_API_KEY",
            "xai": "XAI_API_KEY",
            "gemini": "GOOGLE_API_KEY",
            "google": "GOOGLE_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
        }.get(provider, "OPENAI_API_KEY")

        pasted_key = st.text_input(
            key_label,
            type="password",
            value="",
            help=f"Optional override for {env_key_name}. Leave blank to use `.env`.",
        )
        if pasted_key.strip():
            os.environ[env_key_name] = pasted_key.strip()

        tenant_id = st.text_input("Tenant ID", value="demo")
        top_k = st.slider("Top-K chunks to retrieve", 1, 8, 4)
        process_vision = st.checkbox(
            "Extract charts with vision",
            value=bool(os.environ.get("GOOGLE_API_KEY", "").strip()),
            help="Requires GOOGLE_API_KEY when VISION_CONFIG__PROVIDER=gemini.",
        )

        st.divider()
        st.header("Ingest documents")
        uploaded_files = st.file_uploader(
            "Upload financial PDFs",
            type=["pdf"],
            accept_multiple_files=True,
        )

        if uploaded_files and st.button("Ingest", type="primary"):
            if process_vision and not os.environ.get("GOOGLE_API_KEY", "").strip():
                st.warning(
                    "Vision is enabled but GOOGLE_API_KEY is missing. "
                    "Uncheck vision or add the key."
                )
            else:
                pipeline = get_pipeline()
                progress = st.progress(0, text="Ingesting…")
                ok_count = 0
                for i, uploaded in enumerate(uploaded_files):
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                        tmp.write(uploaded.getvalue())
                        tmp_path = tmp.name
                    try:
                        result = _run_async(
                            pipeline.ingest(
                                [tmp_path],
                                tenant_id=tenant_id,
                                process_vision=process_vision,
                            )
                        )
                        st.session_state.setdefault("ingested_files", []).append(
                            uploaded.name
                        )
                        ok_count += 1
                        progress.progress(
                            (i + 1) / len(uploaded_files),
                            text=(
                                f"Ingested {uploaded.name} — "
                                f"{result.get('num_chunks', 0)} chunks"
                            ),
                        )
                    except Exception as exc:
                        st.error(f"Failed to ingest {uploaded.name}: {exc}")
                    finally:
                        try:
                            os.unlink(tmp_path)
                        except OSError:
                            pass
                if ok_count:
                    st.success(f"Ingested {ok_count} document(s)")

        if st.session_state.get("ingested_files"):
            st.divider()
            st.caption("Ingested in this session:")
            for name in st.session_state["ingested_files"]:
                st.write(f"• {name}")

    st.header("Query")

    with st.expander("Example questions"):
        examples = [
            "What was total revenue in Q3 2023?",
            "How did gross margins change year-over-year?",
            "What are the key risk factors related to competition?",
            "What was the 3-year revenue CAGR?",
            "Describe the revenue trend from the charts",
        ]
        for i, example in enumerate(examples):
            if st.button(example, key=f"ex_{i}"):
                st.session_state["query_input"] = example

    query = st.text_input(
        "Ask a question about your financial documents",
        value=st.session_state.get("query_input", ""),
        placeholder="e.g. What was Q3 revenue?",
        key="query_box",
    )

    if st.button("Ask", type="primary") and query.strip():
        if not st.session_state.get("ingested_files"):
            st.warning("Ingest at least one PDF in the sidebar first.")
        elif not _has_llm_credentials():
            st.warning(_credential_hint())
        else:
            pipeline = get_pipeline()
            with st.spinner("Retrieving and generating answer…"):
                try:
                    result = _run_async(
                        pipeline.query(
                            query.strip(),
                            tenant_id=tenant_id,
                            top_k=top_k,
                        )
                    )
                except Exception as exc:
                    message = str(exc)
                    if "413" in message or "Payload Too Large" in message:
                        st.error(
                            "The AI provider rejected the request as too large. "
                            "Ask a narrower question or lower Top-K in the sidebar."
                        )
                    else:
                        st.error(f"Query failed: {exc}")
                else:
                    if result.get("status") == "error":
                        st.error(f"Error: {result.get('error', 'Unknown error')}")
                    elif result.get("answer"):
                        st.subheader("Answer")
                        st.write(result["answer"])

                        guards = result.get("guardrails") or {}
                        if not guards.get("overall_passed", True):
                            st.warning(
                                "Guardrail alert: some numeric claims could not be "
                                "verified against retrieved sources."
                            )

                        analysis = result.get("analysis") or {}
                        if analysis:
                            with st.expander("Query analysis"):
                                c1, c2, c3 = st.columns(3)
                                c1.metric("Intent", analysis.get("intent", "?"))
                                c2.metric(
                                    "Complexity", analysis.get("complexity", "?")
                                )
                                c3.metric(
                                    "PoT",
                                    "Yes" if analysis.get("use_pot") else "No",
                                )

                        _render_sources(result.get("sources") or [])

                        metrics = result.get("metrics") or {}
                        m1, m2, m3, m4 = st.columns(4)
                        m1.metric(
                            "Total latency",
                            f"{metrics.get('total_latency_ms', 0):.0f} ms",
                        )
                        m2.metric(
                            "Retrieval",
                            f"{metrics.get('retrieval_latency_ms', 0):.0f} ms",
                        )
                        m3.metric(
                            "Generation",
                            f"{metrics.get('generation_latency_ms', 0):.0f} ms",
                        )
                        m4.metric(
                            "Est. cost",
                            f"${metrics.get('cost_usd', 0):.5f}",
                        )
                    else:
                        st.warning(
                            "No answer was returned. Try ingesting a PDF or asking "
                            "a more specific question."
                        )

    st.divider()
    st.caption(
        "Local demo · uses project `.env` · vector store = in-memory for this session"
    )


if __name__ == "__main__":
    main()
