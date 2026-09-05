import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Footer from "../components/Footer";
function Login() {

    const navigate = useNavigate();

    const [form, setForm] = useState({
        email: "",
        password: ""
    });

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        try {

            const res = await axios.post(
                "http://localhost:5000/api/auth/login",
                form
            );

            localStorage.setItem(
                "user",
                JSON.stringify(res.data.user)
            );
            localStorage.setItem("token", res.data.token);
            // Show success message
            toast.success("Login Successful");
            // Wait 1 second, then navigate
            setTimeout(() => {
                if (res.data.user.role === "admin") {
                    navigate("/admin");
                } else if (res.data.user.role === "staff") {
                    navigate("/staff-dashboard");
                } else {
                    navigate("/dashboard");
                }
            }, 1000);

        } catch (err) {

            toast.error(
                err.response?.data?.message ||
                "Login Failed"
            );

        }

    };

    return (

        <div className="auth-page">

            <div className="auth-card fade-card">

                <div className="text-center mb-4">

                    <h1>🏫</h1>

                    <h2 className="text-primary">
                        Complaint Management System
                    </h2>

                    <p className="text-muted">
                        Welcome back! Login to continue.
                    </p>

                </div>

                <form onSubmit={handleSubmit}>

                    <div className="mb-3">

                        <label className="form-label">
                            Email
                        </label>

                        <input
                            type="email"
                            className="form-control"
                            placeholder="Enter your email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    <div className="mb-4">

                        <label className="form-label">
                            Password
                        </label>

                        <input
                            type="password"
                            className="form-control"
                            placeholder="Enter your password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    <div className="text-end mb-3">

    <a href="/forgot-password">

        Forgot Password?

    </a>

</div>

                    <button
                        className="btn btn-primary w-100 mb-3"
                        type="submit"
                    >
                        Login
                    </button>

                </form>

                <div className="text-center">

                    <span className="text-muted">
                        Don't have an account?
                    </span>

                    <br />

                    <Link
                        to="/register"
                        className="btn btn-outline-primary mt-2"
                    >
                        Create Account
                    </Link>

                </div>

            </div>
        </div>

    );

}

export default Login;