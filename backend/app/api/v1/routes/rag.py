import io
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.core.deps import get_current_user

router = APIRouter()

# ── In-memory document store for local TF-IDF search ─────────────────────────
_DOCUMENT_STORE: list[dict[str, Any]] = []


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    """Split text into overlapping chunks for indexing."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk.strip())
        i += chunk_size - overlap
    return chunks if chunks else [text[:2000]]


def _clean_text(text: str) -> str:
    """Normalize whitespace and remove non-printable characters."""
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    return text.strip()


@router.post("/upload/pdf")
def upload_pdf(file: UploadFile = File(...), current_user: object = Depends(get_current_user)):
    """Extract text from an uploaded PDF and index it for semantic search."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        from PyPDF2 import PdfReader
    except ImportError:
        return {
            "status": "error",
            "message": "PyPDF2 is not installed. Run: pip install PyPDF2",
        }

    content = file.file.read()
    reader = PdfReader(io.BytesIO(content))
    full_text = ""
    page_texts: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        page_texts.append(page_text)
        full_text += page_text + "\n"

    full_text = _clean_text(full_text)

    if not full_text.strip():
        return {"status": "warning", "message": "No extractable text found in PDF.", "chunks": 0}

    chunks = _chunk_text(full_text)
    doc_id = f"pdf_{file.filename}_{len(_DOCUMENT_STORE)}"

    for i, chunk in enumerate(chunks):
        _DOCUMENT_STORE.append({
            "doc_id": doc_id,
            "filename": file.filename,
            "type": "pdf",
            "chunk_index": i,
            "content": chunk,
            "page_count": len(reader.pages),
        })

    return {
        "status": "indexed",
        "doc_id": doc_id,
        "filename": file.filename,
        "pages": len(reader.pages),
        "chunks_indexed": len(chunks),
        "total_characters": len(full_text),
        "message": f"Successfully extracted and indexed {len(chunks)} chunks from {len(reader.pages)} pages.",
    }


@router.post("/upload/docx")
def upload_docx(file: UploadFile = File(...), current_user: object = Depends(get_current_user)):
    """Extract text from an uploaded DOCX and index it for semantic search."""
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="File must be a DOCX")

    try:
        from docx import Document
    except ImportError:
        return {
            "status": "error",
            "message": "python-docx is not installed. Run: pip install python-docx",
        }

    content = file.file.read()
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    full_text = _clean_text("\n".join(paragraphs))

    if not full_text.strip():
        return {"status": "warning", "message": "No extractable text found in DOCX.", "chunks": 0}

    chunks = _chunk_text(full_text)
    doc_id = f"docx_{file.filename}_{len(_DOCUMENT_STORE)}"

    for i, chunk in enumerate(chunks):
        _DOCUMENT_STORE.append({
            "doc_id": doc_id,
            "filename": file.filename,
            "type": "docx",
            "chunk_index": i,
            "content": chunk,
            "paragraph_count": len(paragraphs),
        })

    return {
        "status": "indexed",
        "doc_id": doc_id,
        "filename": file.filename,
        "paragraphs": len(paragraphs),
        "chunks_indexed": len(chunks),
        "total_characters": len(full_text),
        "message": f"Successfully extracted and indexed {len(chunks)} chunks from {len(paragraphs)} paragraphs.",
    }


@router.post("/upload/csv")
def upload_csv(file: UploadFile = File(...), current_user: object = Depends(get_current_user)):
    """Index CSV column names and sample values for semantic search."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    import pandas as pd

    content = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    # Build searchable text from column names, dtypes, and sample values
    texts = []
    for col in df.columns:
        sample_vals = df[col].dropna().head(5).astype(str).tolist()
        text = f"Column '{col}' (type: {df[col].dtype}): {', '.join(sample_vals)}"
        texts.append(text)

    # Also index a summary
    summary = (
        f"CSV file '{file.filename}' contains {len(df)} rows and {len(df.columns)} columns. "
        f"Columns: {', '.join(df.columns.tolist())}."
    )
    texts.append(summary)

    doc_id = f"csv_{file.filename}_{len(_DOCUMENT_STORE)}"
    for i, text in enumerate(texts):
        _DOCUMENT_STORE.append({
            "doc_id": doc_id,
            "filename": file.filename,
            "type": "csv",
            "chunk_index": i,
            "content": text,
            "rows": len(df),
            "columns": len(df.columns),
        })

    return {
        "status": "indexed",
        "doc_id": doc_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "chunks_indexed": len(texts),
        "message": f"Successfully indexed {len(df.columns)} columns + summary from {len(df)} rows.",
    }


@router.get("/semantic-search")
def semantic_search(
    q: str = Query("", description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    _: object = Depends(get_current_user),
):
    """TF-IDF based semantic search over indexed documents."""
    if not q.strip():
        return {"results": [], "total": 0, "message": "Please provide a search query via the 'q' parameter."}

    if not _DOCUMENT_STORE:
        return {
            "results": [],
            "total": 0,
            "message": "No documents indexed yet. Upload PDFs, DOCX, or CSV files first.",
        }

    # Simple TF-IDF-like scoring using term frequency
    query_terms = set(q.lower().split())
    scored: list[tuple[float, dict]] = []

    for doc in _DOCUMENT_STORE:
        content_lower = doc["content"].lower()
        content_words = content_lower.split()
        total_words = len(content_words) or 1

        # Term frequency score
        tf_score = sum(content_words.count(term) for term in query_terms) / total_words

        # Exact phrase bonus
        if q.lower() in content_lower:
            tf_score += 0.5

        # Title / filename bonus
        if any(term in doc.get("filename", "").lower() for term in query_terms):
            tf_score += 0.2

        if tf_score > 0:
            scored.append((tf_score, doc))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)
    top_results = scored[:limit]

    results = [
        {
            "score": round(score, 4),
            "doc_id": doc["doc_id"],
            "filename": doc["filename"],
            "type": doc["type"],
            "chunk_index": doc["chunk_index"],
            "snippet": doc["content"][:300] + ("..." if len(doc["content"]) > 300 else ""),
        }
        for score, doc in top_results
    ]

    return {
        "query": q,
        "results": results,
        "total": len(results),
        "documents_indexed": len(_DOCUMENT_STORE),
    }


@router.get("/documents")
def list_documents(_: object = Depends(get_current_user)):
    """List all indexed documents."""
    docs: dict[str, dict[str, Any]] = {}
    for entry in _DOCUMENT_STORE:
        doc_id = entry["doc_id"]
        if doc_id not in docs:
            docs[doc_id] = {
                "doc_id": doc_id,
                "filename": entry["filename"],
                "type": entry["type"],
                "chunks": 0,
            }
        docs[doc_id]["chunks"] += 1

    return {
        "documents": list(docs.values()),
        "total": len(docs),
        "total_chunks": len(_DOCUMENT_STORE),
    }


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, _: object = Depends(get_current_user)):
    """Remove an indexed document."""
    global _DOCUMENT_STORE
    before = len(_DOCUMENT_STORE)
    _DOCUMENT_STORE = [d for d in _DOCUMENT_STORE if d["doc_id"] != doc_id]
    removed = before - len(_DOCUMENT_STORE)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "deleted", "doc_id": doc_id, "chunks_removed": removed}
