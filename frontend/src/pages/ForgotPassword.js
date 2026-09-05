import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function ForgotPassword() {

    const [email, setEmail] = useState("");

    const navigate = useNavigate();

    const sendOTP = async (e) => {

        e.preventDefault();

        try {

            const res = await axios.post(
                "http://localhost:5000/api/auth/forgot-password",
                { email }
            );

            toast.success(res.data.message);

            navigate("/verify-otp", {
                state: { email }
            });

        } catch (err) {

            toast.error(
                err.response?.data?.message ||
                "Failed to send OTP"
            );

        }

    };

    return (

        <div>

            <Navbar />

            <div className="container mt-5">

                <div className="card shadow p-4 col-md-5 mx-auto">

                    <h3 className="text-center text-primary">

                        Forgot Password

                    </h3>

                    <form onSubmit={sendOTP}>

                        <div className="mb-3">

                            <label>Email</label>

                            <input
                                type="email"
                                className="form-control"
                                value={email}
                                onChange={(e) =>
                                    setEmail(e.target.value)
                                }
                                required
                            />

                        </div>

                        <button
                            className="btn btn-primary w-100"
                            type="submit"
                        >

                            Send OTP

                        </button>

                    </form>

                </div>

            </div>

            <Footer />

        </div>

    );

}

export default ForgotPassword;