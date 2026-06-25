"""PostgreSQL access for the crawler (psycopg 3).

The crawler writes the same schema Prisma owns; Prisma is the contract. We
generate ids app-side (the `cuid()`-defaulted columns have no DB default).
"""

from __future__ import annotations

import os
import secrets
from contextlib import contextmanager
from typing import Iterator

import psycopg


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set (see crawler/.env.example)")
    # psycopg doesn't understand Prisma's ?schema= param; strip it.
    return url.split("?", 1)[0]


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(database_url())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def gen_id(prefix: str = "c") -> str:
    """A compact, collision-resistant id (cuid-shaped enough for our needs)."""
    return prefix + secrets.token_hex(12)
