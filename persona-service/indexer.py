"""
Load Nemotron-Personas-USA subset, embed with Gemini, build in-memory index
for cosine similarity search.
"""
import os
import numpy as np
from typing import Optional, Any
from dataclasses import dataclass

# Lazy imports to avoid loading heavy deps until needed
def _load_dataset():
    from datasets import load_dataset
    return load_dataset("nvidia/Nemotron-Personas-USA", split="train", trust_remote_code=True)

def _get_embedding_client():
    import google.generativeai as genai
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY must be set")
    genai.configure(api_key=api_key)
    return genai

def _concat_persona_fields(record: dict) -> str:
    """Concatenate persona-relevant fields for embedding."""
    parts = []
    for key in [
        "persona",
        "professional_persona",
        "cultural_background",
        "skills_and_expertise",
        "hobbies_and_interests",
        "career_goals_and_ambitions",
    ]:
        val = record.get(key)
        if val and isinstance(val, str):
            parts.append(val)
    return "\n\n".join(parts) if parts else str(record.get("persona", ""))


@dataclass
class IndexState:
    embeddings: np.ndarray
    records: list[dict]
    model: Any = None  # genai embedding model


def build_index(
    subset_size: int = 30_000,
    embedding_model: str = "models/text-embedding-004",
    batch_size: int = 50,
) -> IndexState:
    """
    Load dataset subset, embed with Gemini, return index state.
    """
    print("Loading Nemotron-Personas-USA dataset...")
    ds = _load_dataset()
    total = len(ds)

    # Stratified-ish sampling: shuffle and take first N to get diversity
    indices = np.random.RandomState(42).permutation(total)[:subset_size]
    records = []
    texts = []

    for i in indices:
        record = ds[int(i)]
        records.append(dict(record))
        texts.append(_concat_persona_fields(record))

    print(f"Embedding {len(texts)} personas with {embedding_model}...")
    genai = _get_embedding_client()

    embeddings_list = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        # google-generativeai embed_content: single content returns {"embedding": [...]}
        # Batch: pass list, may return {"embeddings": [[...], [...]]} or similar
        if len(batch) == 1:
            result = genai.embed_content(
                model=embedding_model,
                content=batch[0],
            )
            emb = result.get("embedding", result) if isinstance(result, dict) else getattr(result, "embedding", result)
            embeddings_list.append(np.array(emb, dtype=np.float32))
        else:
            for text in batch:
                result = genai.embed_content(model=embedding_model, content=text)
                emb = result.get("embedding", result) if isinstance(result, dict) else getattr(result, "embedding", result)
                embeddings_list.append(np.array(emb, dtype=np.float32))
        if (i + batch_size) % 500 == 0:
            print(f"  Embedded {min(i + batch_size, len(texts))}/{len(texts)}...")

    embeddings = np.vstack([e.reshape(1, -1) if e.ndim == 1 else e for e in embeddings_list])

    # Normalize for cosine similarity
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1
    embeddings = embeddings / norms

    print(f"Index built: {embeddings.shape[0]} vectors, dim={embeddings.shape[1]}")
    return IndexState(embeddings=embeddings, records=records)


def search(
    index: IndexState,
    query: str,
    k: int = 5,
    embedding_model: str = "models/text-embedding-004",
) -> list[dict]:
    """Embed query, compute cosine similarity, return top-k records."""
    genai = _get_embedding_client()
    result = genai.embed_content(
        model=embedding_model,
        content=query,
    )
    if isinstance(result, dict):
        q_emb = np.array(result["embedding"])
    else:
        q_emb = np.array(getattr(result, "embedding", result))
    q_emb = q_emb.astype(np.float32).reshape(1, -1)
    q_norm = np.linalg.norm(q_emb)
    if q_norm > 0:
        q_emb = q_emb / q_norm

    scores = index.embeddings @ q_emb.T
    scores = scores.flatten()
    top_indices = np.argsort(scores)[::-1][:k]

    return [index.records[i] for i in top_indices]
