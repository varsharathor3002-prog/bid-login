import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import loginImg from "../../assets/images.png";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#e6f0ff] to-[#cfd9df]">

      {/* MAIN CARD */}
      <div className="flex w-[900px] h-[520px] rounded-2xl overflow-hidden shadow-2xl">

        {/* LEFT IMAGE (CONTAINER SAME, IMAGE SMALL) */}
        <div className="w-1/2 h-full flex items-center justify-center bg-gray-100">
          <img
            src={loginImg}
            alt="login"
            className="w-[100%] h-[200%] object-contain"
          />
        </div>

        {/* RIGHT LOGIN PANEL */}
        <div className="w-1/2 bg-[#1f4d4d] text-white flex flex-col justify-center px-10">

          <h2 className="text-2xl font-bold mb-2 text-center">
            Welcome Back
          </h2>

          <p className="text-sm text-gray-300 text-center mb-5">
            Login to your account
          </p>

          {/* ROLE BUTTONS */}
          <div className="flex gap-2 mb-4 text-xs">
            {["user", "analyser", "admin"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-full transition ${
                  role === r
                    ? "bg-white text-[#1f4d4d] font-semibold"
                    : "bg-white/20 text-white"
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

          {/* USERNAME */}
          <input
            type="text"
            placeholder="Username"
            className="mb-4 p-3 rounded-lg bg-white text-black outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          {/* PASSWORD */}
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-3 pr-10 rounded-lg bg-white text-black outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-600"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* LOGIN BUTTON */}
          <button
            onClick={handleLogin}
            className="bg-orange-500 hover:bg-orange-600 py-3 rounded-lg font-semibold"
          >
            Login
          </button>

          {/* FORGOT PASSWORD */}
          <p className="text-sm text-center mt-4">
  <span
    onClick={() => navigate("/forgot-password")}
    className="text-white-600 cursor-pointer hover:underline"
  >
    Forgot Password?
  </span>
</p>
        </div>
      </div>
    </div>
  );
}