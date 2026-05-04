import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { motion } from "framer-motion";

// 👉 If using src/assets folder, uncomment below and place image there
// import loginImg from "../../assets/login_img.png";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.role !== role) {
          alert("Selected role is incorrect ❌");
          return;
        }

        localStorage.setItem("role", data.role);
        localStorage.setItem("username", data.username);

        const routes = {
          user: "/user",
          admin: "/admin-dashboard",
          analyser: "/analyser-dashboard",
        };

        navigate(routes[data.role]);
      } else {
        alert(data.error || "Login failed ❌");
      }
    } catch {
      alert("Backend not connected ❌");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="flex w-full max-w-4xl h-[560px] shadow-2xl rounded-3xl overflow-hidden">

        {/* LEFT - FORM */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/2 p-8 text-white" style={{ backgroundColor: '#1E2A56' }}
        >
          <h2 className="text-4xl font-bold mb-2 text-black">Welcome Back</h2>
          <p className="text-base text-black/80 mb-6">Login to your account</p>

          <form onSubmit={handleLogin}>

            {/* Role */}
            <div className="flex gap-2 mb-5 text-xs">
              {["user", "analyser", "admin"].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded-full transition-all duration-300 ${
                    role === r
                      ? "bg-white text-blue-700 font-semibold shadow"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                >
                  {r === "user"
                    ? "Bid Data Feeding"
                    : r === "analyser"
                    ? "Bid Analyser"
                    : "Admin"}
                </button>
              ))}
            </div>

            {/* Username */}
            <input
              type="text"
              placeholder="Username"
              className="w-full p-3 mb-4 rounded-lg bg-white text-black outline-none focus:ring-2 focus:ring-blue-400 text-base"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            {/* Password */}
            <div className="relative mb-5">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full p-3 pr-10 rounded-lg bg-white text-black outline-none focus:ring-2 focus:ring-blue-400 text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-600 hover:text-blue-600"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <button className="w-full bg-white text-blue-900 font-semibold py-3 rounded-full hover:scale-105 transition text-lg">
              Login
            </button>
          </form>

          {role === "user" && (
            <p className="text-xs text-center mt-4">
              Not a Member?{' '}
              <Link to="/register" className="underline font-semibold">
                Signup
              </Link>
            </p>
          )}
        </motion.div>

        {/* RIGHT - IMAGE */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden md:flex w-1/2 bg-white items-center justify-center"
        >
          {/* ✅ Option 1: public folder */}
          <img
            src="/login_img.png"
            alt="login"
            className="w-full h-full object-cover rounded-r-3xl"
          />

          {/* ✅ Option 2: assets import (use this instead of above if importing) */}
          {/* <img src={loginImg} alt="login" className="w-full h-full object-cover rounded-r-3xl" /> */}
        </motion.div>

      </div>
    </div>
  );
}
