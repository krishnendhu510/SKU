# Sadhanam Kayyil Undo? — AI Ticket Reselling Marketplace

An AI-powered ticket reselling marketplace with fraud detection, pricing prediction, and last-minute rescue deals.

## Quick Start

### 1. Backend
```bash
cd backend
npm install
npm start
```
Backend runs on **http://localhost:3001**

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on **http://localhost:5173**

## Features

| Feature | Description |
|---|---|
| **Browse Events** | Search and filter by category, price, date with sorting |
| **AI Recommendations** | Best value, trending, and last-minute deal suggestions |
| **Sell Tickets** | Auth-gated listing with live AI pricing preview |
| **Fraud Detection** | 4-factor scoring: price anomaly, account age, seller history, listing patterns |
| **Fair Pricing** | AI predicts price using category baselines, time decay, demand factors |
| **Last Minute Rescue** | Exponential decay pricing for events within 48 hours |
| **Security** | JWT auth, bcrypt, parameterized queries, Helmet, rate limiting, CORS |

## Tech Stack

- **Frontend**: Vite + Vanilla JS/CSS
- **Backend**: Node.js + Express
- **Database**: SQLite (WAL mode, encrypted fields)
- **Auth**: JWT (access + refresh token rotation)
- **AI**: Rule-based heuristic engines
