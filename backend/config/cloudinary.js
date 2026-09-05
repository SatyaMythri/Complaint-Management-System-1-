const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Uploads a single in-memory file buffer (from Multer's memoryStorage)
// to Cloudinary and resolves with the result once it finishes. Using
// resource_type "auto" lets Cloudinary correctly handle both images and
// PDFs without us having to branch on mimetype here.
function uploadBufferToCloudinary(buffer, options = {}) {

    return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "complaint-management",
                resource_type: "auto",
                ...options
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result);
            }
        );

        stream.end(buffer);

    });

}

module.exports = { cloudinary, uploadBufferToCloudinary };