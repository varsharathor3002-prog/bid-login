import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

import {
  FaBox,
  FaDesktop,
  FaLaptop,
  FaServer,
  FaUserTie,
  FaSignOutAlt,
  FaChevronDown,
  FaUserCircle,
} from "react-icons/fa";

const UserNavbar = () => {

  const [open, setOpen] = useState(true);

  const [username, setUsername] = useState("User");

  const navigate = useNavigate();

  const location = useLocation();

  // ✅ Get username from localStorage
  useEffect(() => {

    const storedUsername =
      localStorage.getItem("username");

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

    localStorage.clear();

    navigate("/");

  };

  // ✅ Active menu
  const isActive = (path) =>
    location.pathname === path;

  // ✅ Sidebar Menu
  const menuItems = [

    {
      name: "Desktop",
      path: "/user/desktop",
      icon: <FaDesktop />,
    },

    {
      name: "AIO",
      path: "/user/aio",
      icon: <FaLaptop />,
    },

    {
      name: "Workstation",
      path: "/user/workstation",
      icon: <FaServer />,
    },

    {
      name: "Printer",
      path: "/user/printer",
      icon: <FaUserTie />,
    },

    {
      name: "Toner",
      path: "/user/toner",
      icon: <FaUserTie />,
    },

  ];

  return (

    <div className="h-screen w-full flex bg-gray-100 overflow-hidden">

      {/* ================= SIDEBAR ================= */}
      <div className="w-64 bg-gray-900 text-white flex flex-col shadow-lg">

        {/* LOGO */}
        <div className="p-5 text-2xl font-bold border-b border-gray-700 tracking-wide">

          🚀 User Panel

        </div>

        {/* MENU */}
        <div className="flex-1 p-3 overflow-y-auto">

          {/* PRODUCT BUTTON */}
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center justify-between w-full px-4 py-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >

            <span className="flex items-center gap-2 font-medium">

              <FaBox />

              Product

            </span>

            <span
              className={`transition duration-300 ${
                open ? "rotate-180" : ""
              }`}
            >

              <FaChevronDown />

            </span>

          </button>

          {/* DROPDOWN */}
          {open && (

            <div className="mt-3 space-y-2 ml-2">

              {menuItems.map((item) => (

                <div
                  key={item.path}

                  onClick={() =>
                    navigate(item.path)
                  }

                  className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200

                  ${
                    isActive(item.path)
                      ? "bg-blue-600 text-white shadow"
                      : "hover:bg-gray-700 text-gray-200"
                  }`}
                >

                  <span className="text-lg">

                    {item.icon}

                  </span>

                  <span className="text-sm font-medium">

                    {item.name}

                  </span>

                </div>

              ))}

            </div>

          )}

        </div>

        {/* LOGOUT */}
        <div className="p-4 border-t border-gray-700">

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full bg-red-500 hover:bg-red-600 transition py-3 rounded-lg font-medium"
          >

            <FaSignOutAlt />

            Logout

          </button>

        </div>

      </div>

      {/* ================= RIGHT SIDE ================= */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOP HEADER */}
        <div className="flex justify-between items-center bg-white shadow px-6 py-4 border-b">

          <h1 className="text-xl font-semibold text-gray-700">

            Dashboard

          </h1>

          {/* USERNAME */}
          <div className="flex items-center gap-2 text-gray-700 font-medium">

            <FaUserCircle className="text-2xl text-blue-600" />

            <span>

              {username}

            </span>

          </div>

        </div>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">

          <Outlet />

        </div>

      </div>

    </div>
  );
};

export default UserNavbar;