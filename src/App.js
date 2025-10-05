import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import Register from "./Register";
import Login from "./Login";
import Dashboard from "./Dashboard";
import authBg from "./assets/bg-auth.jpg";
import { FaSignInAlt, FaUserPlus } from "react-icons/fa";
import "./App.css";

// Layout for Auth pages
// Layout for Auth pages
function AuthLayout({ children }) {
  return (
    <div className="app-container">
      <div className="app-content">
        <h1 className="app-header">Welcome to Auth Portal</h1>
        <nav className="nav-links">
          <a href="/login">Login</a>
          <a href="/register" className="register">Register</a>
        </nav>
        {children}
      </div>
    </div>
  );
}


export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          }
        />
        <Route
          path="/register"
          element={
            <AuthLayout>
              <Register />
            </AuthLayout>
          }
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}
