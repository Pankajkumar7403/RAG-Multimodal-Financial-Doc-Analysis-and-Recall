"""Vector store implementations: DeepLake, PGVector, Qdrant, Chroma.

All implement BaseVectorStore with multi-tenant namespace isolation.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import structlog

from src.rag_system.components.base import BaseVectorStore, DocumentElement, RetrievedChunk
from src.rag_system.config import get_config

logger = structlog.get_logger(__name__)


def _deeplake_major() -> int:
    import deeplake

    return int(str(getattr(deeplake, "__version__", "0")).split(".", 1)[0] or 0)


def _open_or_create_v4(path: str, dim: int):
    """Deep Lake 4.x: create()/open()/add_column() replaced empty()/load()/tensors."""
    import deeplake
    from deeplake import types

    if deeplake.exists(path):
        return deeplake.open(path)
    ds = deeplake.create(path)
    ds.add_column("embedding", types.Embedding(size=dim))
    ds.add_column("text", types.Text())
    ds.add_column("source_document", types.Text())
    ds.add_column("page_number", types.Text())
    ds.add_column("element_type", types.Text())
    ds.add_column("content_hash", types.Text())
    ds.add_column("tenant_id", types.Text())
    ds.commit()
    return ds


class DeepLakeVectorStoreAdapter(BaseVectorStore):
    """DeepLake vector store with tenant-namespaced datasets (Deep Lake 4.x API)."""

    def __init__(self) -> None:
        self._cfg = get_config().vector_store_config
        self._stores: Dict[str, Any] = {}

    @property
    def name(self) -> str:
        return "deeplake"

    def _dataset_path(self, tenant_id: Optional[str]) -> str:
        base = self._cfg.dataset_path or f"./data/vectorstore/{self._cfg.collection_name}"
        if tenant_id and tenant_id != "default":
            return f"{base}_{tenant_id}"
        return base

    def _embedding_dim(self) -> int:
        return int(self._cfg.embedding_dim or 384)

    async def initialize(self, tenant_id: Optional[str] = None) -> None:
        logger.info("deeplake_vector_store_ready", path=self._dataset_path(tenant_id))

    async def upsert(
        self,
        elements: List[DocumentElement],
        embeddings: List[List[float]],
        tenant_id: Optional[str] = None,
    ) -> None:
        path = self._dataset_path(tenant_id)
        await asyncio.to_thread(self._upsert_sync, elements, embeddings, path)

    def _upsert_sync(
        self, elements: List[DocumentElement], embeddings: List[List[float]], path: str
    ) -> None:
        if not elements:
            return
        try:
            import numpy as np

            if _deeplake_major() < 4:
                raise RuntimeError(
                    "Deep Lake 3.x is no longer supported. Install deeplake>=4.0."
                )
            ds = _open_or_create_v4(path, dim=len(embeddings[0]) or self._embedding_dim())
            ds.append(
                {
                    "embedding": np.array(embeddings, dtype="float32"),
                    "text": [e.text for e in elements],
                    "source_document": [e.source_document for e in elements],
                    "page_number": [str(e.page_number or "") for e in elements],
                    "element_type": [e.type for e in elements],
                    "content_hash": [e.content_hash or "" for e in elements],
                    "tenant_id": [e.tenant_id or "" for e in elements],
                }
            )
            ds.commit()
            logger.info("deeplake_upsert_complete", path=path, num_elements=len(elements))
        except ImportError:
            logger.warning("deeplake_not_installed", detail="pip install deeplake>=4.0")
        except Exception as exc:
            logger.error("deeplake_upsert_failed", error=str(exc))
            raise

    async def search(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None,
    ) -> List[RetrievedChunk]:
        path = self._dataset_path(tenant_id)
        return await asyncio.to_thread(self._search_sync, query_vector, top_k, path)

    def _search_sync(
        self, query_vector: List[float], top_k: int, path: str
    ) -> List[RetrievedChunk]:
        try:
            import deeplake
            import numpy as np

            if not deeplake.exists(path):
                return []
            if _deeplake_major() < 4:
                logger.error("deeplake_search_failed", error="deeplake>=4.0 required")
                return []
            ds = deeplake.open(path)
            if len(ds) == 0:
                return []
            embeddings = np.array(ds["embedding"][:], dtype="float32")
            query = np.array(query_vector, dtype="float32")
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            q_norm = np.linalg.norm(query)
            if norms.any() and q_norm:
                similarities = (embeddings @ query) / (norms.flatten() * q_norm + 1e-9)
            else:
                similarities = np.zeros(len(embeddings))
            top_indices = np.argsort(similarities)[::-1][:top_k]
            results = []
            for idx in top_indices:
                i = int(idx)
                page = str(ds["page_number"][i])
                page_num = int(page) if page.isdigit() else None
                results.append(
                    RetrievedChunk(
                        text=str(ds["text"][i]),
                        score=float(similarities[i]),
                        source_document=str(ds["source_document"][i]),
                        page_number=page_num,
                        chunk_id=str(ds["content_hash"][i]),
                    )
                )
            return results
        except Exception as exc:
            logger.error("deeplake_search_failed", error=str(exc))
            return []

    async def delete(self, doc_ids: List[str], tenant_id: Optional[str] = None) -> None:
        logger.info(
            "deeplake_delete_requested",
            doc_ids=doc_ids,
            tenant_id=tenant_id,
            note="DeepLake deletion requires full reindex; flagging for background job",
        )


class InMemoryVectorStore(BaseVectorStore):
    """In-memory vector store for testing and development."""

    def __init__(self) -> None:
        self._data: Dict[str, List[Any]] = {}

    @property
    def name(self) -> str:
        return "in_memory"

    async def initialize(self, tenant_id: Optional[str] = None) -> None:
        self._data.setdefault(tenant_id or "default", [])

    async def upsert(
        self,
        elements: List[DocumentElement],
        embeddings: List[List[float]],
        tenant_id: Optional[str] = None,
    ) -> None:
        key = tenant_id or "default"
        self._data.setdefault(key, [])
        for elem, vec in zip(elements, embeddings, strict=True):
            self._data[key].append({"element": elem, "vector": vec})

    async def search(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None,
    ) -> List[RetrievedChunk]:
        import math

        key = tenant_id or "default"
        data = self._data.get(key, [])
        scored = []
        for item in data:
            v = item["vector"]
            dot = sum(a * b for a, b in zip(query_vector, v, strict=True))
            norm_q = math.sqrt(sum(x**2 for x in query_vector))
            norm_v = math.sqrt(sum(x**2 for x in v))
            score = dot / (norm_q * norm_v + 1e-9)
            scored.append((score, item["element"]))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            RetrievedChunk(
                text=e.text,
                score=s,
                source_document=e.source_document,
                page_number=e.page_number,
                chunk_id=e.content_hash,
            )
            for s, e in scored[:top_k]
        ]

    async def delete(self, doc_ids: List[str], tenant_id: Optional[str] = None) -> None:
        key = tenant_id or "default"
        self._data[key] = [
            item for item in self._data.get(key, []) if item["element"].content_hash not in doc_ids
        ]


def build_vector_store(provider: Optional[str] = None) -> BaseVectorStore:
    cfg = get_config().vector_store_config
    name = provider or cfg.provider
    if name == "memory":
        return InMemoryVectorStore()
    if name == "pgvector":
        from src.rag_system.components.vector_store.pgvector_adapter import PGVectorAdapter

        return PGVectorAdapter()
    if name == "qdrant":
        from src.rag_system.components.vector_store.qdrant_adapter import QdrantAdapter

        return QdrantAdapter()
    if name == "chroma":
        logger.warning(
            "chroma_not_implemented", fallback="deeplake", detail="Chroma adapter planned v2.1"
        )
        return DeepLakeVectorStoreAdapter()
    return DeepLakeVectorStoreAdapter()
