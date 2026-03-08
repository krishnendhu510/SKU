from fastapi import FastAPI
import joblib
import numpy as np

app = FastAPI()

# Load trained model
model = joblib.load("fraud_model.pkl")

@app.get("/")
def home():
    return {"message": "Fraud Detection API running"}

@app.post("/predict")
def predict(data: dict):

    features = np.array(data["features"]).reshape(1, -1)

    prediction = model.predict(features)[0]
    probability = model.predict_proba(features)[0][1]

    trust_score = (1 - probability) * 100

    return {
        "fraud_prediction": int(prediction),
        "fraud_probability": float(probability),
        "seller_trust_score": round(trust_score,2)
    }