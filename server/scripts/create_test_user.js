import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/userModel.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://irhaas17_db_user:cY6aMN9DMXvNzhcB@irhaas17.aujojib.mongodb.net/?appName=irhaas17";

async function createOrUpdateTestUser() {
  const email = (process.argv[2] || "saleemmughal03092002@gmail.com").trim().toLowerCase();
  const password = process.argv[3] || "Test123456!";
  const name = process.argv[4] || "Test Customer";

  console.log(`\nConnecting to MongoDB...`);
  await mongoose.connect(MONGO_URI);
  console.log(`Connected.`);

  let user = await User.findOne({ email });

  if (user) {
    console.log(`Existing user found for ${email}. Updating credentials...`);
    user.name = name;
    user.password = password; // Will be hashed by pre('save') hook
    user.isEmailVerified = true;
    user.isAdmin = false;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    console.log(`User updated successfully!`);
  } else {
    console.log(`Creating new verified testing user for ${email}...`);
    user = new User({
      name,
      email,
      password, // Will be hashed by pre('save') hook
      isEmailVerified: true,
      isAdmin: false,
    });
    await user.save();
    console.log(`New user created successfully!`);
  }

  // Verify that matchPassword works
  const isMatch = await user.matchPassword(password);
  console.log(`Password verification check: ${isMatch ? "SUCCESS (Matches)" : "FAILED"}`);

  console.log(`\n==============================================`);
  console.log(`TESTING ACCOUNT READY:`);
  console.log(`Email    : ${email}`);
  console.log(`Password : ${password}`);
  console.log(`Verified : ${user.isEmailVerified}`);
  console.log(`Admin    : ${user.isAdmin}`);
  console.log(`==============================================\n`);

  await mongoose.disconnect();
}

createOrUpdateTestUser().catch((err) => {
  console.error("Error creating test user:", err);
  process.exit(1);
});
