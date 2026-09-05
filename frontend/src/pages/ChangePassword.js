import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function ChangePassword() {

    const user = JSON.parse(localStorage.getItem("user"));

    const navigate = useNavigate();

    const [currentPassword, setCurrentPassword] = useState("");

    const [newPassword, setNewPassword] = useState("");

    const [confirmPassword, setConfirmPassword] = useState("");

    const changePassword = async (e) => {

        e.preventDefault();

        if (newPassword !== confirmPassword) {

            toast.error("Passwords do not match");

            return;

        }

        try {

            const token = localStorage.getItem("token");

            const res = await axios.put(

                `http://localhost:5000/api/auth/change-password/${user.id}`,

                {

                    currentPassword,

                    newPassword

                },

                {
                    headers: { Authorization: `Bearer ${token}` }
                }

            );

            toast.success(res.data.message);

            localStorage.removeItem("user");

            navigate("/");

        } catch (err) {

            toast.error(

                err.response?.data?.message ||

                "Failed to change password"

            );

        }

    };

    return (

        <>
            <Navbar />

            <div className="container mt-5">

                <div className="card shadow p-4 col-md-6 mx-auto">

                    <h3 className="text-center mb-4">

                        Change Password

                    </h3>

                    <form onSubmit={changePassword}>

                        <div className="mb-3">

                            <label>Current Password</label>

                            <input

                                type="password"

                                className="form-control"

                                value={currentPassword}

                                onChange={(e) =>

                                    setCurrentPassword(e.target.value)

                                }

                                required

                            />

                        </div>

                        <div className="mb-3">

                            <label>New Password</label>

                            <input

                                type="password"

                                className="form-control"

                                value={newPassword}

                                onChange={(e) =>

                                    setNewPassword(e.target.value)

                                }

                                required

                            />

                        </div>

                        <div className="mb-3">

                            <label>Confirm Password</label>

                            <input

                                type="password"

                                className="form-control"

                                value={confirmPassword}

                                onChange={(e) =>

                                    setConfirmPassword(e.target.value)

                                }

                                required

                            />

                        </div>

                        <button

                            className="btn btn-success w-100"

                        >

                            Change Password

                        </button>

                    </form>

                </div>

            </div>

            <Footer />

        </>

    );

}

export default ChangePassword;