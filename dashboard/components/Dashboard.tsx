"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Bar,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Download,
  Activity,
  Globe,
  DollarSign,
  ShieldAlert,
  Sparkles,
  Layers,
  Search,
  ArrowRightLeft,
  CheckCircle2,
  Zap,
  ArrowUpDown,
} from "lucide-react";
import countryCodesList from "../countryCodes.json";

export type Rate = {
  base_currency: string;
  target_currency: string;
  exchange_rate: number;
  rate_date: string;
  source_api: string;
};

export type VolPoint = {
  rate_date: string;
  exchange_rate: number;
  rolling_7d_avg: number | null;
  rolling_7d_volatility?: number | null;
  volatility_pct?: number | null;
  volume?: number;
};

export type Anomaly = {
  base_currency: string;
  target_currency: string;
  rate_date: string;
  exchange_rate: number;
  anomaly_score: number;
  severity?: "high" | "medium" | "low";
};

export type Performance = {
  base_currency: string;
  target_currency: string;
  month_start: string;
  avg_rate: number;
  mom_change_pct: number | null;
};

export type Summary = {
  total_pairs: number;
  latest_date: string | null;
  total_anomalies: number;
  pairs: string[];
};

type DashboardProps = {
  rates: Rate[];
  volatility: VolPoint[];
  anomalies: Anomaly[];
  performance?: Performance[];
  summary?: Summary;
};

// Map ISO 2-letter code to Country Name directly from countryCodes.json
const COUNTRY_LOOKUP: Record<string, string> = {};
countryCodesList.forEach((c) => {
  if (c.code && c.name) {
    COUNTRY_LOOKUP[c.code.trim().toUpperCase()] = c.name.trim();
  }
});

// Leading major currencies for default 6x2 grid view
const LEADING_CURRENCIES = [
  "EUR", "GBP", "JPY", "CAD", "AUD", "CHF",
  "CNY", "INR", "SGD", "NZD", "BRL", "ZAR"
];

// Helper to resolve metadata directly from countryCodes.json
// Under ISO 4217 standard, the 2-letter country code is the first 2 letters of the 3-letter currency code (e.g., AUD -> AU, JPY -> JP, LKR -> LK, INR -> IN, EUR -> EU)
function getCurrencyCountryMeta(currencyCode: string) {
  const curr = currencyCode.toUpperCase();
  const countryCode = curr === "EUR" ? "EU" : curr.slice(0, 2);
  const countryName = COUNTRY_LOOKUP[countryCode] || curr;

  // Generate Unicode national flag emoji directly from the 2-letter ISO country code
  let flag = "🌐";
  if (countryCode === "EU") {
    flag = "🇪🇺";
  } else if (countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
    const codePoints = countryCode
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    flag = String.fromCodePoint(...codePoints);
  }

  const priorityIndex = LEADING_CURRENCIES.indexOf(curr);
  const priority = priorityIndex !== -1 ? priorityIndex + 1 : 999;

  return { countryCode, countryName, flag, priority };
}

export default function Dashboard({
  rates = [],
  volatility = [],
  anomalies = [],
  performance = [],
  summary,
}: DashboardProps) {
  // Extract all available pairs
  const availablePairs = useMemo(() => {
    if (summary?.pairs && summary.pairs.length > 0) return summary.pairs;
    if (rates.length > 0) {
      const set = new Set(rates.map((r) => `${r.base_currency}/${r.target_currency}`));
      return Array.from(set);
    }
    return ["USD/EUR", "USD/GBP", "USD/JPY", "USD/AUD", "USD/CAD", "USD/CHF"];
  }, [summary, rates]);

  const [selectedPair, setSelectedPair] = useState<string>(availablePairs[0] || "USD/EUR");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "365d">("30d");
  const [chartMode, setChartMode] = useState<"area" | "composed">("area");
  const [showAnomaliesOnChart, setShowAnomaliesOnChart] = useState(true);
  const [volatilityData, setVolatilityData] = useState<VolPoint[]>(volatility);
  const [isFetchingVol, setIsFetchingVol] = useState(false);

  // Quick Currency Selector State (Search)
  const [chipSearch, setChipSearch] = useState("");

  // Table Sorting & Filtering
  const [rateSearch, setRateSearch] = useState("");
  const [rateSortKey, setRateSortKey] = useState<"pair" | "rate" | "date">("pair");
  const [rateSortAsc, setRateSortAsc] = useState(true);
  const [anomalyFilter, setAnomalyFilter] = useState<"all" | "high" | "medium" | "low">("all");

  // Currency Converter State
  const [convertAmount, setConvertAmount] = useState<number>(100);
  const [convertToCurrency, setConvertToCurrency] = useState<string>("EUR");

  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Hydration setup
  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("dark");
    document.documentElement.style.background = "#080d19";
    const update = () => setCurrentTime(new Date().toLocaleString());
    update();
    const timer = setInterval(update, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch volatility data dynamically when pair or timeRange changes
  const fetchPairVolatility = useCallback(async (pair: string, range: string) => {
    const [base, target] = pair.split("/");
    if (!base || !target) return;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;

    setIsFetchingVol(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(
        `${apiUrl}/api/volatility?base_currency=${base}&target_currency=${target}&days=${days}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setVolatilityData(data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch pair volatility:", err);
    } finally {
      setIsFetchingVol(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchPairVolatility(selectedPair, timeRange);
    }
  }, [selectedPair, timeRange, mounted, fetchPairVolatility]);

  // Current pair stats calculation
  const pairStats = useMemo(() => {
    const pairRate = rates.find((r) => `${r.base_currency}/${r.target_currency}` === selectedPair);
    const currentSpot = pairRate?.exchange_rate ?? volatilityData[volatilityData.length - 1]?.exchange_rate ?? 0;
    const firstSpot = volatilityData[0]?.exchange_rate ?? currentSpot;
    const changePct = firstSpot > 0 ? ((currentSpot - firstSpot) / firstSpot) * 100 : 0;

    const ratesInWindow = volatilityData.map((d) => d.exchange_rate).filter(Boolean);
    const minVal = ratesInWindow.length > 0 ? Math.min(...ratesInWindow) : 0;
    const maxVal = ratesInWindow.length > 0 ? Math.max(...ratesInWindow) : 0;
    const avgVal = ratesInWindow.length > 0 ? ratesInWindow.reduce((a, b) => a + b, 0) / ratesInWindow.length : 0;
    const lastVolPct = volatilityData[volatilityData.length - 1]?.volatility_pct ?? 0;

    return {
      spot: currentSpot,
      changePct,
      min: minVal,
      max: maxVal,
      avg: avgVal,
      volPct: lastVolPct,
      source: pairRate?.source_api || "Pipeline",
      date: pairRate?.rate_date || volatilityData[volatilityData.length - 1]?.rate_date || "Live",
    };
  }, [rates, selectedPair, volatilityData]);

  // Currency Selector Chips (6 per row × 2 rows = 12 items) using countryCodes.json
  const filteredCurrencyChips = useMemo(() => {
    const q = chipSearch.trim().toLowerCase();

    // Map all available pairs with country metadata from countryCodes.json
    const items = availablePairs.map((pair) => {
      const [, target] = pair.split("/");
      const meta = getCurrencyCountryMeta(target);
      const rateObj = rates.find((r) => `${r.base_currency}/${r.target_currency}` === pair);
      return {
        pair,
        target,
        country: meta.countryName,
        flag: meta.flag,
        priority: meta.priority,
        rate: rateObj?.exchange_rate ?? 0,
      };
    });

    // Filter by search query if present (matching currency code, country name, or ISO code)
    let filtered = items;
    if (q) {
      filtered = items.filter(
        (item) =>
          item.pair.toLowerCase().includes(q) ||
          item.target.toLowerCase().includes(q) ||
          item.country.toLowerCase().includes(q)
      );
    }

    // Sort: Leading economies first (by priority), then alphabetically by country name
    filtered.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.country.localeCompare(b.country);
    });

    // Limit to exactly 12 items (6 in a row × 2 rows)
    return filtered.slice(0, 12);
  }, [availablePairs, chipSearch, rates]);

  // Enhanced Anomalies with Severity tags
  const enhancedAnomalies = useMemo(() => {
    return anomalies.map((a) => {
      const score = Number(a.anomaly_score) || 0;
      let severity: "high" | "medium" | "low" = "low";
      if (score >= 0.7) severity = "high";
      else if (score >= 0.4) severity = "medium";
      return { ...a, anomaly_score: score, severity };
    });
  }, [anomalies]);

  // Filtered Anomalies
  const filteredAnomalies = useMemo(() => {
    if (anomalyFilter === "all") return enhancedAnomalies;
    return enhancedAnomalies.filter((a) => a.severity === anomalyFilter);
  }, [enhancedAnomalies, anomalyFilter]);

  // Search & Sorted Rates Table
  const displayRates = useMemo(() => {
    let list = rates.filter((r) => {
      const pair = `${r.base_currency}/${r.target_currency}`.toLowerCase();
      const meta = getCurrencyCountryMeta(r.target_currency);
      const country = meta.countryName.toLowerCase();
      const q = rateSearch.toLowerCase();
      return pair.includes(q) || country.includes(q) || r.source_api.toLowerCase().includes(q);
    });

    list.sort((a, b) => {
      if (rateSortKey === "pair") {
        const pairA = `${a.base_currency}/${a.target_currency}`;
        const pairB = `${b.base_currency}/${b.target_currency}`;
        return rateSortAsc ? pairA.localeCompare(pairB) : pairB.localeCompare(pairA);
      }
      if (rateSortKey === "rate") {
        return rateSortAsc ? a.exchange_rate - b.exchange_rate : b.exchange_rate - a.exchange_rate;
      }
      if (rateSortKey === "date") {
        return rateSortAsc ? a.rate_date.localeCompare(b.rate_date) : b.rate_date.localeCompare(a.rate_date);
      }
      return 0;
    });

    return list;
  }, [rates, rateSearch, rateSortKey, rateSortAsc]);

  // Currency Converter calculation
  const convertedValue = useMemo(() => {
    const targetRate = rates.find((r) => r.target_currency === convertToCurrency)?.exchange_rate;
    if (!targetRate) return null;
    return (convertAmount * targetRate).toFixed(4);
  }, [rates, convertAmount, convertToCurrency]);

  // CSV Export Handler
  const exportCSV = () => {
    if (volatilityData.length === 0) return;
    const headers = "Date,Pair,ExchangeRate,Rolling7dAvg,VolatilityPct\n";
    const rows = volatilityData
      .map(
        (v) =>
          `${v.rate_date},${selectedPair},${v.exchange_rate},${v.rolling_7d_avg ?? ""},${v.volatility_pct ?? ""}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `fx_volatility_${selectedPair.replace("/", "_")}_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen w-full bg-[#080d19] p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400 animate-pulse">
          <Activity className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium tracking-wide">Initializing FX Cockpit...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#080d19] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-cyan-500 selection:text-white">
      <div className="w-full max-w-[1720px] mx-auto space-y-6">
        {/* TOP BAR / SYSTEM STATUS */}
        <header className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    FX RATE ANALYTICS
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Terminal v2.0
                    </span>
                  </h1>
                </div>
              </div>
            </div>

            {/* Status Pills & Actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>MSSQL Synced</span>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-semibold text-white">{enhancedAnomalies.length}</span>
                <span className="text-slate-400">Anomalies</span>
              </div>

              <button
                onClick={() => fetchPairVolatility(selectedPair, timeRange)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-medium transition-all cursor-pointer active:scale-95"
                title="Refresh current pair data"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isFetchingVol ? "animate-spin text-cyan-400" : ""}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95"
                title="Download CSV for current chart range"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* QUICK CURRENCY SELECTOR (6 in a row × 2 rows directly from countryCodes.json) */}
          <div className="mt-5 pt-4 border-t border-slate-800/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Quick Currency Selector
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (Showing leading economies • Search to view any country)
                </span>
              </div>

              {/* Currency Selector Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search country or currency (e.g. Japan, EUR, India)..."
                  value={chipSearch}
                  onChange={(e) => setChipSearch(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans transition-colors"
                />
              </div>
            </div>

            {/* Exactly 6 in a row and 2 rows (12 cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {filteredCurrencyChips.map((item) => {
                const isActive = item.pair === selectedPair;
                return (
                  <button
                    key={item.pair}
                    onClick={() => setSelectedPair(item.pair)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                      isActive
                        ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border-cyan-400 text-white shadow-lg shadow-cyan-500/15 scale-[1.02]"
                        : "bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 hover:border-slate-600 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-base">{item.flag}</span>
                      <span
                        className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                          isActive ? "bg-cyan-500 text-white font-mono" : "bg-slate-700/70 text-slate-400 font-mono"
                        }`}
                      >
                        {item.target}
                      </span>
                    </div>

                    <div className="truncate text-xs font-semibold text-slate-200 group-hover:text-white" title={item.country}>
                      {item.country}
                    </div>

                    <div className="mt-1 flex items-baseline justify-between pt-1 border-t border-slate-700/40">
                      <span className="text-[10px] text-slate-400 font-mono">{item.pair}</span>
                      <span className={`text-xs font-bold font-mono ${isActive ? "text-cyan-300" : "text-slate-300"}`}>
                        {item.rate > 0 ? item.rate.toFixed(4) : "—"}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredCurrencyChips.length === 0 && (
                <div className="col-span-full py-4 text-center text-xs text-slate-500">
                  No currencies found matching &quot;{chipSearch}&quot;. Try searching another country or code.
                </div>
              )}
            </div>
          </div>
        </header>

        {/* TOP KPI STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>{selectedPair} Spot Rate</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                {pairStats.spot.toFixed(4)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2">
              <span>Source: <strong className="text-slate-300">{pairStats.source}</strong></span>
              <span className="font-mono text-[11px] text-slate-500">{pairStats.date}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>{timeRange.toUpperCase()} Price Delta</span>
              {pairStats.changePct >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                  pairStats.changePct >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {pairStats.changePct >= 0 ? "+" : ""}
                {pairStats.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2">
              <span>Range: <strong className="text-slate-300 font-mono">{pairStats.min.toFixed(4)} - {pairStats.max.toFixed(4)}</strong></span>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Rolling Volatility</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-300">
                {pairStats.volPct ? `${pairStats.volPct.toFixed(3)}%` : "N/A"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2">
              <span>{timeRange} Mean: <strong className="text-slate-300 font-mono">{pairStats.avg.toFixed(4)}</strong></span>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>ML Outlier Alerts</span>
              <Sparkles className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-rose-400">
                {enhancedAnomalies.length}
              </span>
              <span className="text-xs text-slate-400">Flagged Events</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2">
              <span>Algorithm: <strong className="text-slate-300">Isolation Forest</strong></span>
            </div>
          </div>
        </div>

        {/* MAIN CHART SECTION */}
        <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {selectedPair} Trend & Volatility
                </h2>
                {isFetchingVol && (
                  <span className="text-xs font-mono text-cyan-400 flex items-center gap-1 animate-pulse">
                    <Activity className="w-3.5 h-3.5 animate-spin" /> Fetching...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center p-1 rounded-xl bg-slate-800/90 border border-slate-700/60">
                {(["7d", "30d", "90d", "365d"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      timeRange === r
                        ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex items-center p-1 rounded-xl bg-slate-800/90 border border-slate-700/60">
                <button
                  onClick={() => setChartMode("area")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    chartMode === "area"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Area Glow
                </button>
                <button
                  onClick={() => setChartMode("composed")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    chartMode === "composed"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Moving Avg
                </button>
              </div>

              <button
                onClick={() => setShowAnomaliesOnChart(!showAnomaliesOnChart)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showAnomaliesOnChart
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-slate-800/80 border-slate-700/60 text-slate-400"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{showAnomaliesOnChart ? "Anomalies On" : "Anomalies Off"}</span>
              </button>
            </div>
          </div>

          <div className="w-full h-[340px] sm:h-[400px] lg:h-[480px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "area" ? (
                <AreaChart data={volatilityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="rate_date"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                    tickFormatter={(str) => {
                      const d = new Date(str);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => Number(v).toFixed(3)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                  />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "12px", paddingTop: "10px" }} />
                  <Area
                    type="monotone"
                    dataKey="exchange_rate"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#rateGradient)"
                    name="Spot Rate"
                  />
                  <Line
                    type="monotone"
                    dataKey="rolling_7d_avg"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    name="7d Moving Average"
                  />
                </AreaChart>
              ) : (
                <ComposedChart data={volatilityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="rate_date"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                    tickFormatter={(str) => {
                      const d = new Date(str);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => Number(v).toFixed(3)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, "auto"]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "12px", paddingTop: "10px" }} />
                  <Bar
                    yAxisId="right"
                    dataKey="volatility_pct"
                    fill="#6366f1"
                    opacity={0.35}
                    name="Volatility %"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="exchange_rate"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={false}
                    name="Spot Rate"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="rolling_7d_avg"
                    stroke="#ec4899"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                    name="7d Moving Average"
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* TWO COLUMN GRID: PERFORMANCE MART & ANOMALY CENTER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: dbt Gold Mart Monthly Performance */}
          <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Monthly Performance Mart (dbt Gold)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Historical monthly average rates & Month-over-Month (MoM) % changes
                </p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Aggregated
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Currency Pair</th>
                    <th className="py-2.5 px-3">Country / Region</th>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3 font-mono">Monthly Avg Rate</th>
                    <th className="py-2.5 px-3">MoM Change %</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-slate-800/60 font-mono">
                  {performance.slice(0, 8).map((p, idx) => {
                    const isPositive = (p.mom_change_pct ?? 0) >= 0;
                    const meta = getCurrencyCountryMeta(p.target_currency);
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-medium text-white flex items-center gap-1.5">
                          <span>{meta.flag}</span>
                          <span>{p.base_currency}/{p.target_currency}</span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{meta.countryName}</td>
                        <td className="py-2.5 px-3 text-slate-300">{p.month_start}</td>
                        <td className="py-2.5 px-3 text-slate-200">{Number(p.avg_rate).toFixed(4)}</td>
                        <td className="py-2.5 px-3">
                          {p.mom_change_pct !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                isPositive
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {Number(p.mom_change_pct).toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">— (Baseline)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {performance.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                        No monthly performance records available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column 3: Live FX Converter Tool */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Live Rate Calculator</h2>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                Instant currency conversion based on latest spot rates
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={convertAmount}
                      onChange={(e) => setConvertAmount(Number(e.target.value) || 0)}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                      min={0}
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">USD</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Convert To
                  </label>
                  <select
                    value={convertToCurrency}
                    onChange={(e) => setConvertToCurrency(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {rates.map((r) => {
                      const meta = getCurrencyCountryMeta(r.target_currency);
                      return (
                        <option key={r.target_currency} value={r.target_currency}>
                          {meta.flag} {meta.countryName} ({r.target_currency} - {r.exchange_rate.toFixed(4)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/90 to-slate-800/40 border border-slate-700/60 mt-4">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">
                    Estimated Value
                  </span>
                  <div className="text-2xl font-black font-mono text-cyan-300">
                    {convertedValue ? `${convertedValue} ${convertToCurrency}` : "N/A"}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    1 USD = {rates.find((r) => r.target_currency === convertToCurrency)?.exchange_rate.toFixed(4) || "..."}{" "}
                    {convertToCurrency}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
              <span>Real-time conversion updated on every run</span>
            </div>
          </div>
        </div>

        {/* AI ANOMALY RADAR SECTION */}
        <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                AI Anomaly & Outlier Radar
              </h2>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/90 border border-slate-700/60">
              {(["all", "high", "medium", "low"] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setAnomalyFilter(sev)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    anomalyFilter === sev
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredAnomalies.map((a, idx) => {
              const meta = getCurrencyCountryMeta(a.target_currency);
              return (
                <div
                  key={idx}
                  className="bg-slate-800/60 border border-slate-700/60 hover:border-rose-500/40 rounded-xl p-3.5 transition-all shadow-md group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <span>{meta.flag}</span>
                      <span>{a.base_currency}/{a.target_currency}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        a.severity === "high"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : a.severity === "medium"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {a.severity}
                    </span>
                  </div>
                  <div className="text-lg font-mono font-bold text-white mb-1">
                    {Number(a.exchange_rate).toFixed(4)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/50">
                    <span>Score: <strong className="text-rose-300">{Number(a.anomaly_score).toFixed(2)}</strong></span>
                    <span className="font-mono text-slate-500">{a.rate_date}</span>
                  </div>
                </div>
              );
            })}
            {filteredAnomalies.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-500 text-xs font-medium">
                No anomalies detected matching filter &quot;{anomalyFilter}&quot;.
              </div>
            )}
          </div>
        </section>

        {/* ALL TRACKED RATES EXPLORER TABLE */}
        <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                Active Currency Pairs Directory
              </h2>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search pair, country, or API..."
                value={rateSearch}
                onChange={(e) => setRateSearch(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                    onClick={() => {
                      setRateSortKey("pair");
                      setRateSortAsc(!rateSortAsc);
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Currency Pair & Country</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 font-mono cursor-pointer hover:text-white transition-colors"
                    onClick={() => {
                      setRateSortKey("rate");
                      setRateSortAsc(!rateSortAsc);
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Latest Spot Rate</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                    onClick={() => {
                      setRateSortKey("date");
                      setRateSortAsc(!rateSortAsc);
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Rate Date</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Ingestion Source API</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y border-slate-800/60 font-mono">
                {displayRates.map((r, idx) => {
                  const pairStr = `${r.base_currency}/${r.target_currency}`;
                  const isSelected = pairStr === selectedPair;
                  const meta = getCurrencyCountryMeta(r.target_currency);
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isSelected ? "bg-cyan-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-sans font-bold text-white flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-cyan-400 animate-pulse" : "bg-slate-600"}`} />
                        <span>{meta.flag}</span>
                        <span>{pairStr}</span>
                        <span className="text-slate-400 font-normal text-xs">({meta.countryName})</span>
                      </td>
                      <td className="py-3 px-4 text-cyan-300 font-bold text-sm">
                        {r.exchange_rate.toFixed(4)}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">{r.rate_date}</td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {r.source_api}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() => setSelectedPair(pairStr)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white transition-all cursor-pointer"
                        >
                          View Trend
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center text-xs text-slate-500 py-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>FX Rate Analytics Pipeline • Automated Orchestration with Apache Airflow</span>
          <span>Last terminal sync: {currentTime}</span>
        </footer>
      </div>
    </div>
  );
}