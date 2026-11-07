"""
Deterministic In-Memory & Redis Cache Engine with Freshness SLAs
"""
import time
from typing import Optional, Dict, Any, Tuple
from .models import GatewayRequest

class CacheEntry:
    def __init__(self, key: str, data: Any, ttl_seconds: int):
        self.key = key
        self.data = data
        self.created_at = time.time()
        self.expires_at = self.created_at + ttl_seconds
        self.access_count = 0

class GatewayCache:
    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    @staticmethod
    def build_key(req: GatewayRequest) -> str:
        parts = [
            req.query_category,
            req.device_id or "all",
            req.factory_id or "all",
            req.start_time or "none",
            req.end_time or "none",
            req.aggregation_type or "none",
            req.metric or "none"
        ]
        return f"gw:query:{':'.join(parts)}"

    def get(self, key: str, max_age_seconds: Optional[int] = None) -> Tuple[bool, Optional[Any], float]:
        entry = self._cache.get(key)
        if not entry:
            self.misses += 1
            return False, None, 0.0

        now = time.time()
        age = now - entry.created_at

        if now > entry.expires_at:
            del self._cache[key]
            self.evictions += 1
            self.misses += 1
            return False, None, age

        if max_age_seconds is not None and age > max_age_seconds:
            return False, entry.data, age

        entry.access_count += 1
        self.hits += 1
        return True, entry.data, age

    def set(self, key: str, data: Any, ttl_seconds: int) -> None:
        self._cache[key] = CacheEntry(key, data, ttl_seconds)

    def invalidate(self, prefix: Optional[str] = None) -> int:
        if not prefix:
            count = len(self._cache)
            self._cache.clear()
            return count
        to_del = [k for k in self._cache.keys() if prefix in k]
        for k in to_del:
            del self._cache[k]
        return len(to_del)

    def stats(self) -> Dict[str, Any]:
        total = self.hits + self.misses
        return {
            "size": len(self._cache),
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "hit_rate_pct": round((self.hits / total) * 100, 2) if total > 0 else 0.0
        }
