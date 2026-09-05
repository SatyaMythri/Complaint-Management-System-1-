import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function ResetPassword() {

    const [password, setPassword] = useState("");

    const navigate = useNavigate();

    const location = useLocation();

    const email = location.state?.email;
const otp = location.state?.otp;

if (!email || !otp) {
    navigate("/forgot-password");
    return null;
}

    const resetPassword = async (e) => {

        e.preventDefault();

        try {

            const res = await axios.post(
                "http://localhost:5000/api/auth/reset-password",
                {
                    email,
                    otp,
                    password
                }
            );

            toast.success(res.data.message);

            navigate("/login");

        } catch (err) {

            toast.error(
                err.response?.data?.message ||
                "Password reset failed"
            );

        }

    };

    return (

        <>
            <Navbar />

            <div className="container mt-5">

                <div className="card shadow p-4 col-md-5 mx-auto">

                    <h3 className="text-center text-primary">

                        Reset Password

                    </h3>

                    <form onSubmit={resetPassword}>

                        <div className="mb-3">

                            <label>New Password</label>

                            <input
                                type="password"
                                className="form-control"
                                value={password}
                                onChange={(e) =>
                                    setPassword(e.target.value)
                                }
                                required
                            />

                        </div>

                        <button
                            className="btn btn-success w-100"
                            type="submit"
                        >
                            Reset Password
                        </button>

                    </form>

                </div>

            </div>

            <Footer />

        </>

    );

}

export default ResetPassword;