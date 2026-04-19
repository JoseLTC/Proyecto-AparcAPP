import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, create_engine, select, Field
from datetime import datetime
from typing import List, Optional
from models import Spot, Car

# ---------------------------------------------------------
# BASE DE DATOS
# ---------------------------------------------------------
DATABASE_URL = "sqlite:///./spots.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

app = FastAPI(title="ApparcApp")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Crear tablas
@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


# ---------------------------------------------------------
# WEBSOCKET MANAGER
# ---------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        data = json.dumps(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(data)
            except WebSocketDisconnect:
                self.disconnect(connection)


manager = ConnectionManager()


# ---------------------------------------------------------
# ENDPOINTS SPOTS
# ---------------------------------------------------------

@app.get("/spots")
async def get_spots():
    with Session(engine) as session:
        spots = session.exec(select(Spot)).all()
        return spots


@app.post("/spots")
async def create_or_update_spot(spot: Spot):
    with Session(engine) as session:
        s = session.get(Spot, spot.id)

        if s:
            s.status = spot.status
            s.timestamp = datetime.utcnow().isoformat()
        else:
            if spot.lat is None or spot.lng is None:
                raise HTTPException(
                    status_code=400,
                    detail="lat and lng are required to create a new spot"
                )

            s = Spot(
                lat=spot.lat,
                lng=spot.lng,
                status=spot.status,
                car_brand=spot.car_brand,
                car_model=spot.car_model,
                timestamp=spot.timestamp
            )
            session.add(s)

        session.commit()
        session.refresh(s)

    asyncio.create_task(
        manager.broadcast({"type": "spot_updated", "spot": s.dict()})
    )

    return s


# ---------------------------------------------------------
# ENDPOINTS MIS COCHES
# ---------------------------------------------------------

@app.get("/cars")
async def list_cars():
    with Session(engine) as session:
        cars = session.exec(select(Car)).all()
        return cars


@app.post("/cars")
async def create_car(car: Car):
    with Session(engine) as session:

        # Normalizar para evitar duplicados por mayúsculas/minúsculas
        brand = car.brand.strip().lower()
        model = car.model.strip().lower()

        existing = session.exec(
            select(Car).where(Car.brand == brand, Car.model == model)
        ).first()

        if existing:
            return existing  # No crear duplicado

        new_car = Car(brand=brand, model=model)
        session.add(new_car)
        session.commit()
        session.refresh(new_car)
        return new_car


@app.delete("/cars/{car_id}")
async def delete_car(car_id: int):
    with Session(engine) as session:
        car = session.get(Car, car_id)
        if not car:
            raise HTTPException(status_code=404, detail="Coche no encontrado")

        session.delete(car)
        session.commit()
        return {"status": "deleted"}


# ---------------------------------------------------------
# WEBSOCKET
# ---------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
