import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function Profile() {

    const user = JSON.parse(localStorage.getItem("user"));
    const navigate = useNavigate();
    return (
        <>
            <Navbar />

            <div className="container mt-5">

                <div className="card shadow p-4 col-md-6 mx-auto">

                    <div className="text-center">

                        <img
                            src="https://cdn-icons-png.flaticon.com/512/149/149071.png"
                            alt="Profile"
                            width="120"
                            height="120"
                            className="rounded-circle mb-3"
                        />

                        <h3>{user.name}</h3>

                        <p className="text-muted">
                            {user.email}
                        </p>

                        <span className="badge bg-primary">
                            {user.role.toUpperCase()}
                        </span>

                    </div>

                    <hr />

                    <div className="d-grid gap-2">

                        <button
    className="btn btn-warning"
    onClick={() => navigate("/edit-profile")}
>
    Edit Profile
</button>

                        <button
    className="btn btn-success"
    onClick={() => navigate("/change-password")}
>
    Change Password
</button>

                    </div>

                </div>

            </div>

            <Footer />
        </>
    );
}

export default Profile;