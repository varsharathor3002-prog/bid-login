import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FaBox,
  FaDesktop,
  FaLaptop,
  FaServer,
  FaUserTie,
  FaSignOutAlt,
  FaChevronDown,
} from "react-icons/fa";

const UserNavbar = () => {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;

  // ✅ Sabhi paths /user/... ke andar hain — Outlet mein render honge
  const menuItems = [
    { name: "Desktop",     path: "/user/desktop",     icon: <FaDesktop /> },
    { name: "AIO",         path: "/user/aio",         icon: <FaLaptop /> },
    { name: "Workstation", path: "/user/workstation", icon: <FaServer /> },
    { name: "Printer",     path: "/user/printer",     icon: <FaUserTie /> },
    { name: "Toner",       path: "/user/toner",       icon: <FaUserTie /> },
  ];

  return (
    <div className="h-screen w-full flex bg-gray-100">
      {/* SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-gray-700">
          🚀 User Panel
        </div>

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
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition
                    ${isActive(item.path) ? "bg-blue-600" : "hover:bg-gray-700"}`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full bg-red-500 px-3 py-2 rounded hover:bg-red-600 transition"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>

      {/* RIGHT SIDE — DASHBOARD AREA */}
      <div className="flex-1 bg-white overflow-auto">
        <div className="flex justify-between items-center bg-white shadow px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-700">Dashboard</h1>
          <div className="text-sm text-gray-600">
            👤 {localStorage.getItem("username") || "User"}
          </div>
        </div>

        <div className="p-6">
          {/* ✅ Yahan Desktop, AIO, Workstation etc. render honge */}
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default UserNavbar;