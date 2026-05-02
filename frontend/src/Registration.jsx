import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./Registration.css";
import { Link, useNavigate } from "react-router-dom";

function Registration() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ✅ Handle input change
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // ✅ Handle register
  const handleRegister = async (e) => {
    e.preventDefault();

    // 🔥 Validation
    if (!form.username || !form.email || !form.password || !form.confirmPassword) {
      alert("Fill all fields");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      console.log("Sending request...");

      const res = await fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      console.log("Response:", data);

      if (res.ok) {
        alert(data.message);

        // 🔥 Redirect to login after success
        navigate("/");
      } else {
        alert(data.error || "Something went wrong");
      }

    } catch (error) {
      console.error("Error:", error);
      alert("Backend not connected ❌");
    }
  };

  return (
    <div className="reg-container">
      <div className="reg-card">
        <h2 className="reg-title">Create Account</h2>
        <p className="reg-subtitle">Bid Data Feeding</p>

        <form onSubmit={handleRegister}>
          <div className="reg-input">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
            />
          </div>

          <div className="reg-input">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          {/* Password */}
          <div className="reg-input password-box">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="eye"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* Confirm Password */}
          <div className="reg-input password-box">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={handleChange}
            />
            <span
              onClick={() => setShowConfirm(!showConfirm)}
              className="eye"
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button className="reg-btn">Register</button>
        </form>

        <p className="reg-footer">
          Already have an account? <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Registration;