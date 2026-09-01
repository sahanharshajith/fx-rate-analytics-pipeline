import Dashboard from "@/components/Dashboard";

const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default async function Home() {
  let rates = [];
  let volatility = [];
  let anomalies = [];
  let performance = [];
  let summary = { total_pairs: 0, latest_date: null, total_anomalies: 0, pairs: [] };

  try {
    const [r, v, a, p, s] = await Promise.all([
      fetch(`${API}/api/rates`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API}/api/volatility?base_currency=USD&target_currency=EUR&days=30`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API}/api/anomalies`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API}/api/performance`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API}/api/summary`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
    ]);
    rates = r || [];
    volatility = v || [];
    anomalies = a || [];
    performance = p || [];
    if (s) summary = s;
  } catch (err) {
    console.error("Failed to fetch initial dashboard data from backend:", err);
  }

  return (
    <Dashboard
      rates={rates}
      volatility={volatility}
      anomalies={anomalies}
      performance={performance}
      summary={summary}
    />
  );
}