"""
TicketRescue — AI Price Prediction Model (v2)
Now supports: Concert, Cricket, Football, Festival, Comedy, Theatre,
              Train, Flight, Bus, Movie

Run:  python train_model.py
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import LabelEncoder
import pickle

np.random.seed(42)
N = 4000

genres = [
    "Concert", "Cricket", "Football", "Festival", "Comedy", "Theatre",
    "Train", "Flight", "Bus", "Movie"
]
popularities = ["low", "medium", "high", "viral"]

records = []
for _ in range(N):
    genre        = np.random.choice(genres)
    popularity   = np.random.choice(popularities, p=[0.2, 0.35, 0.3, 0.15])
    hours_left   = np.random.uniform(0.5, 6.0)
    day_of_week  = np.random.randint(0, 7)
    seller_score = np.random.randint(40, 100)

    price_ranges = {
        "Concert":  (500,  8000),
        "Cricket":  (300,  5000),
        "Football": (200,  3000),
        "Festival": (800,  6000),
        "Comedy":   (300,  2000),
        "Theatre":  (400,  3000),
        "Train":    (200,  3000),
        "Flight":   (2000, 20000),
        "Bus":      (100,  1500),
        "Movie":    (100,   800),
    }
    lo, hi       = price_ranges[genre]
    original_px  = np.random.randint(lo, hi)
    seat_quality = np.random.choice([1, 2, 3])

    pop_mult = {"low": 0.6, "medium": 0.85, "high": 1.0, "viral": 1.25}[popularity]

    urgency_factor = {
        "Flight":   0.55,
        "Train":    0.30,
        "Bus":      0.25,
        "Movie":    0.40,
        "Concert":  0.35,
        "Cricket":  0.30,
        "Football": 0.30,
        "Festival": 0.25,
        "Comedy":   0.35,
        "Theatre":  0.30,
    }[genre]

    time_disc  = max(0.3, 1 - (6 - hours_left) / 6 * urgency_factor)
    seat_mult  = {1: 0.75, 2: 1.0, 3: 1.35}[seat_quality]
    weekend    = 1.12 if (day_of_week >= 5 and genre in ["Train","Flight","Bus"]) else (1.08 if day_of_week >= 5 else 1.0)

    fair_price = (
        original_px * pop_mult * time_disc * seat_mult * weekend
        + np.random.normal(0, original_px * 0.04)
    )
    fair_price = max(100, round(fair_price / 50) * 50)

    records.append({
        "genre": genre, "popularity": popularity,
        "hours_left": round(hours_left, 2), "original_price": original_px,
        "seat_quality": seat_quality, "seller_score": seller_score,
        "day_of_week": day_of_week, "fair_price": fair_price,
    })

df = pd.DataFrame(records)
print(f"Dataset: {len(df)} rows")
print(df.groupby("genre")["fair_price"].mean().round(0).to_string())

le_genre = LabelEncoder().fit(genres)
le_pop   = LabelEncoder().fit(popularities)
df["genre_enc"]      = le_genre.transform(df["genre"])
df["popularity_enc"] = le_pop.transform(df["popularity"])

FEATURES = ["genre_enc","popularity_enc","hours_left","original_price","seat_quality","seller_score","day_of_week"]
X_train, X_test, y_train, y_test = train_test_split(df[FEATURES], df["fair_price"], test_size=0.2, random_state=42)

model = GradientBoostingRegressor(n_estimators=300, max_depth=5, learning_rate=0.08, subsample=0.85, random_state=42)
model.fit(X_train, y_train)

mae = mean_absolute_error(y_test, model.predict(X_test))
print(f"\n✅ Model trained — MAE: ₹{mae:.0f}")
for feat, imp in sorted(zip(FEATURES, model.feature_importances_), key=lambda x: -x[1]):
    print(f"  {feat:22s}  {imp:.3f}")

with open("model.pkl", "wb") as f:
    pickle.dump({"model": model, "le_genre": le_genre, "le_pop": le_pop, "features": FEATURES, "genres": genres}, f)

print("\n✅ Saved → model.pkl")
print("   Supported:", ", ".join(genres))