"use client";

import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Bar,
  Legend,
  ComposedChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Filter,
  ArrowUpDown,
  Download,
  RefreshCw,
  Info,
} from "lucide-react";

type Rate = {
  base_currency: string;
  target_currency: string;
  exchange_rate: number;
  rate_date: string;
  source_api: string;
};

type VolPoint = {
  rate_date: string;
  exchange_rate: number;
  rolling_7d_avg: number | null;
  rolling_30d_std?: number | null;
  volume?: number;
};

type Anomaly = {
  base_currency: string;
  target_currency: string;
  rate_date: string;
  exchange_rate: number;
  anomaly_score: number;
  severity?: "high" | "medium" | "low";
};

type DashboardProps = {
  rates: Rate[];
  volatility: VolPoint[];
  anomalies: Anomaly[];
  currencyPairs?: string[];
};

export default function Dashboard({
  rates,
  volatility,
  anomalies,
  currencyPairs = ["USD/EUR", "USD/GBP", "USD/JPY"],
}: DashboardProps) {
  const [selectedPair, setSelectedPair] = useState(currencyPairs[0]);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [chartType, setChartType] = useState<"line" | "composed">("line");
  const [sortBy, setSortBy] = useState<"date" | "rate" | "change">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Handle hydration
  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("dark");
    document.documentElement.style.background = "#0f172a";
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateTime = () => {
    setCurrentTime(new Date().toLocaleString());
  };

  // Compute additional metrics
  const latestRates = useMemo(() => {
    return rates.slice(0, 10).map((r, i) => ({
      ...r,
      change: i < rates.length - 1 ? 
        ((r.exchange_rate - rates[i + 1].exchange_rate) / rates[i + 1].exchange_rate * 100) : 
        0,
    }));
  }, [rates]);

  const stats = useMemo(() => {
    const current = rates[0]?.exchange_rate || 0;
    const previous = rates[rates.length - 1]?.exchange_rate || 0;
    const change = ((current - previous) / previous * 100);
    const avg = rates.reduce((acc, r) => acc + r.exchange_rate, 0) / rates.length;
    const max = Math.max(...rates.map(r => r.exchange_rate));
    const min = Math.min(...rates.map(r => r.exchange_rate));
    
    return { current, previous, change, avg, max, min };
  }, [rates]);

  const filteredVolatility = useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    return volatility.slice(0, days);
  }, [volatility, timeRange]);

  const anomalyData = useMemo(() => {
    return anomalies.map(a => ({
      ...a,
      severity: a.anomaly_score > 0.8 ? "high" : a.anomaly_score > 0.5 ? "medium" : "low",
    }));
  }, [anomalies]);

  const sortedRates = useMemo(() => {
    const sorted = [...latestRates];
    switch (sortBy) {
      case "date":
        sorted.sort((a, b) => sortOrder === "asc" ? 
          a.rate_date.localeCompare(b.rate_date) : 
          b.rate_date.localeCompare(a.rate_date)
        );
        break;
      case "rate":
        sorted.sort((a, b) => sortOrder === "asc" ? 
          a.exchange_rate - b.exchange_rate : 
          b.exchange_rate - a.exchange_rate
        );
        break;
      case "change":
        sorted.sort((a, b) => sortOrder === "asc" ? 
          (a.change || 0) - (b.change || 0) : 
          (b.change || 0) - (a.change || 0)
        );
        break;
    }
    return sorted;
  }, [latestRates, sortBy, sortOrder]);

  if (!mounted) {
    return (
      <div className="min-h-screen w-full bg-slate-900 p-6">
        <div className="max-w-full mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-32 bg-slate-800 rounded-xl mb-6"></div>
            <div className="h-64 bg-slate-800 rounded-xl mb-6"></div>
            <div className="h-96 bg-slate-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-900 p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-[1920px] mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="bg-slate-800 rounded-xl shadow-sm p-4 md:p-6 border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                FX Rate Analytics
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Real-time currency monitoring & anomaly detection
              </p>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <div className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-red-800 bg-red-900/30">
                <AlertTriangle className="w-3 h-3 md:w-4 md:h-4 text-red-400" />
                <span className="text-xs md:text-sm font-medium text-red-400">
                  {anomalies.length} anomalies detected
                </span>
              </div>
              <button className="p-1.5 md:p-2 rounded-lg hover:bg-slate-700 transition-colors">
                <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
              </button>
              <button className="p-1.5 md:p-2 rounded-lg hover:bg-slate-700 transition-colors">
                <Download className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-4 md:mt-6">
            {[
              { label: "Current Rate", value: stats.current.toFixed(4) },
              { 
                label: "24h Change", 
                value: `${stats.change >= 0 ? "+" : ""}${stats.change.toFixed(2)}%`,
                icon: stats.change >= 0 ? TrendingUp : TrendingDown,
                color: stats.change >= 0 ? "text-emerald-400" : "text-red-400"
              },
              { label: "30d Avg", value: stats.avg.toFixed(4) },
              { label: "Range", value: `${stats.min.toFixed(4)} - ${stats.max.toFixed(4)}` },
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-700/50 rounded-lg p-3 md:p-4">
                <p className="text-[10px] md:text-xs font-medium text-slate-400">
                  {item.label}
                </p>
                <p className={`text-base md:text-xl lg:text-2xl font-bold flex items-center gap-1 text-slate-100 ${item.color || ""}`}>
                  {item.icon && <item.icon className="w-4 h-4 md:w-5 md:h-5" />}
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 rounded-xl shadow-sm p-3 md:p-4 border border-slate-700">
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
              <select
                className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedPair}
                onChange={(e) => setSelectedPair(e.target.value)}
              >
                {currencyPairs.map((pair) => (
                  <option key={pair} value={pair}>{pair}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
              {["7d", "30d", "90d"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as any)}
                  className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm transition-colors ${
                    timeRange === range
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 md:gap-2 ml-auto">
              <button
                onClick={() => setShowAnomalies(!showAnomalies)}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm transition-colors ${
                  showAnomalies
                    ? "bg-amber-900/30 text-amber-400 border border-amber-700"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {showAnomalies ? "Hide Anomalies" : "Show Anomalies"}
              </button>
              <button
                onClick={() => setChartType(chartType === "line" ? "composed" : "line")}
                className="px-2 py-1 md:px-3 md:py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs md:text-sm hover:bg-slate-600 transition-colors"
              >
                {chartType === "line" ? "Line View" : "Composed View"}
              </button>
            </div>
          </div>
        </div>

        {/* Chart - Full Width */}
        <div className="bg-slate-800 rounded-xl shadow-sm p-4 md:p-6 border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h2 className="text-base md:text-lg font-semibold text-slate-100">
              {selectedPair} — Price Movement
            </h2>
            <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400">
              <Info className="w-3 h-3 md:w-4 md:h-4" />
              <span>{filteredVolatility.length} data points</span>
            </div>
          </div>
          <div className="w-full h-[300px] sm:h-[350px] md:h-[400px] lg:h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "line" ? (
                <LineChart data={filteredVolatility}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="rate_date"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickFormatter={(str) => new Date(str).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="exchange_rate"
                    stroke="#3b82f6"
                    dot={false}
                    name="Exchange Rate"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="rolling_7d_avg"
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    dot={false}
                    name="7d Moving Average"
                  />
                  {showAnomalies && (
                    <Line
                      type="monotone"
                      dataKey="anomaly_score"
                      stroke="#ef4444"
                      dot={true}
                      name="Anomaly Score"
                      strokeWidth={0}
                      dot={(props: any) => {
                        const { payload } = props;
                        if (payload.anomaly_score > 0.6) {
                          return <AlertTriangle className="w-3 h-3 text-red-500" />;
                        }
                        return null;
                      }}
                    />
                  )}
                </LineChart>
              ) : (
                <ComposedChart data={filteredVolatility}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="rate_date"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickFormatter={(str) => new Date(str).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }} />
                  <Bar
                    dataKey="volume"
                    fill="#60a5fa"
                    opacity={0.3}
                    name="Volume"
                    barSize={20}
                  />
                  <Line
                    type="monotone"
                    dataKey="exchange_rate"
                    stroke="#3b82f6"
                    dot={false}
                    name="Exchange Rate"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="rolling_7d_avg"
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    dot={false}
                    name="7d Moving Average"
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Anomaly markers */}
          {showAnomalies && anomalyData.length > 0 && (
            <div className="mt-4 p-3 rounded-lg border border-red-800 bg-red-900/20">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm font-medium">Recent Anomalies:</span>
              </div>
              <div className="flex flex-wrap gap-1 md:gap-2 mt-2">
                {anomalyData.slice(0, 3).map((a, i) => (
                  <span
                    key={i}
                    className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${
                      a.severity === "high"
                        ? "bg-red-900/40 text-red-300"
                        : a.severity === "medium"
                        ? "bg-yellow-900/40 text-yellow-300"
                        : "bg-blue-900/40 text-blue-300"
                    }`}
                  >
                    {a.rate_date}: {a.exchange_rate.toFixed(4)} (score: {a.anomaly_score.toFixed(2)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Table with sorting - Full Width */}
        <div className="bg-slate-800 rounded-xl shadow-sm p-4 md:p-6 border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base md:text-lg font-semibold text-slate-100">Latest Rates</h2>
            <div className="flex items-center gap-2 md:gap-3">
              <select
                className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="date">Sort by Date</option>
                <option value="rate">Sort by Rate</option>
                <option value="change">Sort by Change</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="p-1.5 md:p-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ArrowUpDown className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-700 bg-slate-700">
                  <th className="py-2 md:py-3 px-2 md:px-4 font-semibold text-slate-400">Pair</th>
                  <th className="py-2 md:py-3 px-2 md:px-4 font-semibold text-slate-400">Rate</th>
                  <th className="py-2 md:py-3 px-2 md:px-4 font-semibold text-slate-400">Change %</th>
                  <th className="py-2 md:py-3 px-2 md:px-4 font-semibold text-slate-400">Date</th>
                  <th className="py-2 md:py-3 px-2 md:px-4 font-semibold text-slate-400">Source</th>
                </tr>
              </thead>
              <tbody>
                {sortedRates.map((r) => (
                  <tr
                    key={`${r.base_currency}${r.target_currency}`}
                    className="border-b border-slate-700 hover:bg-slate-700 transition-colors"
                  >
                    <td className="py-2 md:py-3 px-2 md:px-4 font-medium text-slate-100">
                      {r.base_currency}/{r.target_currency}
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 font-mono text-slate-100">
                      {r.exchange_rate.toFixed(4)}
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${
                          r.change >= 0
                            ? "bg-emerald-900/40 text-emerald-300"
                            : "bg-red-900/40 text-red-300"
                        }`}
                      >
                        {r.change >= 0 ? <TrendingUp className="w-2 h-2 md:w-3 md:h-3" /> : <TrendingDown className="w-2 h-2 md:w-3 md:h-3" />}
                        {r.change.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-slate-400">{r.rate_date}</td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-slate-500 text-[10px] md:text-xs">
                      {r.source_api}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] md:text-xs text-slate-500 py-4">
          Data updates every 5 minutes • {currentTime}
        </div>
      </div>
    </div>
  );
}