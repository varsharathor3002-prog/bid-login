import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function AddUser() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "user",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ✅ Reset form on load (extra safety)
  useEffect(() => {
    setForm({
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "user",
    });
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.username || !form.email || !form.password || !form.confirmPassword) {
      alert("All fields required");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        alert("User Added Successfully ✅");
        navigate("/admin-dashboard");
      } else {
        alert(data.error || "Error occurred");
      }
    } catch {
      alert("Backend not connected ❌");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#e6f0ff] to-[#cfd9df]">

      {/* BIG CARD */}
      <div className="w-[500px] bg-white rounded-2xl shadow-2xl p-10">

        {/* Heading */}
        <h2 className="text-3xl font-bold text-center text-gray-700 mb-8">
          Add New User
        </h2>

        {/* FORM */}
        <form onSubmit={handleSubmit} autoComplete="off">

          {/* Username */}
          <input
            type="text"
            name="username"
            placeholder="Username"
            autoComplete="off"
            value={form.username}
            onChange={handleChange}
            className="w-full mb-5 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none"
          />

          {/* Email */}
          <input
            type="email"
            name="email"
            placeholder="Email"
            autoComplete="off"
            value={form.email}
            onChange={handleChange}
            className="w-full mb-5 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none"
          />

          {/* Password */}
          <div className="relative mb-5">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              autoComplete="new-password"
              value={form.password}
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
              autoComplete="new-password"
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
            Add User
          </button>

        </form>
      </div>
    </div>
  );
}