from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

PERFORMANCE_POINTS = ["30m", "1h", "6h", "24h", "final"]


class Snapshot(BaseModel):
    impressions: float = 0
    views: float = 0
    engagements: float = 0
    shares: float = 0
    saves: float = 0
    watch_time: float = 0
    retention_rate: float = 0
    ctr: float = 0
    follower_gain: float = 0
    note: str = ""


class Referrals(BaseModel):
    home_feed: float = 0
    explore: float = 0
    search: float = 0
    profile_visits: float = 0
    external_embeds: float = 0
    reposts: float = 0
    aggregators: float = 0


class PostData(BaseModel):
    post_id: str
    platform: str
    url: str
    property: str
    category: str
    tags: List[str] = Field(default_factory=list)
    caption: str = ""
    notes: str = ""
    published_at: datetime
    video_duration: float = 1
    performance: Dict[str, Snapshot]
    referrals: Referrals = Field(default_factory=Referrals)

    @field_validator("performance")
    @classmethod
    def validate_performance_keys(cls, value: Dict[str, Snapshot]) -> Dict[str, Snapshot]:
        missing = [point for point in PERFORMANCE_POINTS if point not in value]
        if missing:
            raise ValueError(f"Missing performance snapshots: {', '.join(missing)}")
        return value


class DashboardPeriod(BaseModel):
    period: str = "this_month"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AddPostResponse(BaseModel):
    success: bool
    post_id: str


class BulkUploadResponse(BaseModel):
    added: int
    errors: List[str]
    preview_rows: List[dict]
