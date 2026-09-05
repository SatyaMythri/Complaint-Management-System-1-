import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function EditProfile() {

    const user = JSON.parse(localStorage.getItem("user"));

    const navigate = useNavigate();

    const [name, setName] = useState(user.name);

    const [email, setEmail] = useState(user.email);

    const updateProfile = async (e) => {

        e.preventDefault();

        try {

            const token = localStorage.getItem("token");

            const res = await axios.put(

                `http://localhost:5000/api/auth/update-profile/${user.id}`,

                {
                    name,
                    email
                },

                {
                    headers: { Authorization: `Bearer ${token}` }
                }

            );

            toast.success(res.data.message);

            localStorage.setItem(

                "user",

                JSON.stringify({

                    ...user,

                    name,

                    email

                })

            );

            navigate("/profile");

        } catch (err) {

            toast.error(

                err.response?.data?.message ||

                "Failed to update profile"

            );

        }

    };

    return (

        <>
            <Navbar />

            <div className="container mt-5">

                <div className="card shadow p-4 col-md-6 mx-auto">

                    <h3 className="text-center mb-4">

                        Edit Profile

                    </h3>

                    <form onSubmit={updateProfile}>

                        <div className="mb-3">

                            <label>Name</label>

                            <input
                                className="form-control"
                                value={name}
                                onChange={(e) =>
                                    setName(e.target.value)
                                }
                                required
                            />

                        </div>

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
                        >
                            Save Changes
                        </button>

                    </form>

                </div>

            </div>

            <Footer />

        </>

    );

}

export default EditProfile;