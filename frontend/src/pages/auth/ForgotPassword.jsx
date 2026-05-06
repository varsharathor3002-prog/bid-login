import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    new_password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ✅ Autofill username & email from localStorage
  useEffect(() => {
    const username = localStorage.getItem("username");
    const email = localStorage.getItem("email");

    setForm({
      username: username || "",
      email: email || "",
      new_password: "",
      confirmPassword: "",
    });
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!form.new_password || !form.confirmPassword) {
      alert("All fields are required");
      return;
    }

    if (form.new_password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/forgot-password/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          new_password: form.new_password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Password updated successfully ✅");

        // Optional: clear storage after reset
        localStorage.removeItem("username");
        localStorage.removeItem("email");

        navigate("/login");
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch (error) {
      console.error(error);
      alert("Backend not connected ❌");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#e6f0ff] to-[#cfd9df]">
      
      <div className="w-[500px] bg-white rounded-2xl shadow-2xl p-10">

        {/* Heading */}
        <h2 className="text-3xl font-bold text-center text-gray-700 mb-8">
          Forgot Password
        </h2>

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="off">

          {/* Username (readonly) */}
          <input
            type="text"
            name="username"
            value={form.username}
            readOnly
            className="w-full mb-5 p-3 rounded-lg border bg-gray-100 cursor-not-allowed"
          />

          {/* Email (readonly) */}
          <input
            type="email"
            name="email"
            value={form.email}
            readOnly
            className="w-full mb-5 p-3 rounded-lg border bg-gray-100 cursor-not-allowed"
          />

          {/* New Password */}
          <div className="relative mb-5">
            <input
              type={showPassword ? "text" : "password"}
              name="new_password"
              placeholder="New Password"
              value={form.new_password}
              onChange={handleChange}
              className="w-full p-3 pr-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none"
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* Confirm Password */}
          <div className="relative mb-6">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full p-3 pr-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none"
            />
            <span
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* Button */}
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition">
            Update Password
          </button>

        </form>
      </div>
    </div>
  );
}