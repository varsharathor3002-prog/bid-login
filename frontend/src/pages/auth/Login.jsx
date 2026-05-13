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
      const res = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await res.json();
      console.log("Login Response:", data);

      if (res.ok) {
        if (data.role !== role) {
          alert("Selected role is incorrect ❌");
          setLoading(false);
          return;
        }

        localStorage.removeItem("username");
        localStorage.removeItem("user_username");
        localStorage.removeItem("analyser_username");
        localStorage.removeItem("admin_username");
        localStorage.removeItem("bid_user_id");
        localStorage.removeItem("desktop_bid_step");
        localStorage.removeItem("desktop_bid_data");

        localStorage.setItem("role", data.role || "");
        localStorage.setItem("username", data.username || "");
        localStorage.setItem("user_id", data.user_id || "");

        if (data.email) {
          localStorage.setItem("email", data.email);
        }

        if (data.role === "user") {
          localStorage.setItem("user_username", data.username || "");
          localStorage.setItem("bid_user_id", data.user_id || "");
          navigate("/user");
        } else if (data.role === "analyser") {
          localStorage.setItem("analyser_username", data.username || "");
          navigate("/analyser-dashboard");
        } else if (data.role === "admin") {
          localStorage.setItem("admin_username", data.username || "");
          navigate("/admin-dashboard");
        }

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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "linear-gradient(135deg, #e6f0ff 0%, #cfd9df 100%)" }}>

      {/* ══════════════ TOP HEADER — LOGO1 & LOGO2 (3X SIZE) ══════════════ */}
      <header style={{
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between", // Logos ko corners par rakhne ke liye
        padding: "8px 3rem",
        flexShrink: 0,
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        height: "100px", // Header ki height thodi manage ki taaki logo fit ho jayein
      }}>
        <img
  src="/logo2.png"
  alt="Logo 1"
  className="h-[250px] w-auto object-contain"
/>
      <img
  src="/logo1.png"
  alt="Logo 1"
  className="h-[300px] w-auto object-contain"
/>
      </header>
      {/* ════════════════════════════════════════════════════ */}

      {/* LOGIN CARD */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{
          display: "flex",
          width: "100%",
          maxWidth: "900px",
          height: "100%",
          maxHeight: "520px",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
          background: "#fff",
        }}>

          {/* LEFT IMAGE */}
          <div style={{ width: "50%", height: "100%", display: "none" }} className="md-left-img">
            <img src={loginImg} alt="login" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          <style>{`
            @media (min-width: 768px) {
              .md-left-img { display: flex !important; alignItems: center; justifyContent: center; background: #f3f4f6; }
              .right-panel { width: 50% !important; }
            }
          `}</style>

          {/* RIGHT PANEL */}
          <div
            className="right-panel"
            style={{
              width: "100%",
              background: "#1f4d4d",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 2.5rem",
            }}
          >
            <h2 style={{ fontSize: "1.7rem", fontWeight: 700, textAlign: "center", marginBottom: "4px" }}>Welcome Back</h2>
            <p style={{ fontSize: "0.82rem", color: "#cbd5e1", textAlign: "center", marginBottom: "20px" }}>Login to your account</p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
              {["user", "analyser", "admin"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "999px",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background: role === r ? "#ffffff" : "rgba(255,255,255,0.18)",
                    color: role === r ? "#1f4d4d" : "#ffffff",
                  }}
                >
                  {r === "user" ? "Bid Data Feeding" : r === "analyser" ? "Bid Analyser" : "Admin"}
                </button>
              ))}
            </div>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "14px" }}>
                <input
                  type="text"
                  placeholder="Enter Username"
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    background: "#fff",
                    color: "#000",
                    border: "2px solid transparent",
                    outline: "none",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = "#f97316"}
                  onBlur={e => e.target.style.borderColor = "transparent"}
                />
              </div>

              <div style={{ position: "relative", marginBottom: "18px" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter Password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "11px 44px 11px 14px",
                    borderRadius: "10px",
                    background: "#fff",
                    color: "#000",
                    border: "2px solid transparent",
                    outline: "none",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = "#f97316"}
                  onBlur={e => e.target.style.borderColor = "transparent"}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#6b7280" }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  background: loading ? "#fdba74" : "#f97316",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
                  transition: "background 0.2s",
                }}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <p style={{ fontSize: "0.82rem", textAlign: "center", marginTop: "16px" }}>
              <span
                onClick={() => navigate("/forgot-password")}
                style={{ cursor: "pointer", color: "#cbd5e1", textDecoration: "underline" }}
              >
                Forgot Password?
              </span>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}