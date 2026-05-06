import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBars } from "react-icons/fa";

function AdminNavbar() {
  const [openMenu, setOpenMenu] = useState(null);
  const [openSide, setOpenSide] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="flex justify-between items-center bg-slate-800 px-8 py-3 text-white shadow-md relative">

      {/* LEFT: Logo */}
      <div className="flex items-center gap-4">
        
        {/* 🔥 Hamburger Icon */}
        <FaBars
          className="text-xl cursor-pointer hover:text-gray-300"
          onClick={() => setOpenSide(!openSide)}
        />

        <div className="text-lg font-bold">
          Gem Bid Admin
        </div>
      </div>

      {/* RIGHT MENU */}
      <ul className="flex gap-8 text-sm">

        {/* Bid Approval */}
        <li
          className="relative cursor-pointer"
          onClick={() => toggleMenu("bid")}
        >
          Bid Approval ▾

          {openMenu === "bid" && (
            <ul className="absolute top-8 left-0 bg-white text-black rounded-lg shadow-lg w-52 py-2 z-50">
              <li onClick={() => navigate("/desktop-bid-approval")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Desktop Bid Approval
              </li>
              <li onClick={() => navigate("/aio-bid-approval")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                AIO Bid Approval
              </li>
            </ul>
          )}
        </li>

        {/* Price List */}
        <li
          className="relative cursor-pointer"
          onClick={() => toggleMenu("price")}
        >
          Price List ▾

          {openMenu === "price" && (
            <ul className="absolute top-8 left-0 bg-white text-black rounded-lg shadow-lg w-64 py-2 z-50 max-h-96 overflow-y-auto">
              <li onClick={() => navigate("/price/monitor")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Monitor Price
              </li>
              <li onClick={() => navigate("/price/ram")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                RAM Price
              </li>
            </ul>
          )}
        </li>

        {/* Logout */}
        <li
          className="cursor-pointer text-red-400 hover:text-red-600 font-medium"
          onClick={handleLogout}
        >
          Logout
        </li>

      </ul>

      {/* 🔥 SIDE DROPDOWN MENU (Hamburger) */}
      {openSide && (
        <div className="absolute top-14 left-6 bg-white text-black rounded-xl shadow-xl w-44 py-2 z-50">

          <div
            onClick={() => {
              navigate("/add-user");
              setOpenSide(false);
            }}
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          >
            Add User
          </div>

          <div
            onClick={() => {
              navigate("/add-product");
              setOpenSide(false);
            }}
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          >
            Add Product
          </div>

        </div>
      )}
    </div>
  );
}

export default AdminNavbar;