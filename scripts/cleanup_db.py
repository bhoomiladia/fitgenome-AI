#!/usr/bin/env python3
"""
FitGenome AI — Database Cleanup Script

Finds and deletes incomplete user profiles (where is_onboarded = FALSE or
critical biometrics are missing). Since ON DELETE CASCADE is configured
on all referencing tables, deleting users will automatically clean up all
associated workout logs, nutrition logs, daily metrics, Streaks, user personas,
chat messages, and plans.

Usage:
    python scripts/cleanup_db.py [--auto]
"""

import asyncio
import os
import sys
from pathlib import Path

# Ensure the project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

import asyncpg
from app.core.config import settings


async def cleanup_profiles(auto_confirm: bool = False):
    print("=" * 60)
    print("  FitGenome AI — Database Profile Cleanup Utility")
    print("=" * 60)

    # We need to map container DB host to localhost if running from outside docker-compose
    db_url = settings.DATABASE_URL
    is_docker = os.path.exists('/.dockerenv')
    if "db:" in db_url and not is_docker and not os.environ.get("RUNNING_IN_DOCKER"):
        # Replace db:5432 with localhost:5432 for host execution
        db_url = db_url.replace("db:5432", "localhost:5432")

    print(f"\n🔌 Connecting to database...")
    try:
        conn = await asyncpg.connect(db_url)
        print("✅ Database connected successfully.")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        print("   Make sure the database service is running and accessible.")
        sys.exit(1)

    try:
        # 1. Fetch incomplete profiles
        # An incomplete profile is a user where is_onboarded is false OR
        # critical biometrics are missing: age, gender, height_cm, weight_kg
        query = """
            SELECT id, email, full_name, is_onboarded, age, gender, height_cm, weight_kg, created_at
            FROM users
            WHERE is_onboarded = FALSE
               OR age IS NULL
               OR gender IS NULL
               OR height_cm IS NULL
               OR weight_kg IS NULL
            ORDER BY created_at DESC;
        """
        rows = await conn.fetch(query)

        if not rows:
            print("\n✨ Perfect! No incomplete user profiles found in the database.")
            return

        print(f"\n⚠️ Found {len(rows)} incomplete user profile(s):")
        print("-" * 100)
        print(f"{'ID':<38} | {'Email':<25} | {'Full Name':<15} | {'Onboarded':<9} | {'Age':<3} | {'Gender':<6}")
        print("-" * 100)
        for r in rows:
            gender_str = r['gender'].value if hasattr(r['gender'], 'value') else str(r['gender'])
            print(f"{str(r['id']):<38} | {r['email']:<25} | {r['full_name']:<15} | {str(r['is_onboarded']):<9} | {str(r['age'] or ''):<3} | {gender_str or ''}")
        print("-" * 100)

        # 2. Confirm and delete
        confirm = False
        if auto_confirm:
            confirm = True
            print("\n🤖 Run mode: Auto-Confirm (--auto flag active). Proceeding with deletion.")
        else:
            print("\nDeleting these users will cascade-delete all of their associated logs, metrics, streaks, personas, and generated plans.")
            response = input("❓ Do you want to permanently delete these incomplete profiles? (y/N): ").strip().lower()
            if response in ('y', 'yes'):
                confirm = True

        if confirm:
            ids_to_delete = [r['id'] for r in rows]
            print(f"\n🚀 Deleting {len(ids_to_delete)} profile(s)...")
            
            # Delete query
            delete_query = "DELETE FROM users WHERE id = ANY($1::uuid[]);"
            result = await conn.execute(delete_query, ids_to_delete)
            
            print(f"✅ Successfully deleted! Result: {result}")
        else:
            print("\n❌ Cleanup cancelled. No changes made.")

    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
    finally:
        await conn.close()
        print("\n🔌 Connection closed.")


def main():
    auto_confirm = "--auto" in sys.argv
    asyncio.run(cleanup_profiles(auto_confirm))


if __name__ == "__main__":
    main()
