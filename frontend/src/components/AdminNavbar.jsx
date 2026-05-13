import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FaSignOutAlt,
  FaChevronDown,
  FaCheckCircle,
  FaUserPlus,
  FaBoxOpen,
  FaUserCircle,
} from "react-icons/fa";

const bidItems = [
  {
    name: "Desktop Bid Approval",
    path: "/admin-dashboard/desktop-bid-approval",
    ready: true,
  },
  {
    name: "AIO Bid Approval",
    path: "/aio-bid-approval",
    ready: false,
  },
  {
    name: "Workstation Bid Approval",
    path: "/workstation-bid-approval",
    ready: false,
  },
  {
    name: "Printer Bid Approval",
    path: "/printer-bid-approval",
    ready: false,
  },
  {
    name: "Toner Bid Approval",
    path: "/toner-bid-approval",
    ready: false,
  },
];

const adminItems = [
  {
    name: "Add User",
    path: "/admin-dashboard/add-user",
    icon: <FaUserPlus />,
  },

  {
    name: "Add Analyser",
    path: "/admin-dashboard/add-analyser",
    icon: <FaUserCircle />,
  },

];

const AdminNavbar = () => {

  const [openBid, setOpenBid] = useState(true);

  const [openAdmin, setOpenAdmin] = useState(false);

  const navigate = useNavigate();

  const location = useLocation();

  const handleLogout = () => {

    localStorage.clear();

    navigate("/");
  };

  const isActive = (path) =>
    location.pathname.startsWith(path);

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

          <span
            className={`text-sm transition duration-200 ${
              openAdmin ? "rotate-180" : ""
            }`}
          >
            <FaChevronDown />
          </span>

        </button>

        {/* ADMIN DROPDOWN */}

        {openAdmin && (

          <div className="bg-gray-800 border-b border-gray-700">

            {adminItems.map((item) => (

              <div
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setOpenAdmin(false);
                }}
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

          {/* BID APPROVAL */}

          <button
            onClick={() => setOpenBid(!openBid)}
            className="flex items-center justify-between w-full px-3 py-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >

            <span className="flex items-center gap-2 text-sm font-medium">

              <FaCheckCircle />

              Bid Approval

            </span>

            <span
              className={`transition duration-200 ${
                openBid ? "rotate-180" : ""
              }`}
            >
              <FaChevronDown />
            </span>

          </button>

          {openBid && (

            <div className="mt-2 space-y-1">

              {bidItems.map((item) => (

                <div
                  key={item.path}
                  onClick={() =>
                    item.ready && navigate(item.path)
                  }
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition ${
                    !item.ready
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  } ${
                    isActive(item.path)
                      ? "bg-blue-600 text-white"
                      : item.ready
                      ? "hover:bg-gray-700 text-gray-200"
                      : "text-gray-400"
                  }`}
                >

                  <span className="text-sm">

                    {item.name}

                  </span>

                  {!item.ready && (

                    <span className="text-[10px] bg-gray-600 px-2 py-0.5 rounded-full">

                      Soon

                    </span>
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

          <h1 className="text-xl font-bold text-gray-700">

            Admin Dashboard

          </h1>

          <div className="flex items-center gap-2 text-gray-700 font-medium">

            <FaUserCircle className="text-2xl text-blue-600" />

            <span>

              {localStorage.getItem("admin_username") || "Admin"}

            </span>

          </div>

        </div>

        {/* PAGE CONTENT */}

        <div className="flex-1 overflow-auto p-6">

          <Outlet />

        </div>

      </div>

    </div>
  );
};

export default AdminNavbar;