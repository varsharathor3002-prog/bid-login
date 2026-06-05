import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FaBox, FaDesktop, FaLaptop, FaServer, FaPrint, FaSignOutAlt,
  FaChevronDown, FaUserCircle, FaClipboardList,
  FaCheckCircle, FaExclamationTriangle, FaChartLine, FaTachometerAlt
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area
} from "recharts";

// ─── Config ────────────────────────────────────────────────────────────────────

const API_BASE = "http://127.0.0.1:8000/api";

// BID products (for View Bids accordion + Dashboard dropdown)
const BID_PRODUCTS = [
  { key: "desktop",     label: "Desktop",     icon: <FaDesktop />,  color: "#6366f1", ready: true  },
  { key: "aio",         label: "AIO",         icon: <FaLaptop />,   color: "#8b5cf6", ready: false },
  { key: "workstation", label: "Workstation", icon: <FaServer />,   color: "#0ea5e9", ready: false },
  { key: "printer",     label: "Printer",     icon: <FaPrint />,    color: "#10b981", ready: false },
  { key: "toner",       label: "Toner",       icon: <FaBox />,      color: "#f59e0b", ready: false },
];

// Keep PRODUCTS alias for AnalyserHome dropdown (only bid products)
const PRODUCTS = BID_PRODUCTS;

const STATUS_COLORS = { approved: "#10b981", pending: "#f59e0b", rejected: "#ef4444" };
const BAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f59e0b","#10b981","#0ea5e9"];

const DAILY_DATA = [
  { day: "Mon", bids: 12 }, { day: "Tue", bids: 19 }, { day: "Wed", bids: 15 },
  { day: "Thu", bids: 22 }, { day: "Fri", bids: 30 }, { day: "Sat", bids: 10 }, { day: "Sun", bids: 5 },
];

const MONTHLY_DATA = [
  { month: "Jun", approved: 40, rejected: 10 },
  { month: "Jul", approved: 55, rejected: 15 },
  { month: "Aug", approved: 45, rejected: 8  },
  { month: "Sep", approved: 70, rejected: 20 },
  { month: "Oct", approved: 85, rejected: 12 },
  { month: "Nov", approved: 90, rejected: 18 },
  { month: "Dec", approved: 110,rejected: 15 },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, Icon, gradient, loading }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 flex items-center gap-4 shadow-md ${gradient} transition-transform hover:scale-[1.02]`}>
    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-white/20">
      <Icon className="text-white text-xl" />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-white/75">{label}</p>
      <p className="text-4xl font-black text-white tracking-tighter leading-none mt-0.5">
        {loading ? "…" : value}
      </p>
    </div>
  </div>
);

// ─── Dashboard Home ────────────────────────────────────────────────────────────

const AnalyserHome = () => {
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [dropOpen, setDropOpen] = useState(false);
  const [stats, setStats] = useState({ pending: 0, reviewed: 0, reAnalyze: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const ep = `${API_BASE}/${selectedProduct.key}-bids/list/`;
      const [pRes, rRes, xRes] = await Promise.all([
        fetch(`${ep}?status=pending`),
        fetch(`${ep}?status=reviewed`),
        fetch(`${ep}?status=re-analyze`),
      ]);
      const [pData, rData, xData] = await Promise.all([
        pRes.ok ? pRes.json() : [],
        rRes.ok ? rRes.json() : [],
        xRes.ok ? xRes.json() : [],
      ]);
      const p = pData.length || 0, r = rData.length || 0, x = xData.length || 0;
      setStats({ pending: p, reviewed: r, reAnalyze: x, total: p + r + x });
    } catch {
      setStats({ pending: 0, reviewed: 0, reAnalyze: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [selectedProduct]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const pieData = [
    { name: "Approved", value: stats.reviewed,   fill: STATUS_COLORS.approved },
    { name: "Pending",  value: stats.pending,    fill: STATUS_COLORS.pending  },
    { name: "Rejected", value: stats.reAnalyze,  fill: STATUS_COLORS.rejected },
  ];

  return (
    <div className="space-y-6 pb-8">

      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Analytics Overview</p>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {selectedProduct.label} <span className="text-blue-600">Dashboard</span>
          </h2>
        </div>

        {/* Product Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropOpen(!dropOpen)}
            className="flex items-center gap-3 bg-white border-2 border-slate-200 px-4 py-2.5 rounded-xl font-black text-slate-700 text-sm shadow-sm hover:border-blue-500 min-w-[190px] justify-between transition-all"
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
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer font-bold text-slate-600 text-sm transition-colors"
                >
                  <span style={{ color: p.color }}>{p.icon}</span> {p.label}
                  {!p.ready && <span className="ml-auto text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-black">SOON</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Pending Approval"     value={stats.pending}   Icon={FaClipboardList}      gradient="bg-gradient-to-br from-amber-400 to-orange-500"  loading={loading} />
        <StatCard label="Approved Bids"        value={stats.reviewed}  Icon={FaCheckCircle}        gradient="bg-gradient-to-br from-emerald-400 to-emerald-600" loading={loading} />
        <StatCard label="Rejected / Re-Analyze" value={stats.reAnalyze} Icon={FaExclamationTriangle} gradient="bg-gradient-to-br from-rose-500 to-rose-700"      loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Daily Bar Chart */}
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-black text-slate-800 mb-5 flex items-center gap-3 uppercase tracking-tight">
            <div className="w-1 h-6 bg-blue-600 rounded-full" /> Daily Activity
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={DAILY_DATA}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 11, fill: "#64748b" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Bar dataKey="bids" radius={[6, 6, 0, 0]} barSize={28}>
                {DAILY_DATA.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <h3 className="w-full text-base font-black text-slate-800 mb-2 flex items-center gap-3 uppercase tracking-tight">
            <div className="w-1 h-6 bg-indigo-600 rounded-full" /> Status Ratio
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} innerRadius={55} outerRadius={82} paddingAngle={5} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: "bold", paddingTop: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-1 text-center">
            <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{stats.total}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Bids</p>
          </div>
        </div>
      </div>

      {/* Monthly Area Chart */}
      <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-black text-slate-800 mb-5 flex items-center gap-3 uppercase tracking-tight">
          <FaChartLine className="text-blue-600" /> Monthly Performance
        </h3>
        <ResponsiveContainer width="100%" height={270}>
          <AreaChart data={MONTHLY_DATA}>
            <defs>
              <linearGradient id="gradApp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={STATUS_COLORS.approved} stopOpacity={0.2} />
                <stop offset="95%" stopColor={STATUS_COLORS.approved} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 11, fill: "#64748b" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 600, fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
            <Area type="monotone" dataKey="approved" name="Approved" stroke={STATUS_COLORS.approved} strokeWidth={3} fillOpacity={1} fill="url(#gradApp)" />
            <Area type="monotone" dataKey="rejected" name="Rejected" stroke={STATUS_COLORS.rejected} strokeWidth={3} fill="transparent" />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10, fontSize: "11px", fontWeight: "bold" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ─── Main Navbar (Merged) ──────────────────────────────────────────────────────

const AnalyserNavbar = () => {
  const [bidsOpen, setBidsOpen] = useState(true);
  const [username, setUsername] = useState("Analyser");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem("analyser_username");
    if (stored && stored !== "undefined" && stored !== "null") setUsername(stored);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("analyser_username");
    navigate("/");
  };

  const isActive = (path) => location.pathname.startsWith(path);
  const isDashboard = location.pathname === "/analyser-dashboard" || location.pathname === "/analyser-dashboard/";

  return (
    <div className="h-screen w-full flex bg-[#f8fafc]">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-72 bg-[#0f172a] text-white flex flex-col shrink-0 shadow-2xl z-20">

        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-lg font-black text-white shadow-lg shadow-blue-900/40">A</div>
            <span className="text-xl font-black tracking-tighter uppercase text-white">Analyser</span>
          </div>
        </div>

        <nav className="flex-1 p-5 space-y-2 overflow-y-auto">

          {/* Dashboard Nav Item */}
          <div
            onClick={() => navigate("/analyser-dashboard")}
            className={`flex items-center gap-4 p-3.5 rounded-xl text-[14px] font-black cursor-pointer transition-all
              ${isDashboard
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
          >
            <FaTachometerAlt className={isDashboard ? "text-white text-base" : "text-blue-500 text-base"} />
            Dashboard
          </div>

          {/* View Bids Accordion */}
          <button
            onClick={() => setBidsOpen(!bidsOpen)}
            className="w-full flex items-center justify-between p-3.5 bg-slate-800/40 rounded-xl text-[14px] font-black border border-slate-700/50 text-slate-200 transition-colors hover:bg-slate-800/70"
          >
            <span className="flex items-center gap-4"><FaBox className="text-blue-500 text-base" /> View Bids</span>
            <FaChevronDown className={`transition-transform text-slate-500 ${bidsOpen ? "rotate-180" : ""}`} />
          </button>

          {bidsOpen && (
            <div className="mt-1 space-y-1 px-2">
              {/* Bid products */}
              {BID_PRODUCTS.map((item) => (
                <div
                  key={item.key}
                  onClick={() => item.ready && navigate(`/analyser-dashboard/${item.key}`)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg text-[13px] font-bold transition-all
                    ${!item.ready ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                    ${isActive(`/analyser-dashboard/${item.key}`)
                      ? "bg-blue-900/50 text-blue-400 border border-blue-800/50"
                      : item.ready ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500"
                    }`}
                >
                  <span className="flex items-center gap-3">
                    <span style={{ color: item.color }}>{item.icon}</span>
                    {item.label}
                  </span>
                  {!item.ready && (
                    <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full font-black">SOON</span>
                  )}
                </div>
              ))}

              {/* Divider */}
              <div className="border-t border-slate-700/50 my-1.5" />

              {/* Product — opens AnalyserProductsPage */}
              <div
                onClick={() => navigate("/analyser-dashboard/product")}
                className={`flex items-center gap-3 p-3 rounded-lg text-[13px] font-bold cursor-pointer transition-all
                  ${isActive("/analyser-dashboard/product")
                    ? "bg-blue-900/50 text-blue-400 border border-blue-800/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
              >
                <span style={{ color: "#ec4899" }}><FaBox /></span>
                Product
              </div>
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="p-5 border-t border-slate-800 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white p-3.5 rounded-xl font-black text-[13px] uppercase tracking-widest transition-all border border-rose-600/20"
          >
            <FaSignOutAlt className="text-base" /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-20 bg-white border-b-2 border-slate-50 flex items-center justify-between px-8 shrink-0 z-10">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 leading-none">Analyser Panel</p>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
              {isDashboard ? "Dashboard" : "System Control"}
            </h1>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
            <div className="text-right">
              <p className="text-[8px] font-black text-slate-400 leading-none mb-0.5 uppercase">Welcome back</p>
              <p className="text-sm font-black text-slate-900 leading-none">{username}</p>
            </div>
            <FaUserCircle className="text-blue-600 text-3xl" />
          </div>
        </header>

        {/* Page Content */}
        <section className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          {isDashboard ? <AnalyserHome /> : <Outlet />}
        </section>
      </main>
    </div>
  );
};

export default AnalyserNavbar;