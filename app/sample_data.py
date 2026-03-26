from __future__ import annotations

from datetime import datetime, timedelta
from random import randint
from typing import List

from .models import PostData, Referrals, Snapshot


def _snapshot(base: int, multiplier: float, note: str = "") -> Snapshot:
    impressions = int(base * multiplier)
    views = int(impressions * 0.72)
    engagements = int(views * 0.16)
    shares = int(views * 0.04)
    saves = int(views * 0.025)
    watch_time = round(views * 0.53, 2)
    retention_rate = round(min(1.0, 0.42 + (multiplier / 5)), 3)
    ctr = round(0.015 + (multiplier / 200), 4)
    follower_gain = int(engagements * 0.09)
    return Snapshot(
        impressions=impressions,
        views=views,
        engagements=engagements,
        shares=shares,
        saves=saves,
        watch_time=watch_time,
        retention_rate=retention_rate,
        ctr=ctr,
        follower_gain=follower_gain,
        note=note,
    )


def _build_post(
    idx: int,
    platform: str,
    property_name: str,
    category: str,
    days_ago: int,
    base: int,
    caption: str,
    tags: List[str],
) -> PostData:
    published_at = datetime.utcnow() - timedelta(days=days_ago, hours=randint(1, 18))
    performance = {
        "30m": _snapshot(base, 0.08),
        "1h": _snapshot(base, 0.12),
        "6h": _snapshot(base, 0.42),
        "24h": _snapshot(base, 0.78),
        "final": _snapshot(base, 1.0, "Fictional final metric snapshot"),
    }
    referrals = Referrals(
        home_feed=int(base * 0.43),
        explore=int(base * 0.21),
        search=int(base * 0.11),
        profile_visits=int(base * 0.08),
        external_embeds=int(base * 0.07),
        reposts=int(base * 0.08),
        aggregators=int(base * 0.02),
    )

    return PostData(
        post_id=f"demo-{idx:03}",
        platform=platform,
        url=f"https://example.com/{platform.lower()}/demo-{idx:03}",
        property=property_name,
        category=category,
        tags=tags,
        caption=caption,
        notes="Demo post for prototype analytics",
        published_at=published_at,
        video_duration=95,
        performance=performance,
        referrals=referrals,
    )


def generate_sample_posts() -> List[PostData]:
    seeds = [
        (1, "TikTok", "NBA", "Highlight", 2, 1800000, "Buzzer-beater from downtown.", ["NBA", "clutch", "highlight"]),
        (2, "YouTube", "NFL", "Feature", 3, 1220000, "Mic'd up sideline reactions.", ["NFL", "feature", "sideline"]),
        (3, "Instagram", "MLB", "BTS", 4, 970000, "Clubhouse prep before first pitch.", ["MLB", "BTS", "clubhouse"]),
        (4, "X", "NBA", "Analysis", 8, 530000, "Film room breakdown: pick-and-roll coverages.", ["NBA", "analysis", "defense"]),
        (5, "Facebook", "NHL", "Highlight", 10, 620000, "Top shelf game-winner in overtime.", ["NHL", "highlight", "overtime"]),
        (6, "TikTok", "WNBA", "Feature", 13, 880000, "A day in the life with a rookie guard.", ["WNBA", "feature", "rookie"]),
        (7, "YouTube", "NASCAR", "Recap", 18, 430000, "Pit strategy recap from race weekend.", ["NASCAR", "recap", "strategy"]),
        (8, "Instagram", "NFL", "Highlight", 26, 990000, "One-handed catch from warmups.", ["NFL", "highlight", "receiver"]),
        (9, "X", "MLB", "Feature", 31, 350000, "Prospect spotlight and scouting notes.", ["MLB", "prospect", "feature"]),
        (10, "Snap", "NBA", "BTS", 35, 280000, "Tunnel fits before tip-off.", ["NBA", "BTS", "fashion"]),
        (11, "TikTok", "NFL", "Highlight", 39, 520000, "Special teams touchdown return.", ["NFL", "special-teams", "highlight"]),
    ]
    return [_build_post(*seed) for seed in seeds]
