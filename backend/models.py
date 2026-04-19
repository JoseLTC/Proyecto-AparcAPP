from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

# MODELO DE PLAZAS (SPOTS)
class Spot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    lat: float
    lng: float
    status: str  # "occupied" or "free"
    car_brand: Optional[str] = None
    car_model: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())



# MODELO DE COCHES 
class Car(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    brand: str
    model: str
