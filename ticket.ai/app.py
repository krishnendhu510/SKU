from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np

model = joblib.load("model.pkl")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class TicketInput(BaseModel):
    event_popularity: float
    days_before_event: float
    seat_location: float
    original_price: float
    listed_price: float

@app.post("/predict")
def predict_price(ticket: TicketInput):
    features = np.array([[
        ticket.event_popularity,
        ticket.days_before_event,
        ticket.seat_location,
        ticket.original_price
    ]])

    predicted_price = model.predict(features)[0]
    predicted_price = round(predicted_price, 2)

    diff_percent = ((ticket.listed_price - predicted_price) / predicted_price) * 100

    if diff_percent > 20:
        status = "Overpriced"
        emoji = "🔴"
    elif diff_percent < -20:
        status = "Great Deal"
        emoji = "🟢"
    else:
        status = "Fair Price"
        emoji = "🟡"

    return {
        "predicted_fair_price": predicted_price,
        "listed_price": ticket.listed_price,
        "difference_percent": round(diff_percent, 1),
        "status": status,
        "emoji": emoji
    }

@app.get("/")
def root():
    return {"message": "Ticket AI API is running!"}