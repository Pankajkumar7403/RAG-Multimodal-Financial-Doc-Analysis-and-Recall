"""Deep Lake vector store — must work on Deep Lake 4.x (empty() was removed)."""

from __future__ import annotations

import pytest

from src.rag_system.components.base import DocumentElement


def _elements() -> list[DocumentElement]:
    return [
        DocumentElement(
            type="text",
            text="Tesla reported automotive revenue of 19.6 billion",
            source_document="tesla.pdf",
            page_number=3,
            content_hash="h1",
            tenant_id="demo",
        ),
        DocumentElement(
            type="text",
            text="Interest rates and risk factors",
            source_document="tesla.pdf",
            page_number=12,
            content_hash="h2",
            tenant_id="demo",
        ),
    ]


@pytest.mark.asyncio
async def test_deeplake_upsert_and_search_roundtrip(tmp_path, monkeypatch):
    """Ingest must persist chunks with the current Deep Lake API and retrieve them."""
    pytest.importorskip("deeplake")
    monkeypatch.setenv("VECTOR_STORE_CONFIG__DATASET_PATH", str(tmp_path / "rag_store"))
    monkeypatch.setenv("VECTOR_STORE_CONFIG__EMBEDDING_DIM", "4")
    from src.rag_system.config import reset_config

    reset_config()
    from src.rag_system.components.vector_store import DeepLakeVectorStoreAdapter

    store = DeepLakeVectorStoreAdapter()
    await store.initialize("demo")
    elements = _elements()
    embeddings = [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0]]
    await store.upsert(elements, embeddings, tenant_id="demo")

    hits = await store.search([1.0, 0.0, 0.0, 0.0], top_k=1, tenant_id="demo")
    assert hits, "search returned no chunks after ingest"
    assert "automotive revenue" in hits[0].text
    assert hits[0].page_number == 3
    assert hits[0].source_document == "tesla.pdf"


def test_deeplake_does_not_call_removed_empty_api():
    """Deep Lake 4 replaced empty() with create(); adapter source must not use empty()."""
    from src.rag_system.components import vector_store as vs_mod
    import inspect

    source = inspect.getsource(vs_mod.DeepLakeVectorStoreAdapter)
    assert "deeplake.empty(" not in source
    assert ".create_tensor(" not in source
    assert "deeplake.load(" not in source
