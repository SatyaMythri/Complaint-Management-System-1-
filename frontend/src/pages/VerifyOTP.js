import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function VerifyOTP() {

    const [otp, setOtp] = useState("");

    const navigate = useNavigate();

    const location = useLocation();

    const email = location.state?.email;

    const verifyOTP = async (e) => {

        e.preventDefault();

        try {

            const res = await axios.post(
                "http://localhost:5000/api/auth/verify-otp",
                {
                    email,
                    otp
                }
            );

            toast.success(res.data.message);

            navigate("/reset-password", {
                state: { email, otp }
            });

        } catch (err) {

            toast.error(
                err.response?.data?.message ||
                "Invalid OTP"
            );

        }

    };

    return (

        <>
            <Navbar />

            <div className="container mt-5">

                <div className="card p-4 shadow col-md-5 mx-auto">

                    <h3 className="text-center mb-4">
                        Verify OTP
                    </h3>

                    <form onSubmit={verifyOTP}>

                        <input
                            className="form-control mb-3"
                            placeholder="Enter OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                        />

                        <button
                            className="btn btn-success w-100"
                        >
                            Verify OTP
                        </button>

                    </form>

                </div>

            </div>

            <Footer />
        </>

    );

}

export default VerifyOTP;