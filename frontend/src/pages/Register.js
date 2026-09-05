import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Footer from "../components/Footer";
function Register() {

    const navigate = useNavigate();

    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({
        name: "",
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

        if (form.name.trim() === "") {
            toast.error("Please enter your name.");
            return;
        }

        if (form.password.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }

        try {

            await axios.post(
                "http://localhost:5000/api/auth/register",
                form
            );

            toast.success("Registration successful! Please login.");
            navigate("/login");

        } catch (err) {

            toast.error(
                err.response?.data?.message || "Registration failed."
            );

        }

    };

    return (

        <div className="auth-page">

            <div className="auth-card fade-card">

                <div className="text-center mb-4">

                    <i
                        className="bi bi-person-plus-fill text-success"
                        style={{ fontSize: "65px" }}
                    ></i>

                    <h2 className="text-success mt-3">
                        Create Account
                    </h2>

                    <p className="text-muted">
                        Register to submit and track complaints.
                    </p>

                </div>

                <form onSubmit={handleSubmit}>

                    <div className="mb-3">

                        <label className="form-label">
                            Full Name
                        </label>

                        <div className="input-group">

                            <span className="input-group-text">
                                <i className="bi bi-person"></i>
                            </span>

                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter your name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                            />

                        </div>

                    </div>

                    <div className="mb-3">

                        <label className="form-label">
                            Email
                        </label>

                        <div className="input-group">

                            <span className="input-group-text">
                                <i className="bi bi-envelope"></i>
                            </span>

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

                    </div>

                    <div className="mb-4">

                        <label className="form-label">
                            Password
                        </label>

                        <div className="input-group">

                            <span className="input-group-text">
                                <i className="bi bi-lock"></i>
                            </span>

                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-control"
                                placeholder="Create a password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                required
                            />

                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setShowPassword(!showPassword)}
                            >

                                <i
                                    className={
                                        showPassword
                                            ? "bi bi-eye-slash"
                                            : "bi bi-eye"
                                    }
                                ></i>

                            </button>

                        </div>

                    </div>

                    <button
                        className="btn btn-success w-100"
                        type="submit"
                    >

                        <i className="bi bi-person-check-fill me-2"></i>

                        Register

                    </button>

                </form>

                <div className="text-center mt-4">

                    <span className="text-muted">
                        Already have an account?
                    </span>

                    <br />

                    <Link
                        to="/"
                        className="btn btn-outline-primary mt-2"
                    >

                        <i className="bi bi-box-arrow-in-right me-2"></i>

                        Login

                    </Link>

                </div>

            </div>
        </div>

    );

}

export default Register;