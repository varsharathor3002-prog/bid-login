import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Login() {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // ✅ Role check
        if (data.role !== role) {
          alert("Selected role is incorrect ❌");
          return;
        }

        // ✅ Save user data
        localStorage.setItem("role", data.role);
        localStorage.setItem("username", username);

        // 🔥 CLEAN ROUTING (FIXED)
        const routes = {
          user: "/user",
          admin: "/admin-dashboard",
          analyser: "/analyser-dashboard",
        };

        navigate(routes[data.role]);

      } else {
        alert(data.error || "Login failed ❌");
      }

    } catch (error) {
      alert("Backend not connected ❌");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">

      <div className="bg-white/20 backdrop-blur-lg border border-white/30 shadow-2xl p-8 rounded-2xl w-[350px] text-white">

        {/* Title */}
        <h2 className="text-2xl font-bold text-center">Welcome Back</h2>
        <p className="text-sm text-center mb-6 text-white/80">
          Login to your account
        </p>

        <form onSubmit={handleLogin}>

          {/* Role Selection */}
          <div className="flex gap-2 mb-5 text-xs">
            {["user", "analyser", "admin"].map((r) => (
              <label
                key={r}
                className={`flex-1 text-center py-2 rounded-full cursor-pointer transition ${
                  role === r
                    ? "bg-white text-indigo-600 font-semibold shadow"
                    : "bg-white/20 hover:bg-white/30"
                }`}
              >
                <input
                  type="radio"
                  value={r}
                  hidden
                  checked={role === r}
                  onChange={(e) => setRole(e.target.value)}
                />
                {r === "user"
                  ? "Bid Data"
                  : r === "analyser"
                  ? "Analyzer"
                  : "Admin"}
              </label>
            ))}
          </div>

          {/* Username */}
          <input
            type="text"
            placeholder="Username"
            className="w-full p-2 mb-4 rounded-lg bg-white/80 text-black outline-none focus:ring-2 focus:ring-indigo-400"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          {/* Password */}
          <div className="relative mb-5">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-2 pr-10 rounded-lg bg-white/80 text-black outline-none focus:ring-2 focus:ring-indigo-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-600 hover:text-indigo-600"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* Button */}
          <button className="w-full bg-white text-indigo-600 font-semibold py-2 rounded-full hover:scale-105 transition transform">
            Login
          </button>

        </form>

        {/* Signup */}
        {role === "user" && (
          <p className="text-xs text-center mt-4 text-white/90">
            Not a Member?{" "}
            <Link to="/register" className="font-semibold underline">
              Signup
            </Link>
          </p>
        )}

      </div>
    </div>
  );
}

export default Login;