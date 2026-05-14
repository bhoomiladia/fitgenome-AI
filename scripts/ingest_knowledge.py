#!/usr/bin/env python3
"""
Pinecone Knowledge Ingestion Script

Reads fitness/nutrition research documents from ``data/knowledge/``,
splits them into chunks, embeds them with OpenAI, and upserts into
a Pinecone index for RAG retrieval.

Usage:
    python scripts/ingest_knowledge.py

Requires OPENAI_API_KEY, PINECONE_API_KEY, and PINECONE_INDEX_NAME
to be set in the environment (or in a .env file).
"""

import os
import sys
import uuid
from pathlib import Path

# Ensure the project root is on sys.path so we can import app.core.config
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")

from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone, ServerlessSpec

from app.core.config import settings

# ── Configuration ─────────────────────────────────────────

KNOWLEDGE_DIR = PROJECT_ROOT / "data" / "knowledge"
SUPPORTED_EXTENSIONS = {".txt", ".md"}
CHUNK_SIZE = 500       # tokens (approximate via character count × 0.75)
CHUNK_OVERLAP = 50
BATCH_SIZE = 100       # upsert batch size for Pinecone
EMBEDDING_DIMENSION = 1536  # text-embedding-3-small


def load_documents() -> list[dict]:
    """
    Read all supported files from the knowledge directory.

    Returns a list of dicts with keys: ``text``, ``source``.
    """
    if not KNOWLEDGE_DIR.exists():
        print(f"❌ Knowledge directory not found: {KNOWLEDGE_DIR}")
        print("   Create it and add .txt or .md files, then re-run.")
        sys.exit(1)

    documents = []
    for filepath in sorted(KNOWLEDGE_DIR.iterdir()):
        if filepath.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        text = filepath.read_text(encoding="utf-8").strip()
        if text:
            documents.append({"text": text, "source": filepath.name})
            print(f"  📄 Loaded: {filepath.name} ({len(text)} chars)")

    if not documents:
        print(f"⚠️  No supported files found in {KNOWLEDGE_DIR}")
        sys.exit(1)

    return documents


def chunk_documents(documents: list[dict]) -> list[dict]:
    """
    Split documents into smaller chunks for embedding.

    Returns a list of dicts with keys: ``text``, ``source``, ``chunk_index``.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = []
    for doc in documents:
        splits = splitter.split_text(doc["text"])
        for i, chunk_text in enumerate(splits):
            chunks.append({
                "text": chunk_text,
                "source": doc["source"],
                "chunk_index": i,
            })

    print(f"\n📦 Split {len(documents)} documents into {len(chunks)} chunks")
    return chunks


def ensure_index(pc: Pinecone) -> None:
    """Create the Pinecone index if it doesn't already exist."""
    existing_indexes = [idx.name for idx in pc.list_indexes()]

    if settings.PINECONE_INDEX_NAME in existing_indexes:
        print(f"✅ Index '{settings.PINECONE_INDEX_NAME}' already exists")
        return

    print(f"🔨 Creating index '{settings.PINECONE_INDEX_NAME}'...")
    pc.create_index(
        name=settings.PINECONE_INDEX_NAME,
        dimension=EMBEDDING_DIMENSION,
        metric="cosine",
        spec=ServerlessSpec(
            cloud=settings.PINECONE_CLOUD,
            region=settings.PINECONE_REGION,
        ),
    )
    print(f"✅ Index '{settings.PINECONE_INDEX_NAME}' created")


def ingest(chunks: list[dict], pc: Pinecone) -> None:
    """Embed chunks and upsert into Pinecone."""
    embeddings = OpenAIEmbeddings(
        model=settings.OPENAI_EMBEDDING_MODEL,
        api_key=settings.OPENAI_API_KEY,
    )

    index = pc.Index(settings.PINECONE_INDEX_NAME)

    # Process in batches
    total = len(chunks)
    for batch_start in range(0, total, BATCH_SIZE):
        batch = chunks[batch_start : batch_start + BATCH_SIZE]
        batch_texts = [c["text"] for c in batch]

        # Embed the batch
        vectors = embeddings.embed_documents(batch_texts)

        # Prepare upsert records
        records = []
        for chunk, vector in zip(batch, vectors):
            record_id = str(uuid.uuid4())
            records.append({
                "id": record_id,
                "values": vector,
                "metadata": {
                    "text": chunk["text"],
                    "source": chunk["source"],
                    "chunk_index": chunk["chunk_index"],
                },
            })

        index.upsert(vectors=records)
        print(
            f"  ⬆️  Upserted batch {batch_start // BATCH_SIZE + 1} "
            f"({min(batch_start + BATCH_SIZE, total)}/{total} chunks)"
        )

    print(f"\n🎉 Successfully ingested {total} chunks into Pinecone")


def main():
    print("=" * 60)
    print("  FitGenome AI — Knowledge Ingestion Pipeline")
    print("=" * 60)

    # Validate API keys
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-your"):
        print("❌ OPENAI_API_KEY not configured. Set it in .env")
        sys.exit(1)
    if not settings.PINECONE_API_KEY or settings.PINECONE_API_KEY.startswith("your"):
        print("❌ PINECONE_API_KEY not configured. Set it in .env")
        sys.exit(1)

    print(f"\n📂 Loading documents from: {KNOWLEDGE_DIR}")
    documents = load_documents()

    chunks = chunk_documents(documents)

    print(f"\n🌲 Connecting to Pinecone...")
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    ensure_index(pc)

    print(f"\n🚀 Ingesting into index '{settings.PINECONE_INDEX_NAME}'...")
    ingest(chunks, pc)

    print("\n✅ Ingestion complete!")


if __name__ == "__main__":
    main()
