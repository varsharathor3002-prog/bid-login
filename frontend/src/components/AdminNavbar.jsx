import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FaSignOutAlt, FaChevronDown, FaCheckCircle,
  FaUserPlus, FaBoxOpen,FaUserCircle,
} from "react-icons/fa";

const bidItems = [
  { name: "Desktop Bid Approval",     path: "/admin-dashboard/desktop-bid-approval",     ready: true  },
  { name: "AIO Bid Approval",         path: "/aio-bid-approval",         ready: false },
  { name: "Workstation Bid Approval", path: "/workstation-bid-approval", ready: false },
  { name: "Printer Bid Approval",     path: "/printer-bid-approval",     ready: false },
  { name: "Toner Bid Approval",       path: "/toner-bid-approval",       ready: false },
];

const adminItems = [
  { name: "Add User",    path: "/add-user",    icon: <FaUserPlus /> },
  { name: "Add Product", path: "/add-product", icon: <FaBoxOpen />  },
];

const AdminNavbar = () => {
  const [openBid,   setOpenBid]   = useState(true);
  const [openAdmin, setOpenAdmin] = useState(false);
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

        {/* Title — Admin Panel dropdown */}
        <button
          onClick={() => setOpenAdmin(!openAdmin)}
          className="flex items-center justify-between w-full px-4 py-4 text-xl font-bold border-b border-gray-700 hover:bg-gray-800 transition"
        >
          <span>🛡️ Admin Panel</span>
          <span className={`text-sm ${openAdmin ? "rotate-180" : ""} transition duration-200`}>
            <FaChevronDown />
          </span>
        </button>

        {/* Admin dropdown under title */}
        {openAdmin && (
          <div className="bg-gray-800 border-b border-gray-700">
            {adminItems.map((item) => (
              <div
                key={item.path}
                onClick={() => { navigate(item.path); setOpenAdmin(false); }}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm cursor-pointer transition
                  ${isActive(item.path) ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
              >
                {item.icon}
                {item.name}
              </div>
            ))}
          </div>
        )}

        {/* Menu */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">

          {/* --- Bid Approval Section --- */}
          <button
            onClick={() => setOpenBid(!openBid)}
            className="flex items-center justify-between w-full px-3 py-2 bg-gray-800 rounded hover:bg-gray-700"
          >
            <span className="flex items-center gap-2">
              <FaCheckCircle /> Bid Approval
            </span>
            <span className={`${openBid ? "rotate-180" : ""} transition duration-200`}>
              <FaChevronDown />
            </span>
          </button>

          {openBid && (
            <div className="mt-1 space-y-1 ml-2">
              {bidItems.map((item) => (
                <div
                  key={item.path}
                  onClick={() => item.ready && navigate(item.path)}
                  className={`flex items-center justify-between px-3 py-2 rounded transition
                    ${!item.ready ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    ${isActive(item.path) ? "bg-blue-600" : item.ready ? "hover:bg-gray-700" : ""}`}
                >
                  <span className="flex items-center gap-2 text-sm">
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
          <h1 className="text-lg font-semibold text-gray-700">Admin Dashboard</h1>
          <div className="flex items-center gap-2 text-gray-700 font-medium">

      <FaUserCircle className="text-2xl text-blue-600" />

      <span>

        {localStorage.getItem("admin_username") || "Admin"}

      </span>

    </div>

  </div>

  <div className="p-6">

    <Outlet />

  </div>

</div>
    </div>
  );
};

export default AdminNavbar;
