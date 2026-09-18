import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { FaSignOutAlt, FaBan, FaClipboardList, FaChartLine } from "react-icons/fa";
import { connectGemExtension } from "../../utils/connectGemExtension";

const managementItems = [
  { name: "Disqualified Bid", path: "/management-dashboard/disqualified-bids", icon: <FaBan className="text-red-400" /> },
  { name: "Bid To Be Participated", path: "/management-dashboard/bid-to-be-participated", icon: <FaClipboardList className="text-amber-400" /> },
  { name: "Awarded Bid/RA Rankings", path: "/management-dashboard/financial-rankings", icon: <FaChartLine className="text-emerald-400" /> },
];

const ManagementHome = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
    <div className="text-6xl">👈</div>
    <h2 className="text-2xl font-bold text-gray-600">Select an option from Sidebar</h2>
    <p className="text-gray-400 text-sm">Choose an option from the left sidebar.</p>
  </div>
);

export default function ManagementNavbar() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if ((sessionStorage.getItem("role") || localStorage.getItem("role")) !== "management") {
      navigate("/", { replace: true });
      return;
    }
    const stored = sessionStorage.getItem("management_username") || localStorage.getItem("management_username");
    if (stored && stored !== "undefined" && stored !== "null" && stored.trim() !== "") {
      setUsername(stored.trim());
    }
  }, [navigate]);

  useEffect(() => connectGemExtension(), []);

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem("management_username");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("display_username");
    localStorage.removeItem("email");
    localStorage.removeItem("token");
    navigate("/");
  };

  const isActive = (path) => location.pathname.startsWith(path);
  const isDashboard = location.pathname === "/management-dashboard" || location.pathname === "/management-dashboard/";

  return (
    <div className="h-screen w-full flex bg-gray-100 overflow-hidden">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-highlight { -webkit-tap-highlight-color: transparent; }
        .no-highlight:focus, .no-highlight:active { outline: none !important; box-shadow: none !important; }
      `}</style>

      <div className="w-64 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col shadow-2xl">
        <div className="relative p-6 border-b border-gray-700/50 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-3xl transform translate-x-8 -translate-y-8"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg ring-4 ring-blue-500/20">
                  {(username || "M").charAt(0).toUpperCase()}
                </div>
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800 animate-pulse"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Welcome Back</p>
                <h3 className="text-lg font-bold text-white break-words leading-snug" title={username || "Management"}>
                  {username || "Management"} 👋
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400 font-medium">Online • Management Panel</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-3 overflow-y-auto hide-scrollbar">
          {managementItems.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-2 focus:outline-none focus:ring-0 no-highlight select-none ${
                isActive(item.path) ? "bg-gray-700/50 text-white" : "hover:bg-gray-700/50 text-gray-200"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium">{item.name}</span>
            </div>
          ))}
        </div>

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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center bg-white shadow-sm px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Management Dashboard</h1>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800">{username || "Management"}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
              {(username || "M").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {isDashboard ? <ManagementHome /> : <Outlet />}
        </div>
      </div>
    </div>
  );
}
