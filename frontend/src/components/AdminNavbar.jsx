import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
  FaSync,
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

const API_BASE = "http://127.0.0.1:8000/api";

// ===================== DATA =====================

const bidItems = [
  { name: "Desktop Bid Approval",     path: "/admin-dashboard/desktop-bid-approval", ready: true  },
  { name: "AIO Bid Approval",         path: "/aio-bid-approval",                     ready: false },
  { name: "Workstation Bid Approval", path: "/workstation-bid-approval",              ready: false },
  { name: "Printer Bid Approval",     path: "/printer-bid-approval",                 ready: false },
  { name: "Toner Bid Approval",       path: "/toner-bid-approval",                   ready: false },
];

const adminItems = [
  { name: "Add User",     path: "/admin-dashboard/add-user",     icon: <FaUserPlus /> },
  { name: "Add Analyser", path: "/admin-dashboard/add-analyser", icon: <FaUserCircle /> },
];

const weeklyData = [
  { day: "Mon", bids: 5 },
  { day: "Tue", bids: 8 },
  { day: "Wed", bids: 6 },
  { day: "Thu", bids: 12 },
  { day: "Fri", bids: 9 },
  { day: "Sat", bids: 3 },
  { day: "Sun", bids: 1 },
];

const monthlyTrend = [
  { month: "Jan", approved: 30, rejected: 5 },
  { month: "Feb", approved: 45, rejected: 8 },
  { month: "Mar", approved: 38, rejected: 6 },
  { month: "Apr", approved: 52, rejected: 10 },
  { month: "May", approved: 47, rejected: 7 },
  { month: "Jun", approved: 60, rejected: 12 },
];

const PIE_COLORS = ["#10b981", "#f43f5e", "#f59e0b"];

const recentActivity = [
  { id: "#1042", product: "Desktop", status: "Pending"  },
  { id: "#1041", product: "Desktop", status: "Approved" },
  { id: "#1039", product: "Desktop", status: "Rejected" },
  { id: "#1038", product: "Desktop", status: "Approved" },
  { id: "#1036", product: "Desktop", status: "Approved" },
];

const statusStyle = {
  Pending:  "bg-amber-50  text-amber-600  border border-amber-300",
  Approved: "bg-emerald-50 text-emerald-600 border border-emerald-300",
  Rejected: "bg-rose-50   text-rose-600   border border-rose-300",
};

// ===================== METRIC CARD =====================

const MetricCard = ({ icon, num, label, gradient, iconBg, loading = false }) => (
  <div className={`relative rounded-2xl p-5 flex items-center gap-4 shadow-md overflow-hidden ${gradient}`}>
    {/* Background decoration */}
    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white opacity-10" />
    <div className="absolute -right-1 -bottom-6 w-16 h-16 rounded-full bg-white opacity-10" />

    <div className={`relative z-10 text-2xl ${iconBg} p-3 rounded-xl shadow-inner flex items-center justify-center`}>
      {icon}
    </div>

    <div className="relative z-10">
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white bg-opacity-30 rounded-lg animate-pulse" />
        </div>
      ) : (
        <p className="text-4xl font-extrabold text-white leading-none">{num ?? "—"}</p>
      )}
      <p className="text-sm font-medium mt-1 text-white opacity-90">{label}</p>
    </div>
  </div>
);

// ===================== DASHBOARD HOME =====================

const AdminHome = () => {
  const [stats, setStats] = useState({
    totalToday: null,
    pending: null,
    approved: null,
    reAnalyze: null,
    userCount: null,
    analyserCount: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const [pendingRes, approvedRes, reAnalyzeRes, usersRes, analysersRes] = await Promise.allSettled([
        fetch(`${API_BASE}/desktop-bids/list/?status=pending&role=admin`),
        fetch(`${API_BASE}/desktop-bids/list/?status=approved&role=admin`),
        fetch(`${API_BASE}/desktop-bids/list/?status=re-analyze&role=admin`),
        fetch(`${API_BASE}/user-list/`),
        fetch(`${API_BASE}/analyser-list/`),
      ]);

      const safeJson = async (res) => {
        try {
          const data = await res.value?.json();
          return Array.isArray(data) ? data.length : null;
        } catch { return null; }
      };

      const pending     = await safeJson(pendingRes);
      const approved    = await safeJson(approvedRes);
      const reAnalyze   = await safeJson(reAnalyzeRes);
      const userCount   = await safeJson(usersRes);
      const analyserCount = await safeJson(analysersRes);

      const totalToday = (pending ?? 0) + (approved ?? 0) + (reAnalyze ?? 0);

      setStats({ totalToday, pending, approved, reAnalyze, userCount, analyserCount });
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Stats fetch error:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const pieData = [
    { name: "Approved",   value: stats.approved   ?? 0 },
    { name: "Re-Analyze", value: stats.reAnalyze  ?? 0 },
    { name: "Pending",    value: stats.pending     ?? 0 },
  ];

  return (
    <div className="space-y-6">

      {/* ROW 1 — 4 BID CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<FaFileInvoiceDollar className="text-blue-600" />}
          num={stats.totalToday}
          label="Total Bids"
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          iconBg="bg-blue-100"
          loading={statsLoading}
        />
        <MetricCard
          icon={<FaHourglassHalf className="text-amber-500" />}
          num={stats.pending}
          label="Pending Review"
          gradient="bg-gradient-to-br from-amber-400 to-amber-500"
          iconBg="bg-amber-100"
          loading={statsLoading}
        />
        <MetricCard
          icon={<FaThumbsUp className="text-emerald-600" />}
          num={stats.approved}
          label="Approved Bids"
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          iconBg="bg-emerald-100"
          loading={statsLoading}
        />
        <MetricCard
          icon={<FaThumbsDown className="text-rose-600" />}
          num={stats.reAnalyze}
          label="Re-Analyze"
          gradient="bg-gradient-to-br from-rose-500 to-rose-600"
          iconBg="bg-rose-100"
          loading={statsLoading}
        />
      </div>

      {/* ROW 2 — 2 ACCOUNT CARDS */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          icon={<FaUsers className="text-violet-600" />}
          num={stats.userCount}
          label="Total Users Registered"
          gradient="bg-gradient-to-br from-violet-500 to-violet-600"
          iconBg="bg-violet-100"
          loading={statsLoading}
        />
        <MetricCard
          icon={<FaUserTie className="text-cyan-600" />}
          num={stats.analyserCount}
          label="Total Analysers Registered"
          gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
          iconBg="bg-cyan-100"
          loading={statsLoading}
        />
      </div>

      {/* BAR + PIE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">This Week</p>
          <h2 className="text-base font-bold text-gray-700 mb-4">Weekly Bid Submissions</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} barSize={32}>
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: "10px", fontSize: "13px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                cursor={{ fill: "#f9fafb" }}
              />
              <Bar dataKey="bids" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Overview</p>
          <h2 className="text-base font-bold text-gray-700 mb-4">Bid Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "10px", fontSize: "13px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
              <Legend
                iconType="circle"
                iconSize={9}
                formatter={(val) => <span style={{ fontSize: "12px", color: "#6b7280" }}>{val}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* LINE CHART */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">6 Month View</p>
        <h2 className="text-base font-bold text-gray-700 mb-4">Approved vs Re-Analyze — Monthly Trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyTrend}>
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: "10px", fontSize: "13px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
            <Legend
              iconType="circle"
              iconSize={9}
              formatter={(val) => <span style={{ fontSize: "12px", color: "#6b7280" }}>{val}</span>}
            />
            <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="rejected"  stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4, fill: "#f43f5e" }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Latest</p>
        <h2 className="text-base font-bold text-gray-700 mb-4">Recent Bid Activity</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-100">
              <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bid ID</th>
              <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Product</th>
              <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="py-3 text-gray-800 font-semibold">{row.id}</td>
                <td className="py-3 text-gray-500">{row.product}</td>
                <td className="py-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusStyle[row.status]}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

// ===================== MAIN NAVBAR =====================

const AdminNavbar = () => {

  const [openBid, setOpenBid] = useState(true);
  const [openAdmin, setOpenAdmin] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const isActive = (path) => location.pathname.startsWith(path);
  const isDashboardHome = location.pathname === "/admin-dashboard";

  return (
    <div className="h-screen w-full flex bg-gray-100 overflow-hidden">

      {/* ================= SIDEBAR ================= */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">

        {/* HEADER */}
        <button
          onClick={() => setOpenAdmin(!openAdmin)}
          className="flex items-center justify-between w-full px-4 py-4 text-xl font-bold border-b border-gray-700 hover:bg-gray-800 transition"
        >
          <span>🛡️ Admin Panel</span>
          <span className={`text-sm transition duration-200 ${openAdmin ? "rotate-180" : ""}`}>
            <FaChevronDown />
          </span>
        </button>

        {/* ADMIN DROPDOWN */}
        {openAdmin && (
          <div className="bg-gray-800 border-b border-gray-700">
            {adminItems.map((item) => (
              <div
                key={item.path}
                onClick={() => { navigate(item.path); setOpenAdmin(false); }}
                className={`flex items-center gap-3 px-6 py-3 text-sm cursor-pointer transition ${
                  isActive(item.path)
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {item.icon}
                {item.name}
              </div>
            ))}
          </div>
        )}

        {/* MENU */}
        <div className="flex-1 p-3 overflow-y-auto">

          <button
            onClick={() => setOpenBid(!openBid)}
            className="flex items-center justify-between w-full px-3 py-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <FaCheckCircle />
              Bid Approval
            </span>
            <span className={`transition duration-200 ${openBid ? "rotate-180" : ""}`}>
              <FaChevronDown />
            </span>
          </button>

          {openBid && (
            <div className="mt-2 space-y-1">
              {bidItems.map((item) => (
                <div
                  key={item.path}
                  onClick={() => item.ready && window.open(item.path, "_self")}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition ${
                    !item.ready ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  } ${
                    isActive(item.path)
                      ? "bg-blue-600 text-white"
                      : item.ready
                      ? "hover:bg-gray-700 text-gray-200"
                      : "text-gray-400"
                  }`}
                >
                  <span className="text-sm">{item.name}</span>
                  {!item.ready && (
                    <span className="text-[10px] bg-gray-600 px-2 py-0.5 rounded-full">Soon</span>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* LOGOUT */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full bg-red-500 hover:bg-red-600 px-4 py-3 rounded-lg transition font-medium"
          >
            <FaSignOutAlt />
            Logout
          </button>
        </div>

      </div>

      {/* ================= RIGHT SIDE ================= */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOPBAR */}
        <div className="flex items-center justify-between bg-white shadow px-6 py-4 border-b">
          <h1 className="text-xl font-bold text-gray-700">Admin Dashboard</h1>
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <FaUserCircle className="text-2xl text-blue-600" />
            <span>{localStorage.getItem("admin_username") || "Admin"}</span>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto p-6">
          {isDashboardHome ? <AdminHome /> : <Outlet />}
        </div>

      </div>

    </div>
  );
};

export default AdminNavbar;