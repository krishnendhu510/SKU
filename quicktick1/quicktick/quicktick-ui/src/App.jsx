import { useState, useEffect } from "react";

const tickets = [
  {
    id: 1,
    event: "Coldplay – Music of the Spheres",
    venue: "DY Patil Stadium, Mumbai",
    seller: "Rahul M.",
    seat: "Block C, Row 12, Seat 4",
    originalPrice: 5000,
    listedPrice: 7500,
    eventTime: Date.now() + 2.8 * 60 * 60 * 1000,
    genre: "Concert",
    sellerScore: 91,
  },
  {
    id: 2,
    event: "Mumbai Indians vs CSK – IPL",
    venue: "Wankhede Stadium, Mumbai",
    seller: "Priya S.",
    seat: "Stand E, Row 5, Seat 9",
    originalPrice: 3000,
    listedPrice: 4200,
    eventTime: Date.now() + 4.1 * 60 * 60 * 1000,
    genre: "Cricket",
    sellerScore: 78,
  },
  {
    id: 3,
    event: "Mumbai → Pune — Deccan Express",
    venue: "CSMT Mumbai → Pune Junction",
    seller: "Vikram T.",
    seat: "Coach B4, Seat 32 — 2AC",
    originalPrice: 850,
    listedPrice: 1100,
    eventTime: Date.now() + 1.5 * 60 * 60 * 1000,
    genre: "Train",
    sellerScore: 88,
  },
  {
    id: 4,
    event: "Mumbai → Delhi — IndiGo 6E 204",
    venue: "BOM Terminal 2 → DEL T3",
    seller: "Sneha R.",
    seat: "Seat 14A — Economy",
    originalPrice: 6500,
    listedPrice: 9200,
    eventTime: Date.now() + 3.2 * 60 * 60 * 1000,
    genre: "Flight",
    sellerScore: 94,
  },
  {
    id: 5,
    event: "Avengers: Secret Wars – IMAX",
    venue: "PVR IMAX, Phoenix Mall, Mumbai",
    seller: "Karan M.",
    seat: "Row G, Seat 14 — IMAX",
    originalPrice: 450,
    listedPrice: 600,
    eventTime: Date.now() + 2.1 * 60 * 60 * 1000,
    genre: "Movie",
    sellerScore: 80,
  },
  {
    id: 6,
    event: "Mumbai → Goa — Neeta Volvo AC",
    venue: "Dadar Bus Depot → Panaji",
    seller: "Anjali S.",
    seat: "Seat 9 — Sleeper",
    originalPrice: 700,
    listedPrice: 950,
    eventTime: Date.now() + 4.8 * 60 * 60 * 1000,
    genre: "Bus",
    sellerScore: 76,
  },
];

function useCountdown(targetTime) {
  const [remaining, setRemaining] = useState(targetTime - Date.now());
  useEffect(() => {
    const t = setInterval(() => setRemaining(targetTime - Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetTime]);
  const hrs = Math.max(0, Math.floor(remaining / 3600000));
  const mins = Math.max(0, Math.floor((remaining % 3600000) / 60000));
  const secs = Math.max(0, Math.floor((remaining % 60000) / 1000));
  return { hrs, mins, secs, totalMs: remaining };
}

async function fetchRescuePrice(ticket) {
  try {
    const res = await fetch("http://localhost:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        genre:          ticket.genre,
        popularity:     "high",
        hours_left:     (ticket.eventTime - Date.now()) / 3600000,
        original_price: ticket.originalPrice,
        seat_quality:   2,
        seller_score:   ticket.sellerScore,
        day_of_week:    new Date().getDay(),
        listed_price:   ticket.listedPrice,
      }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

function AlertBadge({ label, color }) {
  const colors = {
    red: "bg-red-500/20 text-red-300 border-red-500/40",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${colors[color]}`}>
      {label}
    </span>
  );
}

function Countdown({ eventTime }) {
  const { hrs, mins, secs, totalMs } = useCountdown(eventTime);
  const urgency = totalMs < 2 * 3600000 ? "red" : totalMs < 4 * 3600000 ? "amber" : "green";
  const colors = { red: "text-red-400", amber: "text-amber-400", green: "text-emerald-400" };
  return (
    <div className={`font-mono text-lg font-bold tabular-nums ${colors[urgency]}`}>
      {String(hrs).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </div>
  );
}

function NearbyBuyers({ count }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full border-2 border-[#0f1117] flex items-center justify-center text-[9px] font-bold"
            style={{ background: `hsl(${i * 60 + 180}, 60%, 50%)` }}
          >
            {["A","B","K","R","S"][i]}
          </div>
        ))}
      </div>
      <span className="text-xs text-slate-400">{count} nearby buyers alerted</span>
    </div>
  );
}

function TicketCard({ ticket, onRescue }) {
  const [aiData, setAiData] = useState(null);
  const hoursLeft = (ticket.eventTime - Date.now()) / 3600000;
  const urgency = hoursLeft < 2 ? "red" : hoursLeft < 4 ? "amber" : "green";
  const urgencyLabel = aiData?.urgency || (hoursLeft < 2 ? "CRITICAL" : hoursLeft < 4 ? "URGENT" : "ACTIVE");
  const rescuePrice = aiData?.rescue_price || Math.round(ticket.listedPrice * 0.7 / 100) * 100;
  const savings = aiData?.savings || (ticket.listedPrice - rescuePrice);

  useEffect(() => {
    fetchRescuePrice(ticket).then(setAiData);
  }, []);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden group hover:border-white/20 transition-all duration-300">
      {/* Top accent bar */}
      <div className={`h-1 w-full ${urgency === "red" ? "bg-red-500" : urgency === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertBadge label={urgencyLabel} color={urgency} />
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">{ticket.genre}</span>
            </div>
            <h3 className="text-white font-bold text-base leading-tight">{ticket.event}</h3>
            <p className="text-slate-400 text-xs mt-0.5">{ticket.venue}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="text-[10px] text-slate-500 mb-0.5">TIME LEFT</div>
            <Countdown eventTime={ticket.eventTime} />
          </div>
        </div>

        {/* Seat info */}
        <div className="flex items-center gap-2 mb-4 text-xs text-slate-400">
          <span>🎟</span>
          <span>{ticket.seat}</span>
          <span className="text-slate-600">•</span>
          <span>Seller: {ticket.seller}</span>
          <span className="ml-auto text-emerald-400 font-semibold">Trust {ticket.sellerScore}/100</span>
        </div>

        {/* AI Price Box */}
        <div className="rounded-xl bg-[#0d1520] border border-white/8 p-4 mb-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />
            AI Rescue Engine
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-slate-500 mb-1">LISTED PRICE</div>
              <div className="text-slate-400 font-mono font-semibold text-sm line-through">₹{ticket.listedPrice.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-1">AI QUICK PRICE</div>
              <div className="text-cyan-400 font-mono font-bold text-lg">₹{rescuePrice.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-1">BUYER SAVES</div>
              <div className="text-emerald-400 font-mono font-bold text-sm">₹{savings.toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-3 bg-white/5 rounded-lg px-3 py-2 text-[11px] text-slate-300">
            💡 Price adjusted based on urgency, demand drop-off, and comparable last-minute sales
          </div>
        </div>

        {/* Nearby buyers */}
        <div className="flex items-center justify-between mb-4">
          <NearbyBuyers count={Math.floor(Math.random() * 20 + 8)} />
          <span className="text-[10px] text-slate-500">Within 15km radius</span>
        </div>

        {/* CTA */}
        <button
          onClick={() => onRescue(ticket, rescuePrice)}
          className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 active:scale-95"
        >
          🚀 Activate Last-Minute Rescue
        </button>
      </div>
    </div>
  );
}

function AlertToast({ ticket, rescuePrice, onClose }) {
  const [progress, setProgress] = useState(100);
  useEffect(() => {
    const start = Date.now();
    const duration = 5000;
    const t = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
      if (elapsed >= duration) { clearInterval(t); onClose(); }
    }, 50);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl bg-[#0d1a2a] border border-cyan-500/40 shadow-2xl shadow-cyan-500/20 overflow-hidden animate-[slideIn_0.4s_ease]">
      <div className="h-0.5 bg-white/10">
        <div className="h-full bg-cyan-400 transition-all duration-75" style={{ width: `${progress}%` }} />
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔔</div>
          <div className="flex-1">
            <div className="text-white font-bold text-sm mb-0.5">Rescue Alert Sent!</div>
            <div className="text-slate-300 text-xs">{ticket.event}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-cyan-400 font-bold font-mono">₹{rescuePrice.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">— Nearby buyers notified via FCM</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">×</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [toast, setToast] = useState(null);
  const [rescued, setRescued] = useState({});

  function handleRescue(ticket, rescuePrice) {
    setRescued(r => ({ ...r, [ticket.id]: rescuePrice }));
    setToast({ ticket, rescuePrice });
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-red-400 font-semibold">Live Rescue Feed</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Last-Minute{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Rescue</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-md">
            AI-powered quick-sell pricing for events under 6 hours away. Sellers recover money, buyers get deals — everyone wins.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Tickets Rescued Today", value: "847" },
            { label: "Avg. Buyer Saving", value: "₹1,240" },
            { label: "Rescue Rate", value: "94%" },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white/5 border border-white/8 px-4 py-3 text-center">
              <div className="text-white font-bold text-lg">{s.value}</div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Ticket cards */}
        <div className="space-y-5">
          {tickets.map(t => (
            <TicketCard key={t.id} ticket={t} onRescue={handleRescue} />
          ))}
        </div>

        <p className="text-center text-slate-600 text-xs mt-10">
          Powered by TicketRescue AI · Notifications via Firebase Cloud Messaging
        </p>
      </div>

      {/* Toast */}
      {toast && <AlertToast ticket={toast.ticket} rescuePrice={toast.rescuePrice} onClose={() => setToast(null)} />}
    </div>
  );
}