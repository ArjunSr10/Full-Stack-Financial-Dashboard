// Register.js
import React, { useState } from "react";
import { FaEnvelope, FaLock, FaUserPlus } from "react-icons/fa";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ Registered successfully!");
        setEmail("");
        setPassword("");
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Something went wrong.");
    }
  };

  return (
    <form
      onSubmit={handleRegister}
      className="backdrop-blur-md bg-white/20 p-8 rounded-2xl shadow-2xl space-y-6"
    >
      <div className="flex justify-center text-green-400 text-5xl mb-2">
        <FaUserPlus />
      </div>
      <h2 className="text-3xl font-bold text-white text-center mb-6">
        Create Account
      </h2>

      {/* Email */}
      <div className="relative">
        <FaEnvelope className="absolute top-3 left-3 text-gray-300" />
        <input
          type="email"
          placeholder="Email"
          className="w-full pl-10 p-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-300"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {/* Password */}
      <div className="relative">
        <FaLock className="absolute top-3 left-3 text-gray-300" />
        <input
          type="password"
          placeholder="Password"
          className="w-full pl-10 p-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-300"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 rounded-lg hover:scale-105 transition transform duration-300 font-semibold">
        Register
      </button>
    </form>
  );
}
