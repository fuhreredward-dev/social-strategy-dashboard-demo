from __future__ import annotations

import json
from pathlib import Path
from typing import List

from .models import PostData
from .sample_data import generate_sample_posts

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "posts.json"


class PostRepository:
    def __init__(self) -> None:
        self._posts: List[PostData] = []
        self.load()

    def load(self) -> None:
        if DATA_PATH.exists():
            text = DATA_PATH.read_text(encoding="utf-8").strip()
            if text and text != "[]":
                raw = json.loads(text)
                self._posts = [PostData.model_validate(item) for item in raw]
                return

        self._posts = generate_sample_posts()
        self.save()

    def save(self) -> None:
        DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = [post.model_dump(mode="json") for post in self._posts]
        DATA_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def all(self) -> List[PostData]:
        return self._posts

    def add(self, post: PostData) -> None:
        self._posts.append(post)
        self.save()

    def extend(self, posts: List[PostData]) -> None:
        self._posts.extend(posts)
        self.save()

    def get_by_id(self, post_id: str) -> PostData | None:
        for post in self._posts:
            if post.post_id == post_id:
                return post
        return None
