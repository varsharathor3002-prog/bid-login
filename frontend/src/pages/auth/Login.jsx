import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import loginImg from "../../assets/images.png";

export default function Login() {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {

    e.preventDefault();

    setLoading(true);

    try {

      const res = await fetch(
        "http://127.0.0.1:8000/api/login/",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            username,
            password,
            role,
          }),
        }
      );

      const data = await res.json();

      console.log("Login Response:", data);

      if (res.ok) {

        // ✅ ROLE CHECK
        if (data.role !== role) {

          alert("Selected role is incorrect ❌");

          setLoading(false);

          return;
        }

        // ✅ SAVE USER DATA
        localStorage.setItem(
          "username",
          data.username || ""
        );

        localStorage.setItem(
          "role",
          data.role || ""
        );

        localStorage.setItem(
          "user_id",
          data.user_id || ""
        );

        if (data.email) {

          localStorage.setItem(
            "email",
            data.email
          );
        }

        // ✅ ROUTES
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

      console.log("Login Error:", error);

      alert("Backend not connected ❌");

    } finally {

      setLoading(false);

    }
  };

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#e6f0ff] to-[#cfd9df] px-4">

      {/* MAIN CARD */}
      <div className="flex w-full max-w-[950px] h-[540px] rounded-2xl overflow-hidden shadow-2xl bg-white">

        {/* LEFT IMAGE */}
        <div className="w-1/2 h-full hidden md:flex items-center justify-center bg-gray-100">

          <img
            src={loginImg}
            alt="login"
            className="w-full h-full object-cover"
          />

        </div>

        {/* RIGHT PANEL */}
        <div className="w-full md:w-1/2 bg-[#1f4d4d] text-white flex flex-col justify-center px-10">

          {/* TITLE */}
          <h2 className="text-3xl font-bold text-center mb-2">
            Welcome Back
          </h2>

          <p className="text-sm text-gray-300 text-center mb-6">
            Login to your account
          </p>

          {/* ROLE BUTTONS */}
          <div className="flex gap-2 mb-5">

            {["user", "analyser", "admin"].map((r) => (

              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-full text-xs font-medium transition-all duration-200
                  
                  ${
                    role === r
                      ? "bg-white text-[#1f4d4d]"
                      : "bg-white/20 text-white hover:bg-white/30"
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

          {/* LOGIN FORM */}
          <form onSubmit={handleLogin}>

            {/* USERNAME */}
            <div className="mb-4">

              <input
                type="text"
                placeholder="Enter Username"
                autoComplete="off"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                required
                className="w-full p-3 rounded-lg bg-white text-black outline-none border border-transparent focus:border-orange-400"
              />

            </div>

            {/* PASSWORD */}
            <div className="relative mb-5">

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter Password"
                autoComplete="new-password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                className="w-full p-3 pr-11 rounded-lg bg-white text-black outline-none border border-transparent focus:border-orange-400"
              />

              <span
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-600"
              >
                {showPassword ? (
                  <FaEyeSlash />
                ) : (
                  <FaEye />
                )}
              </span>

            </div>

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 transition py-3 rounded-lg font-semibold text-white shadow-md"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

          </form>

          {/* FORGOT PASSWORD */}
          <p className="text-sm text-center mt-5">

            <span
              onClick={() =>
                navigate("/forgot-password")
              }
              className="cursor-pointer hover:underline text-gray-200"
            >
              Forgot Password?
            </span>

          </p>

        </div>
      </div>
    </div>
  );
}