import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FaBox, FaDesktop, FaLaptop, FaServer, FaPrint,
  FaSignOutAlt, FaChevronDown,
} from "react-icons/fa";

const menuItems = [
  { name: "Desktop",     path: "/analyser-dashboard/desktop",     icon: <FaDesktop />, ready: true  },
  { name: "AIO",         path: "/analyser-dashboard/aio",         icon: <FaLaptop />,  ready: false },
  { name: "Workstation", path: "/analyser-dashboard/workstation", icon: <FaServer />,  ready: false },
  { name: "Printer",     path: "/analyser-dashboard/printer",     icon: <FaPrint />,   ready: false },
  { name: "Toner",       path: "/analyser-dashboard/toner",       icon: <FaBox />,     ready: false },
];

const AnalyserNavbar = () => {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="h-screen w-full flex bg-gray-100">

      {/* ===== SIDEBAR ===== */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">

        {/* Title */}
        <div className="p-4 text-xl font-bold border-b border-gray-700">
          🔍 Analyser Panel
        </div>

        {/* Menu */}
        <div className="flex-1 p-3">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center justify-between w-full px-3 py-2 bg-gray-800 rounded hover:bg-gray-700"
          >
            <span className="flex items-center gap-2">
              <FaBox /> Product
            </span>
            <span className={`${open ? "rotate-180" : ""} transition duration-200`}>
              <FaChevronDown />
            </span>
          </button>

          {open && (
            <div className="mt-2 space-y-1 ml-2">
              {menuItems.map((item) => (
                <div
                  key={item.path}
                  onClick={() => item.ready && navigate(item.path)}
                  className={`flex items-center justify-between px-3 py-2 rounded transition
                    ${!item.ready ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    ${isActive(item.path) ? "bg-blue-600" : item.ready ? "hover:bg-gray-700" : ""}`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    {item.icon}
                    {item.name}
                  </span>
                  {!item.ready && (
                    <span className="text-[10px] bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full">
                      Soon
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full bg-red-500 px-3 py-2 rounded hover:bg-red-600 transition"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>

      {/* ===== RIGHT SIDE ===== */}
      <div className="flex-1 bg-white overflow-auto">
        <div className="flex justify-between items-center bg-white shadow px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-700">Analyser Dashboard</h1>
          <div className="text-sm text-gray-600">
            👤 {localStorage.getItem("username") || "Analyser"}
          </div>
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </div>

    </div>
  );
};

export default AnalyserNavbar;