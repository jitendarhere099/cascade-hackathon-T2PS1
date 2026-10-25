from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional
from backend.app.schemas import Channel


@dataclass(frozen=True)
class SensorDefinition:
    id: str
    channel: Channel
    gateway_id: str
    district: str
    x: float  # Map coordinates 0.0 to 100.0
    y: float
    firmware_group: str


@dataclass(frozen=True)
class GatewayDefinition:
    id: str
    name: str
    districts: List[str]
    sensor_count: int
    x: float
    y: float


@dataclass(frozen=True)
class DistrictDefinition:
    id: str
    name: str
    center_x: float
    center_y: float


@dataclass(frozen=True)
class HospitalDefinition:
    id: str
    name: str
    district: str
    x: float
    y: float


class MeridianCity:
    """
    Fictional city of Meridian (8 million pop, 6 districts, 4 gateways, 3 hospitals).
    Provides static spatial topology, sensor distribution, and gateway routing.
    """

    DISTRICTS: Dict[str, DistrictDefinition] = {
        "D1": DistrictDefinition("D1", "North Waterfront & Port", 30.0, 20.0),
        "D2": DistrictDefinition("D2", "Commercial Core / Midtown", 50.0, 30.0),
        "D3": DistrictDefinition("D3", "West Industrial Basin", 25.0, 55.0),
        "D4": DistrictDefinition("D4", "Central Valley & River Flats", 50.0, 55.0),
        "D5": DistrictDefinition("D5", "East Foothills & Residential", 75.0, 45.0),
        "D6": DistrictDefinition("D6", "South Lowlands & Highway Hub", 60.0, 80.0),
    }

    GATEWAYS: Dict[str, GatewayDefinition] = {
        "GW-A": GatewayDefinition("GW-A", "North Gateway", ["D1", "D2"], 85, 40.0, 25.0),
        "GW-B": GatewayDefinition("GW-B", "West Valley Gateway", ["D3", "D4"], 100, 35.0, 55.0),
        "GW-C": GatewayDefinition("GW-C", "East Slopes Gateway", ["D4", "D5"], 75, 65.0, 50.0),
        "GW-D": GatewayDefinition("GW-D", "South Arterial Gateway", ["D5", "D6"], 90, 70.0, 75.0),
    }

    HOSPITALS: Dict[str, HospitalDefinition] = {
        "H1": HospitalDefinition("H1", "Meridian General Hospital", "D2", 52.0, 32.0),
        "H2": HospitalDefinition("H2", "Valley Medical Center", "D4", 48.0, 58.0),
        "H3": HospitalDefinition("H3", "Eastside Memorial Hospital", "D5", 72.0, 42.0),
    }

    def __init__(self) -> None:
        self.sensors: Dict[str, SensorDefinition] = {}
        self._build_sensor_grid()

    def _build_sensor_grid(self) -> None:
        """Constructs realistic sensor inventory partitioned across gateways and channels."""
        sensor_idx = 1
        for gw_id, gw in self.GATEWAYS.items():
            channels_for_gw = [
                (Channel.DRAINAGE_SENSOR, 30),
                (Channel.TRAFFIC_SENSOR, 30),
                (Channel.POWER_GRID, 10),
                (Channel.CAMERA_FLOOD, 15),
            ]
            for ch, count in channels_for_gw:
                for i in range(count):
                    s_id = f"{gw_id.lower()}-{ch.value[:4]}-{i+1:03d}"
                    dist = gw.districts[i % len(gw.districts)]
                    dist_def = self.DISTRICTS[dist]
                    # Offset slightly around district center
                    dx = ((i * 7) % 15) - 7.5
                    dy = ((i * 11) % 15) - 7.5
                    self.sensors[s_id] = SensorDefinition(
                        id=s_id,
                        channel=ch,
                        gateway_id=gw_id,
                        district=dist,
                        x=dist_def.center_x + dx,
                        y=dist_def.center_y + dy,
                        firmware_group=f"{gw_id}-fw-v{(i % 3) + 1}",
                    )
                    sensor_idx += 1

    def get_sensors_by_gateway(self, gw_id: str) -> List[SensorDefinition]:
        return [s for s in self.sensors.values() if s.gateway_id == gw_id]

    def get_sensors_by_district(self, district: str) -> List[SensorDefinition]:
        return [s for s in self.sensors.values() if s.district == district]

    def get_sensors_by_channel(self, channel: Channel) -> List[SensorDefinition]:
        return [s for s in self.sensors.values() if s.channel == channel]
