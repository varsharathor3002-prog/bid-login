import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import useOutsideClick from "../../hooks/useOutsideClick";
import { connectGemExtension } from "../../utils/connectGemExtension";
import {
  FaSignOutAlt,
  FaChevronDown,
  FaCheckCircle,
  FaUserPlus,
  FaUserCircle,
  FaFileInvoiceDollar,
  FaHourglassHalf,
  FaThumbsUp,
  FaThumbsDown,
  FaUsers,
  FaUserTie,
  FaChartLine,
  FaDesktop,
  FaLaptop,
  FaServer,
  FaPrint,
  FaBox,
  FaShieldAlt,
  FaBan,
  FaTags,
  FaClipboardList,
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

const API_BASE = "http://127.0.0.1:8000/api";
const ADMIN_API = "http://127.0.0.1:8000/api/admin";

const bidItems = [
  { name: "Desktop Bid Approval",     path: "/admin-dashboard/desktop-bid-approval", ready: true  },
  { name: "AIO Bid Approval",         path: "/aio-bid-approval",                     ready: true },
  { name: "Workstation Bid Approval", path: "/admin-dashboard/workstation-bid-approval", ready: true },
  { name: "Printer Bid Approval",     path: "/admin-dashboard/printer-bid-approval", ready: true },
  { name: "Toner Bid Approval",       path: "/toner-bid-approval",                   ready: false },
];

const adminItems = [
  { name: "Add User",     path: "/admin-dashboard/add-user",     icon: <FaUserPlus /> },
  { name: "Add Analyser", path: "/admin-dashboard/add-analyser", icon: <FaUserCircle /> },
  { name: "Add Admin",    path: "/admin-dashboard/add-admin",    icon: <FaShieldAlt /> },
];

const BID_PRODUCTS = [
  { key: "desktop",     label: "Desktop",     icon: <FaDesktop />, color: "#6366f1", ready: true  },
  { key: "aio",         label: "AIO",         icon: <FaLaptop />,  color: "#8b5cf6", ready: true },
  { key: "workstation", label: "Workstation", icon: <FaServer />,  color: "#0ea5e9", ready: true },
  { key: "printer",     label: "Printer",     icon: <FaPrint />,   color: "#10b981", ready: true  },
  { key: "toner",       label: "Toner",       icon: <FaBox />,     color: "#f59e0b", ready: false },
];

const ADMIN_DASHBOARD_API_MAP = {
  desktop: {
    years:   `${ADMIN_API}/desktop-bids/dashboard-years/`,
    monthly: `${ADMIN_API}/desktop-bids/monthly-performance/`,
    daily:   `${ADMIN_API}/desktop-bids/daily-activity/`,
    stats:   `${ADMIN_API}/desktop-bids/stats/`,
  },
  workstation: {
    years:   `${ADMIN_API}/workstation-bids/dashboard-years/`,
    monthly: `${ADMIN_API}/workstation-bids/monthly-performance/`,
    daily:   `${ADMIN_API}/workstation-bids/daily-activity/`,
    stats:   `${ADMIN_API}/workstation-bids/stats/`,
  },
  printer: {
    years:   `${ADMIN_API}/printer-bids/dashboard-years/`,
    monthly: `${ADMIN_API}/printer-bids/monthly-performance/`,
    daily:   `${ADMIN_API}/printer-bids/daily-activity/`,
    stats:   `${ADMIN_API}/printer-bids/stats/`,
  },
};

const PIE_COLORS = ["#f59e0b", "#10b981", "#ef4444"];

const normalizeMonthlyData = (data = []) =>
  data.map((item) => ({
    month:    item.month,
    pending:  Number(item.pending  ?? 0),
    approved: Number(item.approved ?? 0),
    rejected: Number(item.rejected ?? item.reAnalyze ?? 0),
    total:    Number(item.total    ?? 0),
  }));

const normalizeDailyData = (data = []) =>
  data.map((item) => ({
    day:      item.shortDay || item.day || item.fullDay,
    date:     item.date,
    bids:     Number(item.total    ?? 0),
    pending:  Number(item.pending  ?? 0),
    approved: Number(item.approved ?? 0),
    rejected: Number(item.rejected ?? 0),
    total:    Number(item.total    ?? 0),
  }));

const MetricCard = ({ icon, num, label, gradient, iconBg, loading = false, onClick }) => (
  <div
    onClick={onClick}
    role={onClick ? "link" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (event) => {
      if (event.key === "Enter" || event.key === " ") onClick();
    } : undefined}
    className={`relative rounded-2xl p-5 flex items-center gap-4 shadow-md overflow-hidden ${gradient} ${onClick ? "cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2" : ""}`}
  >
    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white opacity-10" />
    <div className="absolute -right-1 -bottom-6 w-16 h-16 rounded-full bg-white opacity-10" />
    <div className={`relative z-10 text-2xl ${iconBg} p-3 rounded-xl shadow-inner flex items-center justify-center`}>
      {icon}
    </div>
    <div className="relative z-10">
      {loading ? (
        <div className="w-8 h-8 bg-white bg-opacity-30 rounded-lg animate-pulse" />
      ) : (
        <p className="text-4xl font-extrabold text-white leading-none">{num ?? "—"}</p>
      )}
      <p className="text-sm font-medium mt-1 text-white opacity-90">{label}</p>
    </div>
  </div>
);

const AdminHome = () => {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState(BID_PRODUCTS[0]);
  const [dropOpen, setDropOpen] = useState(false);
  const productDropdownRef = useRef(null);
  
    const [analysers, setAnalysers] = useState([]);
  const [selectedAnalyser, setSelectedAnalyser] = useState(null);
  const [analyserDropOpen, setAnalyserDropOpen] = useState(false);
  const analyserDropdownRef = useRef(null);
  
  const [stats, setStats] = useState({
    totalBids: null, pending: null, approved: null, reAnalyze: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [userCount, setUserCount] = useState(null);
  const [analyserCount, setAnalyserCount] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearOptions, setYearOptions] = useState([new Date().getFullYear()]);
  const [dailyData, setDailyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  useOutsideClick(productDropdownRef, () => setDropOpen(false), dropOpen);
  useOutsideClick(analyserDropdownRef, () => setAnalyserDropOpen(false), analyserDropOpen);

  const approvalPath = `/admin-dashboard/${selectedProduct.key}-bid-approval`;

  const fetchAccountCounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const [usersResult, analysersResult] = await Promise.allSettled([
        fetch(`${API_BASE}/user-list/`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/analyser-list/`).then(r => r.ok ? r.json() : null),
      ]);

      if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) {
        setUserCount(usersResult.value.length);
      }

      if (analysersResult.status === 'fulfilled' && Array.isArray(analysersResult.value)) {
        setAnalysers(analysersResult.value.map(a => a.username || a.name || a));
        setAnalyserCount(analysersResult.value.length);
      }
    } catch (err) {
      console.error("Account counts error:", err);
    } finally {
      setAccountsLoading(false);
    }
  }, [navigate]);

  const fetchStats = useCallback(async () => {
    if (!selectedProduct.ready) {
      setStats({ totalBids: 0, pending: 0, approved: 0, reAnalyze: 0 });
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    try {
      const api = ADMIN_DASHBOARD_API_MAP[selectedProduct.key];
      let url = api.stats;
      
            if (selectedAnalyser) {
        url += `?analyser=${encodeURIComponent(selectedAnalyser)}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setStats({
          totalBids: d.total ?? null,
          pending: d.pending ?? null,
          approved: d.approved ?? null,
          reAnalyze: d.reAnalyze ?? null,
        });
      }
    } catch (err) {
      console.error("Admin stats error:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedProduct, selectedAnalyser]);

  const fetchYears = useCallback(async () => {
    if (!selectedProduct.ready) return;
    try {
      const api = ADMIN_DASHBOARD_API_MAP[selectedProduct.key];
      const res = await fetch(api.years);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setYearOptions(data);
        const currentYear = new Date().getFullYear();
        setSelectedYear(data.includes(currentYear) ? currentYear : data[0]);
      }
    } catch {  }
  }, [selectedProduct]);

  const fetchChartData = useCallback(async () => {
    if (!selectedProduct.ready) {
      setDailyData([]);
      setMonthlyData([]);
      setChartsLoading(false);
      return;
    }
    setChartsLoading(true);
    try {
      const api = ADMIN_DASHBOARD_API_MAP[selectedProduct.key];
      let monthlyUrl = `${api.monthly}?year=${selectedYear}`;
      let dailyUrl = api.daily;
      
            if (selectedAnalyser) {
        monthlyUrl += `&analyser=${encodeURIComponent(selectedAnalyser)}`;
        dailyUrl += `?analyser=${encodeURIComponent(selectedAnalyser)}`;
      }

      const [monthlyRes, dailyRes] = await Promise.all([
        fetch(monthlyUrl),
        fetch(dailyUrl),
      ]);
      setMonthlyData(normalizeMonthlyData(monthlyRes.ok ? await monthlyRes.json() : []));
      setDailyData(normalizeDailyData(dailyRes.ok ? await dailyRes.json() : []));
    } catch {
      setMonthlyData([]);
      setDailyData([]);
    } finally {
      setChartsLoading(false);
    }
  }, [selectedProduct, selectedYear, selectedAnalyser]);

  useEffect(() => {
    fetchAccountCounts();
  }, [fetchAccountCounts]);

  useEffect(() => {
    fetchStats();
    fetchYears();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchYears]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const pieData = [
    { name: "Pending Review", value: stats.pending ?? 0 },
    { name: "Approved", value: stats.approved ?? 0 },
    { name: "Re-Analyze", value: stats.reAnalyze ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {}
      <div className="flex flex-wrap justify-start gap-4">
        {}
        <div ref={productDropdownRef} className="relative">
          <button
            onClick={() => setDropOpen(!dropOpen)}
            className="flex items-center gap-3 bg-white border-2 border-slate-200 px-4 py-2.5 rounded-xl font-black text-slate-700 text-sm shadow-sm hover:border-blue-500 min-w-[190px] justify-between transition-all focus:outline-none focus:ring-0"
          >
            <span className="flex items-center gap-2">
              {selectedProduct.icon} {selectedProduct.label}
            </span>
            <FaChevronDown className={`transition-transform text-slate-400 ${dropOpen ? "rotate-180" : ""}`} />
          </button>
          {dropOpen && (
            <div className="absolute left-0 mt-1 w-full bg-white border-2 border-slate-100 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
              {BID_PRODUCTS.map((p) => (
                <div
                  key={p.key}
                  onClick={() => { setSelectedProduct(p); setDropOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer font-bold text-slate-600 text-sm transition-colors focus:outline-none select-none"
                >
                  <span style={{ color: p.color }}>{p.icon}</span>
                  {p.label}
                  {!p.ready && (
                    <span className="ml-auto text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-black">
                      SOON
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {}
        <div ref={analyserDropdownRef} className="relative">
          <button
            onClick={() => setAnalyserDropOpen(!analyserDropOpen)}
            className="flex items-center gap-3 bg-white border-2 border-slate-200 px-4 py-2.5 rounded-xl font-black text-slate-700 text-sm shadow-sm hover:border-blue-500 min-w-[190px] justify-between transition-all focus:outline-none focus:ring-0"
          >
            <span className="flex items-center gap-2">
              <FaUserTie className="text-cyan-600" /> 
              {selectedAnalyser || "All Analysers"}
            </span>
            <FaChevronDown className={`transition-transform text-slate-400 ${analyserDropOpen ? "rotate-180" : ""}`} />
          </button>
          {analyserDropOpen && (
            <div className="absolute left-0 mt-1 w-full bg-white border-2 border-slate-100 rounded-xl shadow-2xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto">
              <div
                onClick={() => { setSelectedAnalyser(null); setAnalyserDropOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer font-bold text-sm transition-colors ${!selectedAnalyser ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
              >
                All Analysers
              </div>
              {analysers.length > 0 ? (
                analysers.map((name, idx) => (
                  <div
                    key={idx}
                    onClick={() => { setSelectedAnalyser(name); setAnalyserDropOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer font-bold text-sm transition-colors ${selectedAnalyser === name ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
                  >
                    {name}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2.5 text-slate-400 text-sm font-medium text-center">
                  No analysers found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={<FaFileInvoiceDollar className="text-blue-600" />} num={stats.totalBids} label="Total Bids" gradient="bg-gradient-to-br from-blue-500 to-blue-600" iconBg="bg-blue-100" loading={statsLoading} />
        <MetricCard onClick={() => navigate(`${approvalPath}?status=pending`)} icon={<FaHourglassHalf className="text-amber-500" />} num={stats.pending} label="Pending Review" gradient="bg-gradient-to-br from-amber-400 to-amber-500" iconBg="bg-amber-100" loading={statsLoading} />
        <MetricCard onClick={() => navigate(`${approvalPath}?status=approved`)} icon={<FaThumbsUp className="text-emerald-600" />} num={stats.approved} label="Approved Bids" gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" iconBg="bg-emerald-100" loading={statsLoading} />
        <MetricCard onClick={() => navigate(`${approvalPath}?status=re-analyze`)} icon={<FaThumbsDown className="text-rose-600" />} num={stats.reAnalyze} label="Re-Analyze" gradient="bg-gradient-to-br from-rose-500 to-rose-600" iconBg="bg-rose-100" loading={statsLoading} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard onClick={() => navigate("/admin-dashboard/add-user")} icon={<FaUsers className="text-violet-600" />} num={userCount} label="Total Users Registered" gradient="bg-gradient-to-br from-violet-500 to-violet-600" iconBg="bg-violet-100" loading={accountsLoading} />
        <MetricCard onClick={() => navigate("/admin-dashboard/add-analyser")} icon={<FaUserTie className="text-cyan-600" />} num={analyserCount} label="Total Analysers Registered" gradient="bg-gradient-to-br from-cyan-500 to-cyan-600" iconBg="bg-cyan-100" loading={accountsLoading} />
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-black text-slate-800 mb-5 flex items-center gap-3 uppercase tracking-tight">
            <div className="w-1 h-6 bg-blue-600 rounded-full" />
            Daily Activity {selectedAnalyser && <span className="text-xs text-blue-600 normal-case font-bold">({selectedAnalyser})</span>}
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={dailyData} barCategoryGap="32%">
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 11, fill: "#64748b" }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Bar dataKey="bids" name="Total Bids" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <h3 className="w-full text-base font-black text-slate-800 mb-2 flex items-center gap-3 uppercase tracking-tight">
            <div className="w-1 h-6 bg-indigo-600 rounded-full" />
            Status Ratio {selectedAnalyser && <span className="text-xs text-blue-600 normal-case font-bold">({selectedAnalyser})</span>}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={5} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: "bold", paddingTop: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-1 text-center">
            <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
              {statsLoading ? "…" : stats.totalBids ?? 0}
            </p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Bids</p>
          </div>
        </div>
      </div>
      <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
            <FaChartLine className="text-blue-600" />
            Monthly Performance {selectedAnalyser && <span className="text-xs text-blue-600 normal-case font-bold">({selectedAnalyser})</span>}
          </h3>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-white border-2 border-slate-200 px-4 py-2 rounded-xl font-black text-slate-700 text-sm shadow-sm hover:border-blue-500 outline-none">
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 11, fill: "#64748b" }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10, fontSize: "11px", fontWeight: "bold" }} />
            <Bar dataKey="pending" name="Pending Review" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[6, 6, 0, 0]} />
            <Bar dataKey="rejected" name="Re-Analyze" fill="#ef4444" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const AdminNavbar = () => {
  const [openBid, setOpenBid] = useState(true);
  const [openAdmin, setOpenAdmin] = useState(false);
  const [openRates, setOpenRates] = useState(false);
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if ((sessionStorage.getItem("role") || localStorage.getItem("role")) !== "admin") {
      navigate("/", { replace: true });
      return;
    }
    const stored = sessionStorage.getItem("admin_username") || localStorage.getItem("admin_username");
    if (stored && stored !== "undefined" && stored !== "null" && stored.trim() !== "") {
      setUsername(stored.trim());
    }
  }, []);

  useEffect(() => connectGemExtension(), []);

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem("admin_username");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("display_username");
    localStorage.removeItem("email");
    localStorage.removeItem("token");
    navigate("/");
  };

  const isActive = (path) => location.pathname.startsWith(path);
  const isDashboardHome = location.pathname === "/admin-dashboard";

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
                <h3 className="text-lg font-bold text-white truncate" title={username || "Admin"}>
                  {username || "Admin"} 👋
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400 font-medium">Online • Admin Panel</span>
            </div>
          </div>
        </div>

        {}
        <div className="flex-1 p-3 overflow-y-auto hide-scrollbar">

          <div
            onClick={() => navigate("/admin-dashboard/disqualified-bids")}
            className={`flex items-center gap-3 px-4 py-3 mb-3 rounded-xl cursor-pointer transition-all duration-200 focus:outline-none focus:ring-0 no-highlight select-none ${
              isActive("/admin-dashboard/disqualified-bids")
                ? "bg-gray-700/50 text-white"
                : "hover:bg-gray-700/50 text-gray-200"
            }`}
          >
            <span className="text-lg text-red-400"><FaBan /></span>
            <span className="text-sm font-medium">Disqualified Bid</span>
          </div>

          <div onClick={() => navigate("/admin-dashboard/bid-assignments")}
            className={`flex items-center gap-3 px-4 py-3 mb-3 rounded-xl cursor-pointer transition-all duration-200 ${isActive("/admin-dashboard/bid-assignments") ? "bg-gray-700/50 text-white" : "hover:bg-gray-700/50 text-gray-200"}`}>
            <span className="text-lg text-cyan-400"><FaClipboardList /></span>
            <span className="text-sm font-medium">Bid Assignment Tracking</span>
          </div>

          {}
          <button
            onClick={() => setOpenAdmin(!openAdmin)}
            className="flex items-center justify-between w-full px-4 py-3 bg-gray-800/50 rounded-xl hover:bg-gray-700/70 transition border border-gray-700/30 focus:outline-none focus:ring-0 no-highlight select-none"
          >
            <span className="flex items-center gap-2 font-medium">
              <FaShieldAlt className="text-blue-400" />
              <span>Team Management</span>
            </span>
            <span className={`transition duration-300 text-gray-400 ${openAdmin ? "rotate-180" : ""}`}>
              <FaChevronDown />
            </span>
          </button>

          {openAdmin && (
            <div className="mt-3 space-y-1.5 ml-2">
              {adminItems.map((item) => (
                <div
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 focus:outline-none focus:ring-0 no-highlight select-none ${
                    isActive(item.path)
                      ? "bg-gray-700/50 text-white"
                      : "hover:bg-gray-700/50 text-gray-200"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            <button
              onClick={() => setOpenRates(!openRates)}
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-800/50 rounded-xl hover:bg-gray-700/70 transition border border-gray-700/30 focus:outline-none focus:ring-0 no-highlight select-none"
            >
              <span className="flex items-center gap-2 font-medium"><FaTags className="text-emerald-400" /><span>Component Rate</span></span>
              <span className={`transition duration-300 text-gray-400 ${openRates ? "rotate-180" : ""}`}><FaChevronDown /></span>
            </button>
            {openRates && (
              <div className="mt-3 space-y-1.5 ml-2">
                {[{ key: "desktop", label: "Desktop", ready: true }, { key: "workstation", label: "Workstation", ready: true }, { key: "aio", label: "AIO", ready: true }].map((item) => {
                  const path = `/admin-dashboard/component-rates/${item.key}`;
                  return <div key={item.key} onClick={() => item.ready && navigate(path)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 no-highlight select-none ${!item.ready ? "cursor-not-allowed text-gray-500 opacity-70" : isActive(path) ? "cursor-pointer bg-gray-700/70 text-white" : "cursor-pointer hover:bg-gray-700/50 text-gray-200"}`}><FaDesktop className={item.ready ? "text-emerald-400" : "text-gray-500"} /><span className="text-sm font-medium">{item.label}</span>{!item.ready && <span className="ml-auto rounded-full bg-gray-600 px-2 py-0.5 text-[10px] text-gray-300">Coming Soon</span>}</div>;
                })}
              </div>
            )}
          </div>

          {}
          <div className="mt-3">
            <button
              onClick={() => setOpenBid(!openBid)}
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-800/50 rounded-xl hover:bg-gray-700/70 transition border border-gray-700/30 focus:outline-none focus:ring-0 no-highlight select-none"
            >
              <span className="flex items-center gap-2 font-medium">
                <FaCheckCircle className="text-blue-400" />
                <span>Bid Approval</span>
              </span>
              <span className={`transition duration-300 text-gray-400 ${openBid ? "rotate-180" : ""}`}>
                <FaChevronDown />
              </span>
            </button>

            {openBid && (
              <div className="mt-3 space-y-1.5 ml-2">
                {bidItems.map((item) => (
                  <div
                    key={item.path}
                    onClick={() => item.ready && navigate(item.path)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 focus:outline-none focus:ring-0 no-highlight select-none ${
                      !item.ready
                        ? "opacity-50 cursor-not-allowed text-gray-500"
                        : isActive(item.path)
                          ? "bg-gray-700/70 text-white"
                          : "hover:bg-gray-700/50 text-gray-200"
                    }`}
                  >
                    <span className="text-sm font-medium">{item.name}</span>
                    {!item.ready && (
                      <span className="text-[10px] bg-gray-600 px-2 py-0.5 rounded-full text-gray-300">Soon</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <h1 className="text-xl font-semibold text-gray-800">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800">{username || "Admin"}</span>
              
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
              {(username || "A").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {isDashboardHome ? <AdminHome /> : <Outlet />}
        </div>
      </div>
    </div>
  );
};

export default AdminNavbar;
