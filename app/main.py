from __future__ import annotations

import io
from datetime import datetime
from pathlib import Path
from typing import Dict, List
from uuid import uuid4

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models import AddPostResponse, BulkUploadResponse, PostData, Referrals, Snapshot
from .services import content_detail, dashboard_summary, filter_posts_by_period, top_content
from .storage import PostRepository

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
INDEX_FILE = STATIC_DIR / "index.html"

app = FastAPI(title="Social Strategy Insight Software", version="0.1.0")
repo = PostRepository()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def root() -> FileResponse:
    return FileResponse(str(INDEX_FILE))


def _to_datetime(date_text: str | None) -> datetime | None:
    if not date_text:
        return None
    return datetime.fromisoformat(date_text)


def _coerce_datetime(value: object) -> datetime:
    if value is None:
        raise ValueError("published_at is required")
    parsed = pd.to_datetime(value)
    if pd.isna(parsed):
        raise ValueError("published_at is invalid")
    return parsed.to_pydatetime()


@app.post("/add_post", response_model=AddPostResponse)
def add_post(post: PostData) -> AddPostResponse:
    repo.add(post)
    return AddPostResponse(success=True, post_id=post.post_id)


REQUIRED_COLUMNS = [
    "platform",
    "url",
    "property",
    "category",
    "tags",
    "caption",
    "notes",
    "published_at",
]


@app.post("/bulk_upload", response_model=BulkUploadResponse)
async def bulk_upload(file: UploadFile = File(...)) -> BulkUploadResponse:
    name = file.filename.lower() if file.filename else ""
    raw = await file.read()

    if name.endswith(".csv"):
        frame = pd.read_csv(io.BytesIO(raw))
    elif name.endswith(".xlsx"):
        frame = pd.read_excel(io.BytesIO(raw))
    else:
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported")

    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    errors: List[str] = []
    if missing:
        errors.append(f"Missing required columns: {', '.join(missing)}")

    added_posts: List[PostData] = []
    for row_number, (_, row) in enumerate(frame.iterrows(), start=1):
        try:
            performance = {}
            for point in ["30m", "1h", "6h", "24h", "final"]:
                prefix = f"{point}_"
                performance[point] = Snapshot(
                    impressions=float(row.get(f"{prefix}impressions", 0) or 0),
                    views=float(row.get(f"{prefix}views", 0) or 0),
                    engagements=float(row.get(f"{prefix}engagements", 0) or 0),
                    shares=float(row.get(f"{prefix}shares", 0) or 0),
                    saves=float(row.get(f"{prefix}saves", 0) or 0),
                    watch_time=float(row.get(f"{prefix}watch_time", 0) or 0),
                    retention_rate=float(row.get(f"{prefix}retention_rate", 0) or 0),
                    ctr=float(row.get(f"{prefix}ctr", 0) or 0),
                    follower_gain=float(row.get(f"{prefix}follower_gain", 0) or 0),
                    note=str(row.get(f"{prefix}note", "") or ""),
                )

            post = PostData(
                post_id=str(row.get("post_id", "") or f"bulk-{uuid4().hex[:10]}"),
                platform=str(row.get("platform", "")),
                url=str(row.get("url", "")),
                property=str(row.get("property", "")),
                category=str(row.get("category", "")),
                tags=[tag.strip() for tag in str(row.get("tags", "")).split("|") if tag.strip()],
                caption=str(row.get("caption", "") or ""),
                notes=str(row.get("notes", "") or ""),
                published_at=_coerce_datetime(row.get("published_at")),
                video_duration=float(row.get("video_duration", 90) or 90),
                performance=performance,
                referrals=Referrals(
                    home_feed=float(row.get("home_feed", 0) or 0),
                    explore=float(row.get("explore", 0) or 0),
                    search=float(row.get("search", 0) or 0),
                    profile_visits=float(row.get("profile_visits", 0) or 0),
                    external_embeds=float(row.get("external_embeds", 0) or 0),
                    reposts=float(row.get("reposts", 0) or 0),
                    aggregators=float(row.get("aggregators", 0) or 0),
                ),
            )
            added_posts.append(post)
        except Exception as exc:
            errors.append(f"Row {row_number}: {exc}")

    if added_posts:
        repo.extend(added_posts)

    preview_rows = frame.head(10).fillna("").to_dict(orient="records")
    return BulkUploadResponse(added=len(added_posts), errors=errors, preview_rows=preview_rows)


@app.get("/dashboard_summary")
def get_dashboard_summary(
    period: str = Query("this_week"),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
) -> Dict:
    all_posts = repo.all()
    start = _to_datetime(start_date)
    end = _to_datetime(end_date)

    selected = filter_posts_by_period(all_posts, period, start, end)

    prev_start = None
    prev_end = None
    if start and end:
        window = end - start
        prev_end = start
        prev_start = start - window

    if period == "this_week":
        prev_period = "last_week"
    elif period == "this_month":
        prev_period = "last_month"
    else:
        prev_period = "last_week"

    previous = filter_posts_by_period(all_posts, prev_period, prev_start, prev_end)
    return dashboard_summary(selected, previous)


@app.get("/top_content")
def get_top_content(
    period: str = Query("this_week"),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    limit: int = Query(8),
) -> Dict:
    selected = filter_posts_by_period(repo.all(), period, _to_datetime(start_date), _to_datetime(end_date))
    return {"items": top_content(selected, limit=limit)}


@app.get("/content/{post_id}")
def get_content(post_id: str) -> Dict:
    post = repo.get_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return content_detail(post, repo.all())


@app.get("/platform_summary")
def platform_summary(period: str = Query("this_week")) -> Dict:
    selected = filter_posts_by_period(repo.all(), period, None, None)
    summary = dashboard_summary(selected, [])
    return {"platforms": summary["platforms_ranking"]}


@app.get("/property_summary")
def property_summary(period: str = Query("this_week")) -> Dict:
    selected = filter_posts_by_period(repo.all(), period, None, None)
    summary = dashboard_summary(selected, [])
    return {"properties": summary["properties_ranking"]}
