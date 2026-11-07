"""
Edge and Cloud MongoDB Compatible Storage Simulator with Indexing and Query Operators
"""
import time
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from .models import SensorRecord, DeviceInfo, GatewayRequest

class DatabaseStore:
    def __init__(self):
        self.devices: Dict[str, DeviceInfo] = {}
        self.edge_records: List[SensorRecord] = []
        self.cloud_records: List[SensorRecord] = []
        self._seed_data()

    def _seed_data(self):
        now = datetime.now(timezone.utc)
        edge_cutoff = now - timedelta(hours=24)

        dev_data = [
            ("DEV-CNC-001", "FAC-01", "vibration", "Siemens Sinumerik Pro", "Hall A - Milling Cell"),
            ("DEV-CNC-002", "FAC-01", "vibration", "Mazak Multi-Axis", "Hall A - Finishing Cell"),
            ("DEV-ROBOT-001", "FAC-01", "thermal", "KUKA KR Quantec", "Hall B - Weld Line"),
            ("DEV-ROBOT-002", "FAC-01", "thermal", "ABB IRB 6700", "Hall B - Paint Cell"),
            ("DEV-FURNACE-001", "FAC-02", "thermal", "Ipsen Vacuum Kiln", "Plant 2 - Heat Treatment"),
            ("DEV-PRESS-001", "FAC-02", "hydraulic", "Schuler 2000T Stamping", "Plant 2 - Press Line A"),
            ("DEV-PRESS-002", "FAC-02", "hydraulic", "Komatsu Heavy Hydraulic", "Plant 2 - Press Line B"),
            ("DEV-PACK-001", "FAC-03", "environmental", "Tetra Pak High-Speed Case", "Facility 3 - Packaging Line 1"),
            ("DEV-CONV-001", "FAC-03", "vibration", "Interroll Roller Sorter", "Facility 3 - Sorting Hub"),
            ("DEV-PUMP-001", "FAC-03", "hydraulic", "Grundfos Cryogenic Feed", "Facility 3 - Cooling Station")
        ]

        for d_id, f_id, s_type, model, loc in dev_data:
            self.devices[d_id] = DeviceInfo(
                device_id=d_id,
                factory_id=f_id,
                sensor_type=s_type,
                model=model,
                location=loc,
                last_seen=now.isoformat()
            )

        points = 250
        statuses = ["nominal", "nominal", "nominal", "warning", "idle"]

        for d_id, f_id, s_type, _, loc in dev_data:
            for i in range(points):
                t_diff_hours = (i / points) * (30 * 24)
                rec_dt = now - timedelta(hours=t_diff_hours)
                temp_base = 75.0 if s_type == "thermal" else 30.0
                vib_base = 2.5 if s_type == "vibration" else 0.8
                press_base = 140.0 if s_type == "hydraulic" else 1.0

                record = SensorRecord(
                    id=f"rec-{d_id}-{i}",
                    device_id=d_id,
                    factory_id=f_id,
                    sensor_type=s_type,
                    timestamp=rec_dt.isoformat(),
                    temperature=round(temp_base + math.sin(i / 10.0) * 5.0, 1),
                    humidity=round(45.0 + math.cos(i / 8.0) * 10.0, 1),
                    vibration=round(max(0.1, vib_base + math.sin(i / 5.0) * 0.8), 2),
                    pressure=round(max(0.5, press_base + math.sin(i / 7.0) * 4.0), 1),
                    machine_status=statuses[i % len(statuses)],
                    location=loc
                )
                self.cloud_records.append(record)
                if rec_dt >= edge_cutoff:
                    self.edge_records.append(record)

    def is_edge_eligible(self, req: GatewayRequest, edge_max_age_hours: int) -> Tuple[bool, Optional[str]]:
        if req.query_category in ["deep_history", "cloud_analytics"]:
            return False, "Deep historical queries (>24h) exist solely in cloud warehouse"
        if req.device_id and req.device_id not in self.devices:
            return False, f"Device {req.device_id} not indexed in edge cluster"
        if req.start_time:
            try:
                st = datetime.fromisoformat(req.start_time.replace("Z", "+00:00"))
                cutoff = datetime.now(timezone.utc) - timedelta(hours=edge_max_age_hours)
                if st < cutoff:
                    return False, f"Requested start time precedes edge {edge_max_age_hours}h retention"
            except Exception:
                pass
        return True, None

    def query_edge(self, req: GatewayRequest) -> Tuple[Any, float, int]:
        t0 = time.perf_counter()
        filtered = self._filter_records(self.edge_records, req)
        res = self._format_result(filtered, req)
        duration_ms = max(1.5, (time.perf_counter() - t0) * 1000.0)
        return res, duration_ms, len(str(res).encode("utf-8"))

    def query_cloud(self, req: GatewayRequest) -> Tuple[Any, float, int]:
        t0 = time.perf_counter()
        filtered = self._filter_records(self.cloud_records, req)
        res = self._format_result(filtered, req)
        duration_ms = max(4.0, (time.perf_counter() - t0) * 1000.0)
        return res, duration_ms, len(str(res).encode("utf-8"))

    def _filter_records(self, dataset: List[SensorRecord], req: GatewayRequest) -> List[SensorRecord]:
        res = dataset
        if req.device_id:
            res = [r for r in res if r.device_id == req.device_id]
        if req.factory_id:
            res = [r for r in res if r.factory_id == req.factory_id]
        return res

    def _format_result(self, filtered: List[SensorRecord], req: GatewayRequest) -> Any:
        if req.query_category == "latest_status":
            return filtered[0].model_dump() if filtered else None
        if req.query_category in ["edge_aggregation", "cloud_analytics"]:
            metric = req.metric or "temperature"
            vals = [getattr(r, metric) for r in filtered if hasattr(r, metric)]
            count = len(vals)
            avg_val = round(sum(vals) / count, 2) if count > 0 else 0.0
            return {
                "metric": metric,
                "count": count,
                "avg": avg_val,
                "max": max(vals) if vals else 0.0,
                "min": min(vals) if vals else 0.0
            }
        return [r.model_dump() for r in filtered[:50]]
