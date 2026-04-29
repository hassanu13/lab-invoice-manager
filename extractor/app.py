"""
Lab Invoice Extractor — FastAPI wrapper around extract_invoice.py.

POST /extract  multipart/form-data with field "file" (the PDF)
              -> 200 JSON: { rows: [...], detected_lab, detected_format,
                             parser_used, source_filename }

The actual parsing is delegated unchanged to the production-tested
extract_invoice.py. This file is purely transport: receive bytes, hand
to extract_invoice, format the response, send back.
"""
from __future__ import annotations

import io
import logging
from typing import Any

import pdfplumber
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

# extract_invoice.py is a sibling module; its top-level imports load eagerly.
import extract_invoice as ei

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("extractor")

app = FastAPI(
    title="DSD Lab Invoice Extractor",
    version="1.0",
    description="Internal microservice. Wraps the production-tested extract_invoice.py.",
)


class ConfidenceShape(BaseModel):
    """Per-field confidence — same shape the TS side expects."""

    invoiceDate: str = "high"
    invoiceNumber: str = "high"
    jobReference: str = "high"
    patientName: str = "high"
    laboratoryName: str = "high"
    invoicedAmount: str = "high"
    paymentsMade: str = "high"
    balance: str = "high"
    overall: str = "high"


class ExtractedRow(BaseModel):
    """One row of extracted data — camelCase for the Node consumer."""

    invoiceDate: str | None
    invoiceNumber: str | None
    jobReference: str | None
    patientName: str | None
    laboratoryName: str | None
    invoicedAmount: float | None
    paymentsMade: float | None
    balance: float | None
    confidence: ConfidenceShape


class ExtractResponse(BaseModel):
    rows: list[ExtractedRow]
    detectedLab: str | None
    detectedFormat: str
    parserUsed: str
    sourceFilename: str
    rawText: str


def _row_confidence(row: dict[str, Any], parser: str) -> ConfidenceShape:
    """
    Map the row's filled-ness into our confidence convention.

    Lab-specific parsers (everything except 'standard') anchor each field
    against a known regex, so high confidence is fair when the field is
    populated. The standard parser is generic-regex only, so medium.
    Summary rows have many intentional nulls and we tag those low.
    """
    is_summary = row.get("invoice_number") in ("STATEMENT TOTAL", "SUMMARY TOTAL") or (
        isinstance(row.get("invoice_number"), str) and row["invoice_number"].startswith("STMT-")
    )
    base = "high" if parser != "standard" else "medium"
    if is_summary:
        base = "low"

    def lvl(value: Any) -> str:
        if value is None or value == "":
            return "low"
        return base

    fields = {
        "invoiceDate": lvl(row.get("invoice_date")),
        "invoiceNumber": lvl(row.get("invoice_number")),
        "jobReference": lvl(row.get("job_reference")),
        "patientName": lvl(row.get("patient_name")),
        "laboratoryName": lvl(row.get("laboratory_name")),
        "invoicedAmount": lvl(row.get("invoiced_amount")),
        "paymentsMade": lvl(row.get("payments_made")),
        "balance": lvl(row.get("balance")),
    }
    rank = {"high": 3, "medium": 2, "low": 1}
    overall = min(fields.values(), key=lambda v: rank[v])
    return ConfidenceShape(**fields, overall=overall)


def _row_to_camel(row: dict[str, Any], parser: str) -> ExtractedRow:
    return ExtractedRow(
        invoiceDate=row.get("invoice_date"),
        invoiceNumber=row.get("invoice_number"),
        jobReference=row.get("job_reference"),
        patientName=row.get("patient_name"),
        laboratoryName=row.get("laboratory_name"),
        invoicedAmount=row.get("invoiced_amount"),
        paymentsMade=row.get("payments_made"),
        balance=row.get("balance"),
        confidence=_row_confidence(row, parser),
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "dsd-lim-extractor"}


@app.post("/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)) -> ExtractResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Expected a .pdf file")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty file body")

    # extract_invoice.py reads from a path; the production code path uses
    # pdfplumber.open() on a path. We mirror that by giving it a BytesIO.
    pages_text: list[str] = []
    tables: list[list[list[Any]]] = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                pages_text.append(page.extract_text() or "")
                tables.extend(page.extract_tables() or [])
    except Exception as e:  # noqa: BLE001
        log.exception("pdfplumber failed for %s", file.filename)
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}") from e

    text = "\n".join(pages_text)
    detected_lab = ei.detect_lab(text)
    detected_format = ei.detect_format(text)

    parser_map = {
        "3dental": ei.parse_3dental,
        "dent8_innovate": ei.parse_dent8_innovate,
        "hall": ei.parse_hall,
        "carlkearney": ei.parse_carlkearney,
        "aestheticworld": ei.parse_aestheticworld,
        "digitalprothetics": ei.parse_digitalprothetics,
        "s4s": ei.parse_s4s,
    }

    if detected_format in parser_map:
        rows_raw = parser_map[detected_format](text, tables, detected_lab)
        parser_used = detected_format
        # Fall back to the standard parser if a lab-specific parser produces
        # nothing — happens when a known lab sends a single-invoice PDF in a
        # different shape than its statement format (e.g. Carl Kearney).
        if not rows_raw:
            rows_raw = ei.parse_standard(text, detected_lab)
            parser_used = "standard"
    else:
        rows_raw = ei.parse_standard(text, detected_lab)
        parser_used = "standard"

    rows = [_row_to_camel(r, parser_used) for r in rows_raw]
    return ExtractResponse(
        rows=rows,
        detectedLab=detected_lab,
        detectedFormat=detected_format,
        parserUsed=parser_used,
        sourceFilename=file.filename,
        rawText=text,
    )
