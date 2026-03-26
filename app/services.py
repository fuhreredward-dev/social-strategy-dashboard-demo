from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

from .models import PERFORMANCE_POINTS, PostData


def _period_range(period: str, start_date: datetime | None, end_date: datetime | None) -> Tuple[datetime, datetime]:
    now = datetime.utcnow()

    if period == "last_week":
        end = now - timedelta(days=7)
        start = end - timedelta(days=7)
        return start, end
    if period == "this_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if period == "last_month":
        first_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = first_this_month
        start = (first_this_month - timedelta(days=1)).replace(day=1)
        return start, end
    if period == "custom" and start_date and end_date:
        return start_date, end_date

    start = now - timedelta(days=7)
    return start, now


def filter_posts_by_period(posts: List[PostData], period: str, start_date: datetime | None, end_date: datetime | None) -> List[PostData]:
    start, end = _period_range(period, start_date, end_date)
    return [post for post in posts if start <= post.published_at <= end]


def _safe_div(numerator: float, denominator: float) -> float:
    return round(numerator / denominator, 6) if denominator else 0.0


def post_derived_metrics(post: PostData) -> Dict[str, float]:
    final = post.performance["final"]
    snap_24h = post.performance["24h"]
    snap_1h = post.performance["1h"]

    engagement_rate = _safe_div(final.engagements, final.impressions)
    shares_per_1k_views = _safe_div(final.shares, final.views) * 1000
    saves_per_1k_views = _safe_div(final.saves, final.views) * 1000
    retention_percent = _safe_div(final.watch_time, max(post.video_duration, 1))
    velocity_24h = (snap_24h.impressions - snap_1h.impressions) / 23 if snap_24h.impressions >= snap_1h.impressions else 0

    return {
        "engagement_rate": round(engagement_rate, 4),
        "shares_per_1k_views": round(shares_per_1k_views, 2),
        "saves_per_1k_views": round(saves_per_1k_views, 2),
        "retention_percent": round(retention_percent, 4),
        "velocity_24h": round(velocity_24h, 2),
    }


def _sum_final(posts: List[PostData], field: str) -> float:
    return float(sum(getattr(post.performance["final"], field) for post in posts))


def dashboard_summary(posts_current: List[PostData], posts_previous: List[PostData]) -> Dict:
    total_impressions = _sum_final(posts_current, "impressions")
    prev_impressions = _sum_final(posts_previous, "impressions")
    period_change = ((_safe_div(total_impressions - prev_impressions, prev_impressions)) * 100) if prev_impressions else 0.0

    engagement_rate = _safe_div(_sum_final(posts_current, "engagements"), max(total_impressions, 1))
    avg_watch_time = _safe_div(_sum_final(posts_current, "watch_time"), max(len(posts_current), 1))
    share_rate = _safe_div(_sum_final(posts_current, "shares"), max(_sum_final(posts_current, "views"), 1))
    save_rate = _safe_div(_sum_final(posts_current, "saves"), max(_sum_final(posts_current, "views"), 1))

    grouped_platform = defaultdict(list)
    grouped_property = defaultdict(list)
    grouped_category = defaultdict(list)
    for post in posts_current:
        grouped_platform[post.platform].append(post)
        grouped_property[post.property].append(post)
        grouped_category[post.category].append(post)

    top_platform = max(grouped_platform.items(), key=lambda kv: _sum_final(kv[1], "impressions"), default=("-", []))
    top_property = max(grouped_property.items(), key=lambda kv: _sum_final(kv[1], "impressions"), default=("-", []))
    top_category = max(grouped_category.items(), key=lambda kv: _sum_final(kv[1], "impressions"), default=("-", []))

    properties_rank = [
        {
            "property": name,
            "impressions": _sum_final(items, "impressions"),
            "engagement_rate": _safe_div(_sum_final(items, "engagements"), max(_sum_final(items, "impressions"), 1)),
            "avg_24h_impressions": _safe_div(sum(item.performance["24h"].impressions for item in items), len(items)),
        }
        for name, items in sorted(grouped_property.items(), key=lambda kv: _sum_final(kv[1], "impressions"), reverse=True)
    ]

    platforms_rank = [
        {
            "platform": name,
            "impressions": _sum_final(items, "impressions"),
            "engagement_rate": _safe_div(_sum_final(items, "engagements"), max(_sum_final(items, "impressions"), 1)),
            "avg_watch_time": _safe_div(_sum_final(items, "watch_time"), len(items)),
            "avg_24h_impressions": _safe_div(sum(item.performance["24h"].impressions for item in items), len(items)),
        }
        for name, items in sorted(grouped_platform.items(), key=lambda kv: _sum_final(kv[1], "impressions"), reverse=True)
    ]

    views = _sum_final(posts_current, "views")
    engagements = _sum_final(posts_current, "engagements")
    clicks = sum(post.performance["final"].ctr * post.performance["final"].views for post in posts_current)
    follows = _sum_final(posts_current, "follower_gain")

    funnel = {
        "views": views,
        "engagements": engagements,
        "clicks": round(clicks, 2),
        "follows": follows,
        "engage_rate": _safe_div(engagements, max(views, 1)),
        "click_rate": _safe_div(clicks, max(engagements, 1)),
        "follow_rate": _safe_div(follows, max(clicks, 1)),
    }

    kpis = {
        "engagement_rate": round(engagement_rate, 4),
        "view_through_rate": round(_safe_div(views, max(total_impressions, 1)), 4),
        "avg_watch_time": round(avg_watch_time, 2),
        "ctr": round(_safe_div(clicks, max(views, 1)), 4),
        "shares_to_views": round(share_rate, 4),
        "saves_to_views": round(save_rate, 4),
        "posts_above_benchmark": round(_safe_div(len([p for p in posts_current if post_derived_metrics(p)["engagement_rate"] > 0.12]), max(len(posts_current), 1)), 4),
        "follower_change": int(follows),
    }

    return {
        "total_impressions": total_impressions,
        "period_change_percent": round(period_change, 2),
        "engagement_rate": round(engagement_rate, 4),
        "avg_watch_time": round(avg_watch_time, 2),
        "share_rate": round(share_rate, 4),
        "save_rate": round(save_rate, 4),
        "top_platform": {
            "name": top_platform[0],
            "avg_24h_per_post": round(_safe_div(sum(post.performance["24h"].impressions for post in top_platform[1]), len(top_platform[1])), 2) if top_platform[1] else 0,
            "avg_engagement_rate": round(_safe_div(_sum_final(top_platform[1], "engagements"), max(_sum_final(top_platform[1], "impressions"), 1)), 4) if top_platform[1] else 0,
        },
        "top_property": {
            "name": top_property[0],
            "impressions": _sum_final(top_property[1], "impressions"),
            "engagement_rate": round(_safe_div(_sum_final(top_property[1], "engagements"), max(_sum_final(top_property[1], "impressions"), 1)), 4) if top_property[1] else 0,
            "share_rate": round(_safe_div(_sum_final(top_property[1], "shares"), max(_sum_final(top_property[1], "views"), 1)), 4) if top_property[1] else 0,
        },
        "top_category": {
            "name": top_category[0],
            "impressions": _sum_final(top_category[1], "impressions"),
            "post_count": len(top_category[1]),
            "performance_vs_avg": round(_safe_div(_sum_final(top_category[1], "impressions"), max(total_impressions, 1)), 4),
        },
        "properties_ranking": properties_rank,
        "platforms_ranking": platforms_rank,
        "funnel": funnel,
        "kpis": kpis,
    }


def top_content(posts: List[PostData], limit: int = 8) -> List[Dict]:
    ordered = sorted(posts, key=lambda item: item.performance["final"].impressions, reverse=True)
    content_cards = []
    for post in ordered[: max(3, min(limit, 10))]:
        curve = [post.performance[point].impressions for point in PERFORMANCE_POINTS]
        final = post.performance["final"]
        metrics = post_derived_metrics(post)
        content_cards.append(
            {
                "post_id": post.post_id,
                "platform": post.platform,
                "property": post.property,
                "category": post.category,
                "tags": post.tags,
                "caption": post.caption,
                "thumbnail": "https://placehold.co/420x240/png",
                "sparkline": curve,
                "final_impressions": final.impressions,
                "share_rate": _safe_div(final.shares, max(final.views, 1)),
                "save_rate": _safe_div(final.saves, max(final.views, 1)),
                "engagement_rate": metrics["engagement_rate"],
            }
        )
    return content_cards


def content_detail(post: PostData, all_posts: List[PostData]) -> Dict:
    benchmark_pool = [p for p in all_posts if p.category == post.category]
    benchmark_sorted = sorted(benchmark_pool, key=lambda p: p.performance["final"].impressions)
    rank = benchmark_sorted.index(post) + 1 if post in benchmark_sorted else len(benchmark_sorted)
    percentile = round((rank / max(len(benchmark_sorted), 1)) * 100, 2)

    related = [
        {
            "post_id": item.post_id,
            "caption": item.caption,
            "platform": item.platform,
            "final_impressions": item.performance["final"].impressions,
        }
        for item in benchmark_pool
        if item.post_id != post.post_id
    ][:4]

    curves = {
        "labels": PERFORMANCE_POINTS,
        "impressions": [post.performance[p].impressions for p in PERFORMANCE_POINTS],
        "engagement_rate": [
            _safe_div(post.performance[p].engagements, max(post.performance[p].impressions, 1)) for p in PERFORMANCE_POINTS
        ],
        "share_velocity": [post.performance[p].shares for p in PERFORMANCE_POINTS],
        "watch_time": [post.performance[p].watch_time for p in PERFORMANCE_POINTS],
    }

    final = post.performance["final"]
    return {
        "post": post.model_dump(mode="json"),
        "platform_metrics": {
            "final_impressions": final.impressions,
            "view_count": final.views,
            "engagement_count": final.engagements,
            "share_count": final.shares,
            "save_count": final.saves,
            "avg_watch_time": final.watch_time,
            "retention": final.retention_rate,
            "clicks": round(final.ctr * final.views, 2),
            "ctr": final.ctr,
            "follower_gain": final.follower_gain,
        },
        "referrals": post.referrals.model_dump(),
        "curves": curves,
        "notes": post.notes,
        "related_posts": related,
        "benchmark": {
            "category": post.category,
            "percentile": percentile,
            "summary": f"Top {percentile}% for this category sample pool",
        },
    }
