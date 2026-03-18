"""
FastAPI service for persona retrieval from Nemotron-Personas-USA.
Exposes /retrieve (vector search) and /health.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from dotenv import load_dotenv
load_dotenv()

from indexer import build_index, search, IndexState

# Global index - built at startup
_index: IndexState | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build index on startup."""
    global _index
    try:
        _index = build_index(
            subset_size=int(os.getenv("INDEX_SUBSET_SIZE", "10000")),
            batch_size=int(os.getenv("EMBED_BATCH_SIZE", "25")),
        )
        print("Persona retrieval service ready.")
    except Exception as e:
        print(f"Failed to build index: {e}")
        _index = None
    yield
    _index = None


app = FastAPI(title="Persona Retrieval Service", lifespan=lifespan)


class RetrieveRequest(BaseModel):
    query: str = Field(..., description="Free-form search query (e.g., 'tech worker Seattle')")
    k: int = Field(default=5, ge=1, le=20, description="Number of personas to return")


class RetrieveResponse(BaseModel):
    personas: list[dict]
    count: int


@app.get("/health")
def health():
    """Health check."""
    return {"status": "ok", "index_ready": _index is not None}


@app.post("/retrieve", response_model=RetrieveResponse)
def retrieve(req: RetrieveRequest):
    """
    Retrieve top-k similar personas from the Nemotron dataset.
    Uses vector similarity search over embedded persona descriptions.
    """
    if _index is None:
        raise HTTPException(
            status_code=503,
            detail="Index not ready. Service may still be building the index.",
        )
    try:
        records = search(_index, query=req.query, k=req.k)
        return RetrieveResponse(personas=records, count=len(records))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
