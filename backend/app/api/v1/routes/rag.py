from fastapi import APIRouter, Depends, File, UploadFile

from app.core.deps import get_current_user

router = APIRouter()


@router.post("/upload/pdf")
def upload_pdf(file: UploadFile = File(...), current_user: object = Depends(get_current_user)):
    _ = (file, current_user)
    return {"status": "placeholder", "message": "PDF ingestion pipeline will activate when vector store is configured."}


@router.post("/upload/docx")
def upload_docx(file: UploadFile = File(...), current_user: object = Depends(get_current_user)):
    _ = (file, current_user)
    return {"status": "placeholder", "message": "DOCX ingestion pipeline will activate when vector store is configured."}


@router.post("/upload/csv")
def upload_csv(file: UploadFile = File(...), current_user: object = Depends(get_current_user)):
    _ = (file, current_user)
    return {"status": "placeholder", "message": "CSV semantic indexing will activate when vector store is configured."}


@router.get("/semantic-search")
def semantic_search(_: object = Depends(get_current_user)):
    return {"status": "placeholder", "message": "Semantic search is disabled until embedding provider is configured."}
