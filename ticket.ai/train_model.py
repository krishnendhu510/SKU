import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
import joblib

df = pd.read_csv("data/tickets.csv")
X = df[["event_popularity", "days_before_event", "seat_location", "original_price"]]
y = df["fair_price"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = LinearRegression()
model.fit(X_train, y_train)

predictions = model.predict(X_test)
error = mean_absolute_error(y_test, predictions)
print(f"Model trained! Average price error: {error:.0f}")

joblib.dump(model, "model.pkl")
print("Model saved as model.pkl")
