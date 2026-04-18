from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Spot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    lat: float
    lng: float
    state: str  # "occupied" or "free"
    car_brand: Optional[str] = Field(default=None, nullable=True)
    car_model: Optional[str] = Field(default=None, nullable=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
