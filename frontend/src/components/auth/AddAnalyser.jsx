import { useEffect, useState } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaTrash,
  FaPlus,
  FaTimes,
} from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL;

export default function AddAnalyser({ accountType = "analyser" }) {

  const isAdmin = accountType === "admin";
  const singularLabel = isAdmin ? "Admin" : "Analyser";
  const pluralLabel = isAdmin ? "Admins" : "Analysers";
  const endpointName = isAdmin ? "admin" : "analyser";

  const [analysers, setAnalysers] = useState([]);

  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  
  const fetchAnalysers = async () => {

    try {

      const res = await fetch(
        `${API_BASE}/${endpointName}-list/`
      );

      const data = await res.json();

      if (res.ok) {

        setAnalysers(data);

      } else {

        alert(data.error);
      }

    } catch (error) {

      console.log(error);

      alert(`Failed to load ${pluralLabel.toLowerCase()}.`);
    }
  };

  useEffect(() => {

    fetchAnalysers();

  }, [endpointName]);

  
  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  
  const handleSubmit = async (e) => {

    e.preventDefault();

    if (
      !form.username ||
      !form.email ||
      !form.password ||
      !form.confirmPassword
    ) {
      alert("All fields required");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {

      setLoading(true);

      const res = await fetch(
        `${API_BASE}/register-${endpointName}/`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            username: form.username,
            email: form.email,
            password: form.password,
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {

        alert(data.message);

        setShowForm(false);

        setForm({
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
        });

        fetchAnalysers();

      } else {

        alert(data.error);
      }

    } catch (error) {

      console.log(error);

      alert("Add failed ❌");

    } finally {

      setLoading(false);
    }
  };

  
  const deleteAnalyser = async (id) => {

    const confirmDelete = window.confirm(
      `Delete this ${singularLabel.toLowerCase()}?`
    );

    if (!confirmDelete) return;

    try {

      const res = await fetch(
        `${API_BASE}/delete-${endpointName}/${id}/`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (res.ok) {

        alert(data.message);

        fetchAnalysers();

      } else {

        alert(data.error);
      }

    } catch (error) {

      console.log(error);

      alert("Delete failed ❌");
    }
  };

  return (

    <div className="min-h-screen bg-gray-100 p-6">

      {}

      <div className="flex items-center justify-between mb-6">

        <h1 className="text-3xl font-bold text-gray-700">
          All {pluralLabel}
        </h1>

        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg flex items-center gap-2 font-semibold shadow-lg"
        >
          <FaPlus />
          Add {singularLabel}
        </button>

      </div>

      {}

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

        <table className="w-full">

          <thead className="bg-indigo-600 text-white">

            <tr>

              <th className="py-4 px-4 text-left">
                S.No
              </th>

              <th className="py-4 px-4 text-left">
                Username
              </th>

              <th className="py-4 px-4 text-left">
                Email
              </th>

              <th className="py-4 px-4 text-center">
                Action
              </th>

            </tr>

          </thead>

          <tbody>

            {
              analysers.length > 0
              ?
              analysers.map((item, index) => (

                <tr
                  key={item.id}
                  className="border-b hover:bg-gray-50"
                >

                  <td className="py-4 px-4">
                    {index + 1}
                  </td>

                  <td className="py-4 px-4">
                    {item.username}
                  </td>

                  <td className="py-4 px-4">
                    {item.email}
                  </td>

                  <td className="py-4 px-4 text-center">

                    <button
                      onClick={() =>
                        deleteAnalyser(item.id)
                      }
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
                    >
                      <FaTrash />
                      Delete
                    </button>

                  </td>

                </tr>

              ))
              :
              <tr>

                <td
                  colSpan="4"
                  className="py-10 text-center text-gray-500"
                >
                  No {pluralLabel.toLowerCase()} found
                </td>

              </tr>
            }

          </tbody>

        </table>

      </div>

      {}

      {
        showForm && (

          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 relative">

              {}

              <button
                onClick={() => setShowForm(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-red-500"
              >
                <FaTimes size={20} />
              </button>

              <h2 className="text-2xl font-bold text-center text-gray-700 mb-6">
                Add New {singularLabel}
              </h2>

              <form onSubmit={handleSubmit} autoComplete="off">

                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="off"
                  className="w-full mb-4 border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400"
                />

                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="off"
                  className="w-full mb-4 border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400"
                />

                <div className="relative mb-4">

                  <input
                    type={
                      showPassword
                      ? "text"
                      : "password"
                    }
                    name="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-indigo-400"
                  />

                  <span
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {
                      showPassword
                      ? <FaEyeSlash />
                      : <FaEye />
                    }
                  </span>

                </div>

                <div className="relative mb-6">

                  <input
                    type={
                      showConfirm
                      ? "text"
                      : "password"
                    }
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-indigo-400"
                  />

                  <span
                    onClick={() =>
                      setShowConfirm(!showConfirm)
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {
                      showConfirm
                      ? <FaEyeSlash />
                      : <FaEye />
                    }
                  </span>

                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold"
                >
                  {
                    loading
                    ? "Adding..."
                    : `Add ${singularLabel}`
                  }
                </button>

              </form>

            </div>

          </div>
        )
      }

    </div>
  );
}
