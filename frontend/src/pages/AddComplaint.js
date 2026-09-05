import { useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";
import Footer from "../components/Footer";
function AddComplaint() {

    const [images, setImages] = useState([]);
    const MAX_FILES = 5;
    const [form, setForm] = useState({
    title:"",
    category:"",
    priority:"Medium",
    issue:"",
    customCategory:"",
    description:""
});
    const handleChange = (e) => {

        const { name, value } = e.target;

        if (name === "title") {

            setForm({

                ...form,

                title: value,

                category: ""

            });

        } else {

            setForm({

                ...form,

                [name]: value

            });

        }

    };

    const submitComplaint = async (e) => {

        e.preventDefault();

        if (form.description.trim().length < 10) {
            toast.error("Description must be at least 10 characters.");
            return;
        }

        try {

            const formData = new FormData();

const finalCategory =
    form.category === "Others"
        ? form.customCategory
        : form.category;

const finalIssue =
    form.issue === "Others"
        ? form.customIssue
        : form.issue;

formData.append("title", form.title);
formData.append("category", finalCategory);
formData.append("issue", finalIssue);
formData.append("priority", form.priority);
formData.append("description", form.description);

if (images.length > 0) {
    images.forEach(file => formData.append("images", file));
}

const token = localStorage.getItem("token");

const res = await axios.post(
    "http://localhost:5000/api/complaints/add",
    formData,
    {
        headers: {
            Authorization: `Bearer ${token}`
        }
    }
);

            toast.success(res.data.message);

            setForm({
    title: "",
    category: "",
    issue: "",
    customCategory: "",
    priority: "Medium",
    description: ""
});
            setImages([]);

        } catch (err) {

            toast.error(

                err.response?.data?.message ||

                "Failed to submit complaint"

            );

        }

    };

    return (

        <div>

            <Navbar />

            <div className="container mt-5">

                <div className="card shadow p-4">

                    <h2 className="text-center text-primary mb-4">

                        Submit Complaint

                    </h2>

                    <form onSubmit={submitComplaint}>

                        <div className="mb-3">

<label className="form-label">
Location
</label>

<input
type="text"
className="form-control"
name="title"
value={form.title}
onChange={handleChange}
placeholder="Enter Location"
required
/>

</div>

                        <div className="mb-3">

<label className="form-label">
Category
</label>

<select
className="form-select"
name="category"
value={form.category}
onChange={handleChange}
required
>

<option value="">Select Category</option>

<option value="Electricity">Electricity</option>

<option value="Water Supply">Water Supply</option>

<option value="Roads">Roads</option>

<option value="Drainage">Drainage</option>

<option value="Garbage Collection">Garbage Collection</option>

<option value="Street Lights">Street Lights</option>

<option value="Sanitation">Sanitation</option>

<option value="Public Transport">Public Transport</option>

<option value="Internet / Network">Internet / Network</option>

<option value="Public Safety">Public Safety</option>

<option value="Parks & Recreation">Parks & Recreation</option>

<option value="Others">Others</option>

</select>

{
form.category === "Others" && (

<div className="mb-3">

<label className="form-label">

Enter Category

</label>

<input
type="text"
className="form-control"
name="customCategory"
value={form.customCategory}
onChange={handleChange}
placeholder="Enter Category"
required
/>

</div>

)
}



{
form.issue === "Others" && (

<div className="mb-3">

<label className="form-label">

Enter Issue

</label>

<input
type="text"
className="form-control"
name="customIssue"
value={form.customIssue}
onChange={handleChange}
placeholder="Enter Issue"
required
/>

</div>

)
}

</div>



                        <div className="mb-3">

                            <label className="form-label">

                                Priority

                            </label>

                            <select

                                className="form-select"

                                name="priority"

                                value={form.priority}

                                onChange={handleChange}

                            >

                                <option value="High">

                                    🔴 High

                                </option>

                                <option value="Medium">

                                    🟡 Medium

                                </option>

                                <option value="Low">

                                    🟢 Low

                                </option>

                            </select>

                        </div>

                        <div className="mb-3">

                            <label className="form-label">

                                Describe your issue

                            </label>

                            <textarea
    className="form-control"
    name="description"
    value={form.description}
    onChange={handleChange}
    placeholder="Describe your issue"
    rows="5"
    required
    minLength={10}
    maxLength={300}
/>

<small
    className={form.description.length < 10 ? "" : "text-muted"}
    style={
        form.description.length < 10
            ? { color: "#e6b800", fontWeight: 500 }
            : {}
    }
>
    {form.description.length}/300 characters (Minimum 10 words required)
</small>



                        </div>
                        <div className="mb-3">

    <label className="form-label">
        Upload Attachments (Optional — up to {MAX_FILES} images or PDFs, 5MB each)
    </label>

    <input
        type="file"
        className="form-control"
        accept="image/*,application/pdf"
        multiple
        onChange={(e) => {

            const selected = Array.from(e.target.files);

            if (selected.length > MAX_FILES) {
                toast.error(`You can attach at most ${MAX_FILES} files`);
                setImages(selected.slice(0, MAX_FILES));
            } else {
                setImages(selected);
            }

        }}
    />

    {images.length > 0 && (

    <div className="d-flex flex-wrap gap-3 mt-3">

        {images.map((file, idx) => (

            <div key={idx} className="text-center position-relative">

                {file.type === "application/pdf" ? (

                    <div
                        className="d-flex align-items-center justify-content-center border rounded shadow-sm"
                        style={{ width: 100, height: 100, background: "#f8f9fa" }}
                    >
                        <i className="bi bi-file-earmark-pdf text-danger" style={{ fontSize: "36px" }}></i>
                    </div>

                ) : (

                    <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${idx + 1}`}
                        className="img-thumbnail shadow-sm"
                        style={{
                            width: 100,
                            height: 100,
                            objectFit: "cover"
                        }}
                    />

                )}

                <button
                    type="button"
                    className="btn btn-sm btn-danger rounded-circle position-absolute top-0 start-100 translate-middle"
                    style={{ width: 24, height: 24, padding: 0, lineHeight: "24px" }}
                    onClick={() => setImages(images.filter((_, i) => i !== idx))}
                    title="Remove"
                >
                    ×
                </button>

                <p className="text-muted small mt-1 mb-0" style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                </p>

            </div>

        ))}

    </div>

)}

</div>


                        <button

                            className="btn btn-success w-100"

                            type="submit"

                        >

                            Submit Complaint

                        </button>

                    </form>

                </div>

            </div>
            <Footer />
        </div>

    );

}

export default AddComplaint;