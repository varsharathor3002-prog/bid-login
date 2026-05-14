import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

import {
  FaBox,
  FaDesktop,
  FaLaptop,
  FaServer,
  FaPrint,
  FaSignOutAlt,
  FaUserCircle,
} from "react-icons/fa";

const menuItems = [
  {
    name: "Desktop",
    path: "/analyser-dashboard/desktop",
    icon: <FaDesktop />,
    ready: true,
  },

  {
    name: "AIO",
    path: "/analyser-dashboard/aio",
    icon: <FaLaptop />,
    ready: false,
  },

  {
    name: "Workstation",
    path: "/analyser-dashboard/workstation",
    icon: <FaServer />,
    ready: false,
  },

  {
    name: "Printer",
    path: "/analyser-dashboard/printer",
    icon: <FaPrint />,
    ready: false,
  },

  {
    name: "Toner",
    path: "/analyser-dashboard/toner",
    icon: <FaBox />,
    ready: false,
  },

  {
    name: "Product",
    path: "/analyser-dashboard/product",
    icon: <FaBox />,
    ready: true,
  },
];

const AnalyserNavbar = () => {
  const [username, setUsername] = useState("Analyser");

  const navigate = useNavigate();

  const location = useLocation();

  // ✅ Get analyser username
  useEffect(() => {
    const storedUsername = localStorage.getItem("analyser_username");

    if (
      storedUsername &&
      storedUsername !== "undefined" &&
      storedUsername !== "null"
    ) {
      setUsername(storedUsername);
    }
  }, []);

  // ✅ Logout
  const handleLogout = () => {
    localStorage.removeItem("analyser_username");

    navigate("/");
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="h-screen w-full flex bg-gray-100">
      {/* SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-gray-700">
          🔍 Analyser Panel
        </div>

        <div className="flex-1 p-3">
          <div className="mt-2 space-y-1 ml-2">
            {menuItems.map((item) => (
              <div
                key={item.path}
                onClick={() => item.ready && navigate(item.path)}
                className={`flex items-center justify-between px-3 py-2 rounded transition

                    ${
                      !item.ready
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    }

                    ${
                      isActive(item.path)
                        ? "bg-blue-600"
                        : item.ready
                        ? "hover:bg-gray-700"
                        : ""
                    }`}
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
        </div>

        {/* LOGOUT */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full bg-red-500 px-3 py-2 rounded hover:bg-red-600 transition"
          >
            <FaSignOutAlt />

            Logout
          </button>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center bg-white shadow px-6 py-4 border-b">
          <h1 className="text-xl font-semibold text-gray-700">
            Analyser Dashboard
          </h1>

          {/* SAME USER ICON */}
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <FaUserCircle className="text-2xl text-blue-600" />

            <span>{username}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AnalyserNavbar;