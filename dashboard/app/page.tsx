import Dashboard from "@/components/Dashboard";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function Home() {
  const [rates, volatility, anomalies] = await Promise.all([
    fetch(`${API}/api/rates`, { cache: "no-store" }).then((r) => r.json()),
    fetch(`${API}/api/volatility?base_currency=USD&target_currency=EUR`, { cache: "no-store" }).then((r) => r.json()),
    fetch(`${API}/api/anomalies`, { cache: "no-store" }).then((r) => r.json()),
  ]);

  return <Dashboard rates={rates} volatility={volatility} anomalies={anomalies} />;
}