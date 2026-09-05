require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000
})
.then(() => {
  console.log("✅ MongoDB Connected");
})
.catch((err) => {
  console.error(err);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});