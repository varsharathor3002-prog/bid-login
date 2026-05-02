import { FaUser } from "react-icons/fa";
import { useEffect, useState } from "react";

function Header() {
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const loadUser = () => {
      setRole(localStorage.getItem("role"));
      setUsername(localStorage.getItem("username"));
    };

    loadUser();

    window.addEventListener("storage", loadUser);
    return () => window.removeEventListener("storage", loadUser);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="h-[70px] flex justify-between items-center px-10 text-white bg-gradient-to-r from-indigo-500 to-purple-600 shadow-md">

      {/* Logo */}
      <div className="text-xl font-bold">
        Gem Bid Analyzer
      </div>

      {/* Admin Section */}
      {role === "admin" && (
        <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">

          <FaUser className="text-sm" />

          <span className="text-sm">{username}</span>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="bg-white text-indigo-600 text-xs px-3 py-1 rounded-full hover:bg-gray-200 transition"
          >
            Logout
          </button>

        </div>
      )}
    </div>
  );
}

export default Header;