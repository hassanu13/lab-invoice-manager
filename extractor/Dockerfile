# Lightweight Python image for the extractor microservice.
FROM python:3.12-slim

WORKDIR /app

# pdfplumber → pdfminer.six → cryptography needs build essentials only on
# some platforms; the slim image already includes what we need at runtime.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bring in the production-tested extractor and the FastAPI wrapper.
COPY extract_invoice.py .
COPY app.py .

# Health check uses the /health endpoint we expose in app.py.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" || exit 1

EXPOSE 8000

# 1 worker is fine for MVP volumes; scale workers up at deploy time if needed.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
