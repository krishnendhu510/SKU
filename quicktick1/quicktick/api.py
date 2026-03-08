"""
TicketRescue — AI Price API
Serves rescue price predictions over HTTP.

Setup:
  pip install flask flask-cors scikit-learn pandas numpy
  python train_model.py      # creates model.pkl
  python api.py              # starts server on :5000

Endpoint:
  POST /predict
  Body:  { "genre": "Concert", "popularity": "high",
           "hours_left": 2.5, "original_price": 5000,
           "seat_quality": 2, "seller_score": 85, "day_of_week": 6 }
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle, numpy as np

app = Flask(__name__)
CORS(app)   # allows your React frontend to call this API

# ── Load model once at startup ──────────────────────────────
with open("model.pkl", "rb") as f:
    bundle = pickle.load(f)

model    = bundle["model"]
le_genre = bundle["le_genre"]
le_pop   = bundle["le_pop"]
FEATURES = bundle["features"]

VALID_GENRES = list(le_genre.classes_)
VALID_POPS   = list(le_pop.classes_)

# ── Helper ──────────────────────────────────────────────────

def fraud_score(seller_score, hours_left, original_price, listed_price):
    """Simple rule-based fraud/trust scorer (0–100)."""
    score = seller_score  # base
    if listed_price > original_price * 3:
        score -= 25        # extreme markup
    if hours_left < 1:
        score -= 10        # very last-minute can be suspicious
    if seller_score < 50:
        score -= 15
    return max(0, min(100, score))

# ── Routes ──────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)

    # --- Validate inputs ---
    required = ["genre", "popularity", "hours_left",
                "original_price", "seat_quality", "seller_score", "day_of_week"]
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    genre      = data["genre"]
    popularity = data["popularity"]

    if genre not in VALID_GENRES:
        return jsonify({"error": f"genre must be one of {VALID_GENRES}"}), 400
    if popularity not in VALID_POPS:
        return jsonify({"error": f"popularity must be one of {VALID_POPS}"}), 400

    hours_left    = float(data["hours_left"])
    original_px   = float(data["original_price"])
    seat_quality  = int(data["seat_quality"])
    seller_score  = int(data["seller_score"])
    day_of_week   = int(data["day_of_week"])
    listed_price  = float(data.get("listed_price", original_px * 1.5))

    # --- Build feature vector ---
    X = np.array([[
        le_genre.transform([genre])[0],
        le_pop.transform([popularity])[0],
        hours_left,
        original_px,
        seat_quality,
        seller_score,
        day_of_week,
    ]])

    # --- Predict ---
    rescue_price = float(model.predict(X)[0])
    rescue_price = max(200, round(rescue_price / 50) * 50)   # round to ₹50

    savings      = round(listed_price - rescue_price)
    discount_pct = round((savings / listed_price) * 100, 1) if listed_price else 0
    trust        = fraud_score(seller_score, hours_left, original_px, listed_price)

    # Urgency label
    if hours_left <= 1:
        urgency = "CRITICAL"
    elif hours_left <= 3:
        urgency = "URGENT"
    else:
        urgency = "ACTIVE"

    return jsonify({
        "rescue_price":    rescue_price,
        "listed_price":    listed_price,
        "original_price":  original_px,
        "savings":         savings,
        "discount_pct":    discount_pct,
        "trust_score":     trust,
        "urgency":         urgency,
        "hours_left":      hours_left,
        "status":          "overpriced" if listed_price > rescue_price * 1.1 else "fair",
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "GradientBoostingRegressor"})


if __name__ == "__main__":
    print("🚀 TicketRescue AI API running on http://localhost:5000")
    print("   POST /predict  — get rescue price")
    print("   GET  /health   — check server\n")
    app.run(debug=True, port=5000)