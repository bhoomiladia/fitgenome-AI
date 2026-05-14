# ── Stage 1: Builder ──────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# 1. Copy your requirements
COPY requirements.txt .

# 2. Install all dependencies

RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
RUN pip uninstall -y pinecone-plugin-inference


# ── Stage 2: Runtime ──────────────────────────────────────
FROM python:3.11-slim AS runtime

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
