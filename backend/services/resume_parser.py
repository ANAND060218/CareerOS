import io
from fastapi import UploadFile, HTTPException


async def extract_text_from_upload(file: UploadFile) -> str:
    filename = (file.filename or "").lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if filename.endswith(".txt") or filename.endswith(".md"):
        return content.decode("utf-8", errors="ignore").strip()

    if filename.endswith(".pdf"):
        try:
            import fitz  # PyMuPDF
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="PDF support not installed (pymupdf).") from exc
        doc = fitz.open(stream=content, filetype="pdf")
        pages = [page.get_text() for page in doc]
        doc.close()
        text = "\n".join(pages).strip()
        if not text:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")
        return text

    if filename.endswith(".docx"):
        try:
            import docx
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="DOCX support not installed (python-docx).") from exc
        document = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in document.paragraphs).strip()
        if not text:
            raise HTTPException(status_code=400, detail="Could not extract text from DOCX.")
        return text

    raise HTTPException(
        status_code=400,
        detail="Unsupported file type. Upload PDF, DOCX, or TXT.",
    )
