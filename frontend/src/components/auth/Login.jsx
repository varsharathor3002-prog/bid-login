import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import loginImg from "../../assets/images.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();
      console.log("Login Response:", data);

      if (!res.ok) {
        alert(data.error || "Login failed ❌");
        return;
      }

      if (data.role !== role) {
        alert("Selected role is incorrect ❌");
        return;
      }

            
      const loginName = data.username || "";
      const loginRole = data.role || role || "";

      // Prevent a previous role's display identity from surviving a new login
      // while the API token belongs to a different account/role.
      localStorage.removeItem("user_username");
      localStorage.removeItem("analyser_username");
      localStorage.removeItem("admin_username");
      sessionStorage.removeItem("user_username");
      sessionStorage.removeItem("analyser_username");
      sessionStorage.removeItem("admin_username");

            localStorage.setItem("role", loginRole);
      localStorage.setItem("username", loginName);
      localStorage.setItem("display_username", loginName);
      localStorage.setItem("user_id", data.user_id || "");
      localStorage.setItem("token", data.token || "");
      sessionStorage.setItem("role", loginRole);
      sessionStorage.setItem("username", loginName);
      sessionStorage.setItem("user_id", String(data.user_id || ""));
      sessionStorage.setItem("token", data.token || "");

      if (data.email) {
        localStorage.setItem("email", data.email);
        sessionStorage.setItem("email", data.email);
      }

            if (loginRole === "user") {
        localStorage.setItem("user_username", loginName);
        sessionStorage.setItem("user_username", loginName);
        localStorage.setItem("bid_user_id", data.user_id || "");
        navigate("/user");
      } else if (loginRole === "analyser") {
        localStorage.setItem("analyser_username", loginName);
        sessionStorage.setItem("analyser_username", loginName);
        navigate("/analyser-dashboard");
      } else if (loginRole === "admin") {
        localStorage.setItem("admin_username", loginName);
        sessionStorage.setItem("admin_username", loginName);
        navigate("/admin-dashboard");
      }
    } catch (error) {
      console.log("Login Error:", error);
      alert("Backend not connected ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "linear-gradient(135deg, #E6F0FF 0%, #CFD9DF 100%)" }}>
      <header style={{
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 3rem",
        flexShrink: 0,
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        height: "100px",
      }}>
        <img src="/logo2.png" alt="Logo 2" className="h-[250px] w-auto object-contain" />
        <img src="/logo1.png" alt="Logo 1" className="h-[300px] w-auto object-contain" />
      </header>

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
          <div style={{ width: "50%", height: "100%", display: "none" }} className="md-left-img">
            <img src={loginImg} alt="login" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          <style>{`
            @media (min-width: 768px) {
              .md-left-img { display: flex !important; align-items: center; justify-content: center; background: #F3F4F6; }
              .right-panel { width: 50% !important; }
            }
          `}</style>

          <div
            className="right-panel"
            style={{
              width: "100%",
              background: "#1F4D4D",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 2.5rem",
            }}
          >
            <h2 style={{ fontSize: "1.7rem", fontWeight: 700, textAlign: "center", marginBottom: "4px" }}>Welcome Back</h2>
            <p style={{ fontSize: "0.82rem", color: "#CBD5E1", textAlign: "center", marginBottom: "20px" }}>Login to your account</p>

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
                    background: role === r ? "#FFFFFF" : "rgba(255,255,255,0.18)",
                    color: role === r ? "#1F4D4D" : "#FFFFFF",
                  }}
                >
                  {r === "user" ? "Bid Data Feeding" : r === "analyser" ? "Bid Analyser" : "Admin"}
                </button>
              ))}
            </div>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "14px" }}>
                <input
                  type="email"
                  placeholder="Enter Email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                  onBlur={(e) => (e.target.style.borderColor = "transparent")}
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
                  onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                  onBlur={(e) => (e.target.style.borderColor = "transparent")}
                />

                <span
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#6B7280" }}
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
                  background: loading ? "#FDBA74" : "#F97316",
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
                style={{ cursor: "pointer", color: "#CBD5E1", textDecoration: "underline" }}
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
