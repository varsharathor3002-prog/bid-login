import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import useOutsideClick from "../../hooks/useOutsideClick";
import { connectGemExtension } from "../../utils/connectGemExtension";
import {
  FaBox,
  FaDesktop,
  FaLaptop,
  FaServer,
  FaPrint,
  FaSignOutAlt,
  FaChevronDown,
  FaUserCircle,
  FaClipboardList,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChartLine,
  FaTachometerAlt,
  FaBan,
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const API_BASE = "http://127.0.0.1:8000/api";
const BID_PRODUCTS = [
  { key: "desktop", label: "Desktop", icon: <FaDesktop />, color: "#6366f1", ready: true },
  { key: "aio", label: "AIO", icon: <FaLaptop />, color: "#8b5cf6", ready: false },
  { key: "workstation", label: "Workstation", icon: <FaServer />, color: "#0ea5e9", ready: true },
  { key: "printer", label: "Printer", icon: <FaPrint />, color: "#10b981", ready: true },
  { key: "toner", label: "Toner", icon: <FaBox />, color: "#f59e0b", ready: false },
];
const PRODUCTS = BID_PRODUCTS;
const NAV_ENABLED_KEYS = new Set(["desktop", "workstation", "printer"]);
const DASHBOARD_API_MAP = {
  desktop: {
    years: `${API_BASE}/desktop-bids/dashboard-years/`,
    monthly: `${API_BASE}/desktop-bids/monthly-performance/`,
    daily: `${API_BASE}/desktop-bids/daily-activity/`,
    list: `${API_BASE}/desktop-bids/list/`,
  },
  workstation: {
    years: `${API_BASE}/workstation-bids/dashboard-years/`,
    monthly: `${API_BASE}/workstation-bids/monthly-performance/`,
    daily: `${API_BASE}/workstation-bids/daily-activity/`,
    list: `${API_BASE}/workstation-bids/list/`,
  },
  printer: {
    years: `${API_BASE}/printer-bids/dashboard-years/`,
    monthly: `${API_BASE}/printer-bids/monthly-performance/`,
    daily: `${API_BASE}/printer-bids/daily-activity/`,
    list: `${API_BASE}/printer-bids/list/`,
  },
};
const STATUS_COLORS = { approved: "#10b981", pending: "#f59e0b", rejected: "#ef4444" };

const normalizeMonthlyData = (data = []) =>
  data.map((item) => ({
    month: item.month,
    approved: Number(item.approved ?? item.reviewed ?? 0),
    pending: Number(item.pending ?? 0),
    rejected: Number(item.rejected ?? item.reAnalyze ?? 0),
    total: Number(item.total ?? 0),
  }));

const normalizeDailyData = (data = []) =>
  data.map((item) => ({
    day: item.shortDay || item.day || item.fullDay,
    fullDay: item.fullDay || item.day,
    date: item.date,
    bids: Number(item.total ?? 0),
    approved: Number(item.approved ?? item.reviewed ?? 0),
    pending: Number(item.pending ?? 0),
    rejected: Number(item.rejected ?? item.reAnalyze ?? 0),
    total: Number(item.total ?? 0),
  }));

const StatCard = ({ label, value, Icon, gradient, loading, onClick }) => (
  <div
    onClick={onClick}
    role={onClick ? "link" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (event) => {
      if (event.key === "Enter" || event.key === " ") onClick();
    } : undefined}
    className={`relative overflow-hidden rounded-2xl p-5 flex items-center gap-4 shadow-md ${gradient} transition-transform hover:scale-[1.02] ${onClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2" : ""}`}
  >
    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-white/20">
      <Icon className="text-white text-xl" />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-white/75">{label}</p>
      <p className="text-4xl font-black text-white tracking-tighter leading-none mt-0.5">{loading ? "…" : value}</p>
    </div>
  </div>
);

const AnalyserHome = () => {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [dropOpen, setDropOpen] = useState(false);
  const productDropdownRef = useRef(null);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [yearOptions, setYearOptions] = useState([2026, 2027, 2028]);
  const [stats, setStats] = useState({ pending: 0, reviewed: 0, reAnalyze: 0, total: 0 });
  const [dailyData, setDailyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useOutsideClick(productDropdownRef, () => setDropOpen(false), dropOpen);

  const fetchYears = useCallback(async () => {
    if (!selectedProduct.ready) return;
    try {
      const api = DASHBOARD_API_MAP[selectedProduct.key];
      const res = await fetch(api.years);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setYearOptions(data);
        const currentYear = new Date().getFullYear();
        setSelectedYear(data.includes(currentYear) ? currentYear : data[0]);
      }
    } catch {
      setYearOptions([2026, 2027, 2028]);
      setSelectedYear(2026);
    }
  }, [selectedProduct]);

  const fetchDashboardData = useCallback(async () => {
    if (!selectedProduct.ready) {
      setStats({ pending: 0, reviewed: 0, reAnalyze: 0, total: 0 });
      setDailyData([]);
      setMonthlyData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const api = DASHBOARD_API_MAP[selectedProduct.key];
      const [monthlyRes, dailyRes, pendingRes, reviewedRes, reAnalyzeRes] = await Promise.all([
        fetch(`${api.monthly}?year=${selectedYear}`),
        fetch(api.daily),
        fetch(`${api.list}?status=pending&role=analyser&year=${selectedYear}`),
        fetch(`${api.list}?status=reviewed&role=analyser&year=${selectedYear}`),
        fetch(`${api.list}?status=re-analyze&role=analyser&year=${selectedYear}`),
      ]);
      const monthlyJson = monthlyRes.ok ? await monthlyRes.json() : [];
      const dailyJson = dailyRes.ok ? await dailyRes.json() : [];
      const pendingJson = pendingRes.ok ? await pendingRes.json() : [];
      const reviewedJson = reviewedRes.ok ? await reviewedRes.json() : [];
      const reAnalyzeJson = reAnalyzeRes.ok ? await reAnalyzeRes.json() : [];
      const pending = Array.isArray(pendingJson) ? pendingJson.length : 0;
      const reviewed = Array.isArray(reviewedJson) ? reviewedJson.length : 0;
      const reAnalyze = Array.isArray(reAnalyzeJson) ? reAnalyzeJson.length : 0;
      setStats({ pending, reviewed, reAnalyze, total: pending + reviewed + reAnalyze });
      setMonthlyData(normalizeMonthlyData(monthlyJson));
      setDailyData(normalizeDailyData(dailyJson));
    } catch {
      setStats({ pending: 0, reviewed: 0, reAnalyze: 0, total: 0 });
      setDailyData([]);
      setMonthlyData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, selectedYear]);

  useEffect(() => { fetchYears(); }, [fetchYears]);
  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const pieData = [
    { name: "Approved", value: stats.reviewed, fill: STATUS_COLORS.approved },
    { name: "Pending", value: stats.pending, fill: STATUS_COLORS.pending },
    { name: "Rejected", value: stats.reAnalyze, fill: STATUS_COLORS.rejected },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div ref={productDropdownRef} className="relative">
          <button
            onClick={() => setDropOpen(!dropOpen)}
            className="flex items-center gap-3 bg-white border-2 border-slate-200 px-4 py-2.5 rounded-xl font-black text-slate-700 text-sm shadow-sm hover:border-blue-500 min-w-[190px] justify-between transition-all focus:outline-none focus:ring-0"
          >
            <span className="flex items-center gap-2">{selectedProduct.icon} {selectedProduct.label}</span>
            <FaChevronDown className={`transition-transform text-slate-400 ${dropOpen ? "rotate-180" : ""}`} />
          </button>
          {dropOpen && (
            <div className="absolute right-0 mt-1 w-full bg-white border-2 border-slate-100 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
              {PRODUCTS.map((p) => (
                <div
                  key={p.key}
                  onClick={() => { setSelectedProduct(p); setDropOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer font-bold text-slate-600 text-sm transition-colors focus:outline-none select-none"
                >
                  <span style={{ color: p.color }}>{p.icon}</span>
                  {p.label}
                  {!p.ready && (
                    <span className="ml-auto text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-black">SOON</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard onClick={() => navigate(`/analyser-dashboard/${selectedProduct.key}?status=pending`)} label="Pending Bids" value={stats.pending} Icon={FaClipboardList} gradient="bg-gradient-to-br from-amber-400 to-orange-500" loading={loading} />
        <StatCard onClick={() => navigate(`/analyser-dashboard/${selectedProduct.key}?status=approved`)} label="Approved Bids" value={stats.reviewed} Icon={FaCheckCircle} gradient="bg-gradient-to-br from-emerald-400 to-emerald-600" loading={loading} />
        <StatCard onClick={() => navigate(`/analyser-dashboard/${selectedProduct.key}?status=re-analyze`)} label="Rejected / Re-Analyze Bids" value={stats.reAnalyze} Icon={FaExclamationTriangle} gradient="bg-gradient-to-br from-rose-500 to-rose-700" loading={loading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-black text-slate-800 mb-5 flex items-center gap-3 uppercase tracking-tight">
            <div className="w-1 h-6 bg-blue-600 rounded-full" />
            Daily Activity
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 11, fill: "#64748b" }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Bar dataKey="bids" name="Total Bids" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <h3 className="w-full text-base font-black text-slate-800 mb-2 flex items-center gap-3 uppercase tracking-tight">
            <div className="w-1 h-6 bg-indigo-600 rounded-full" />
            Status Ratio
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} innerRadius={55} outerRadius={82} paddingAngle={5} dataKey="value">
                {pieData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: "bold", paddingTop: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-1 text-center">
            <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{loading ? "…" : stats.total}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Bids</p>
          </div>
        </div>
      </div>
      <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
            <FaChartLine className="text-blue-600" />
            Monthly Performance
          </h3>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-white border-2 border-slate-200 px-4 py-2 rounded-xl font-black text-slate-700 text-sm shadow-sm hover:border-blue-500 outline-none">
            {yearOptions.map((year) => (<option key={year} value={year}>{year}</option>))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 11, fill: "#64748b" }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10, fontSize: "11px", fontWeight: "bold" }} />
            <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[6, 6, 0, 0]} />
            <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const AnalyserNavbar = () => {
  const [bidsOpen, setBidsOpen] = useState(true);
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem("analyser_username");
    if (stored && stored !== "undefined" && stored !== "null" && stored.trim() !== "") {
      setUsername(stored.trim());
    }
  }, []);

  useEffect(() => connectGemExtension(), []);

  const handleLogout = () => {
    localStorage.removeItem("analyser_username");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("display_username");
    localStorage.removeItem("email");
    localStorage.removeItem("token");
    navigate("/");
  };

  const isActive = (path) => location.pathname.startsWith(path);
  const isDashboard = location.pathname === "/analyser-dashboard" || location.pathname === "/analyser-dashboard/";

  return (
    <div className="h-screen w-full flex bg-gray-100 overflow-hidden">

      {}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-highlight { -webkit-tap-highlight-color: transparent; }
        .no-highlight:focus, .no-highlight:active { outline: none !important; box-shadow: none !important; }
      `}</style>

      {}
      <div className="w-64 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col shadow-2xl">

        {}
        <div className="relative p-6 border-b border-gray-700/50 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-3xl transform translate-x-8 -translate-y-8"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg ring-4 ring-blue-500/20">
                  {(username || "A").charAt(0).toUpperCase()}
                </div>
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800 animate-pulse"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Welcome Back</p>
                <h3 className="text-lg font-bold text-white truncate" title={username || "Analyser"}>
                  {username || "Analyser"} 👋
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400 font-medium">Online • Analyser Panel</span>
            </div>
          </div>
        </div>

        {}
        <div className="flex-1 p-3 overflow-y-auto hide-scrollbar">

          {}
          <div
            onClick={() => navigate("/analyser-dashboard")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-2 focus:outline-none focus:ring-0 no-highlight select-none ${
              isDashboard
                ? "bg-gray-700/50 text-white"
                : "hover:bg-gray-700/50 text-gray-200"
            }`}
          >
            <span className="text-lg"><FaTachometerAlt /></span>
            <span className="text-sm font-medium">Dashboard</span>
          </div>

          <div
            onClick={() => navigate("/analyser-dashboard/disqualified-bids")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-2 focus:outline-none focus:ring-0 no-highlight select-none ${
              location.pathname === "/analyser-dashboard/disqualified-bids"
                ? "bg-gray-700/50 text-white"
                : "hover:bg-gray-700/50 text-gray-200"
            }`}
          >
            <span className="text-lg text-red-400"><FaBan /></span>
            <span className="text-sm font-medium">Disqualified Bid</span>
          </div>

          <div
            onClick={() => navigate("/analyser-dashboard/product")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-2 focus:outline-none focus:ring-0 no-highlight select-none ${
              location.pathname === "/analyser-dashboard/product" ||
              location.pathname === "/analyser-dashboard/workstation/product"
                ? "bg-gray-700/50 text-white"
                : "hover:bg-gray-700/50 text-gray-200"
            }`}
          >
            <span className="text-lg" style={{ color: "#ec4899" }}><FaBox /></span>
            <span className="text-sm font-medium">Product</span>
          </div>

          {}
          <button
            onClick={() => setBidsOpen(!bidsOpen)}
            className="flex items-center justify-between w-full px-4 py-3 bg-gray-800/50 rounded-xl hover:bg-gray-700/70 transition border border-gray-700/30 focus:outline-none focus:ring-0 no-highlight select-none"
          >
            <span className="flex items-center gap-2 font-medium">
              <FaBox className="text-blue-400" />
              <span>View Bids</span>
            </span>
            <span className={`transition duration-300 text-gray-400 ${bidsOpen ? "rotate-180" : ""}`}>
              <FaChevronDown />
            </span>
          </button>

          {bidsOpen && (
            <div className="mt-3 space-y-1.5 ml-2">
              {BID_PRODUCTS.map((item) => {
                const isEnabled = NAV_ENABLED_KEYS.has(item.key);
                return (
                <div
                  key={item.key}
                  onClick={() => isEnabled && navigate(`/analyser-dashboard/${item.key}`)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-0 no-highlight select-none ${
                    !isEnabled
                      ? "opacity-50 cursor-not-allowed text-gray-500"
                      : "hover:bg-gray-700/50 text-gray-200"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </span>
                  {!isEnabled && (
                    <span className="text-[10px] bg-gray-600 px-2 py-0.5 rounded-full text-gray-300">Soon</span>
                  )}
                </div>
                );
              })}

            </div>
          )}
        </div>

        {}
        <div className="p-4 border-t border-gray-700/50">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 py-3 rounded-xl font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-0 no-highlight select-none"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center bg-white shadow-sm px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Analyser Dashboard</h1>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800">{username || "Analyser"}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
              {(username || "A").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {isDashboard ? <AnalyserHome /> : <Outlet />}
        </div>
      </div>
    </div>
  );
};

export default AnalyserNavbar;
