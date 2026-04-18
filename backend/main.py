import json
import asyncio
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, create_engine, select

from models import Spot

DATABASE_URL = "sqlite:///./spots.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

app = FastAPI(title="ParkingShare MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create DB
SQLModel.metadata.create_all(engine)


# -------------------------
# WebSocket Manager
# -------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active_connections:
            self.active_connections.remove(ws)

    async def broadcast(self, message: dict):
        data = json.dumps(message, default=str)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(data)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


# -------------------------
# REST Endpoints
# -------------------------
@app.post("/spots", response_model=Spot)
def create_or_update_spot(spot: Spot):
    with Session(engine) as session:
        stmt = select(Spot)
        spots = session.exec(stmt).all()

        # naive proximity check (within ~10 meters)
        for s in spots:
            if abs(s.lat - spot.lat) < 0.0001 and abs(s.lng - spot.lng) < 0.0001:
                s.state = spot.state
                s.car_brand = spot.car_brand
                s.car_model = spot.car_model
                s.timestamp = datetime.utcnow()

                session.add(s)
                session.commit()
                session.refresh(s)

                asyncio.create_task(
                    manager.broadcast({
                        "type": "spot_updated",
                        "spot": s.model_dump()
                    })
                )
                return s

        session.add(spot)
        session.commit()
        session.refresh(spot)

        asyncio.create_task(
            manager.broadcast({
                "type": "spot_created",
                "spot": spot.model_dump()
            })
        )

        return spot


@app.get("/spots")
def list_spots(lat: Optional[float] = None, lng: Optional[float] = None, radius_m: int = 500):
    with Session(engine) as session:
        stmt = select(Spot)
        spots = session.exec(stmt).all()

        if lat is None or lng is None:
            return spots

        deg_radius = radius_m / 111000  # approx
        filtered = [
            s for s in spots
            if abs(s.lat - lat) <= deg_radius and abs(s.lng - lng) <= deg_radius
        ]
        return filtered


@app.get("/spots/{spot_id}", response_model=Spot)
def get_spot(spot_id: int):
    with Session(engine) as session:
        s = session.get(Spot, spot_id)
        if not s:
            raise HTTPException(status_code=404, detail="Spot not found")
        return s


# -------------------------
# WebSocket
# -------------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(ws)
