# python:3.11-slim has pre-built wheels for pdfplumber, pikepdf, PyMuPDF
FROM python:3.11-slim

WORKDIR /app

# System deps needed by pikepdf / pdfplumber on some platforms
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
