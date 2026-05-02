import { useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminNavbar() {
  const [openMenu, setOpenMenu] = useState(null);
  const navigate = useNavigate();

  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="flex justify-between items-center bg-slate-800 px-8 py-3 text-white shadow-md">

      {/* Logo */}
      <div className="text-lg font-bold">
        Gem Bid Admin
      </div>

      {/* Menu */}
      <ul className="flex gap-8 text-sm relative">

        {/* 1️⃣ Bid Approval */}
        <li
          className="relative cursor-pointer"
          onClick={() => toggleMenu("bid")}
        >
          Bid Approval ▾

          {openMenu === "bid" && (
            <ul className="absolute top-8 left-0 bg-white text-black rounded-lg shadow-lg w-52 py-2 z-50">

              <li
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => navigate("/desktop-bid-approval")}
              >
                Desktop Bid Approval
              </li>

              <li
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => navigate("/aio-bid-approval")}
              >
                AIO Bid Approval
              </li>

              <li className="px-4 py-2 hover:bg-gray-100">
                Workstation Bid Approval
              </li>

              <li className="px-4 py-2 hover:bg-gray-100">
                Printer Bid Approval
              </li>

              <li className="px-4 py-2 hover:bg-gray-100">
                Bounch Bid Approval
              </li>

            </ul>
          )}
        </li>

        {/* 2️⃣ Price List */}
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
              <li onClick={() => navigate("/price/AIOM")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                AIO Monitor Price
              </li>


              <li onClick={() => navigate("/price/cabinet")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Cabinet Price
              </li>

              <li onClick={() => navigate("/price/processor")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Processor Price
              </li>

              <li onClick={() => navigate("/price/ram")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                RAM Price
              </li>

              <li onClick={() => navigate("/price/hdd")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Hard Disk Drive Price
              </li>

              <li onClick={() => navigate("/price/ssd")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Solid State Drive Price
              </li>

              <li onClick={() => navigate("/price/gp")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Graphics Card Price
              </li>

              <li onClick={() => navigate("/price/os")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Operating System Price
              </li>

              <li onClick={() => navigate("/price/motherboard")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Motherboard Price
              </li>
              <li onClick={() => navigate("/price/AIOMotherboard")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                AIO Motherboard Price
              </li>

              <li onClick={() => navigate("/price/dvd")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                DVD Price
              </li>

              <li onClick={() => navigate("/price/wifi")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Wi-Fi Bluetooth Price
              </li>

              <li onClick={() => navigate("/price/keyboard")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Keyboard & Mouse Price
              </li>

              <li onClick={() => navigate("/price/warranty")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Warranty Price
              </li>

              <li onClick={() => navigate("/price/software1")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Software 1 Price
              </li>

              <li onClick={() => navigate("/price/software2")} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                Software 2 Price
              </li>

            </ul>
          )}
        </li>

        {/* 3️⃣ Partner (no dropdown now) */}
        <li className="cursor-pointer">
          Partner
        </li>

        {/* Logout */}
        <li
          className="cursor-pointer text-red-400 hover:text-red-600 font-medium"
          onClick={handleLogout}
        >
          Logout
        </li>

      </ul>
    </div>
  );
}

export default AdminNavbar;