const admin = require("firebase-admin");
require("dotenv").config({ path: ".env.local" });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase Admin environment variables in .env.local');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    })
  });
}

// Ensure it connects specifically to the "slms" named database if that's what was created
// However, by default, Firebase Client SDK (which we use in Next.js) prefers the "(default)" database.
// Let's explicitly connect to "slms" database for admin if needed, 
// though we usually recommend using the "(default)" database for standard web projects.
const db = admin.firestore();
// If the user created a named database called 'slms', they would need:
// const db = admin.firestore(); 
// db.settings({ databaseId: 'slms' });

const auth = admin.auth();

async function seed() {
  console.log("Starting Firebase seeding process...");

  try {
    const adminEmail = "admin@slms.com";
    const adminPassword = "password123";
    let adminUid;

    try {
      const userRecord = await auth.getUserByEmail(adminEmail);
      adminUid = userRecord.uid;
      console.log(`User ${adminEmail} already exists. UID: ${adminUid}`);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        const newUser = await auth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: "System Administrator",
        });
        adminUid = newUser.uid;
        console.log(`Created new Admin User: ${adminEmail} (UID: ${adminUid})`);
      } else {
        throw error;
      }
    }

    try {
       await db.collection("users").doc(adminUid).set({
        name: "System Administrator",
        email: adminEmail,
        role: "Admin",
        department: "IT / Administration",
      }, { merge: true });
      console.log("Admin details saved to Firestore 'users' collection.");
    } catch(err) {
      console.log("❌ ERROR WRITING TO FIRESTORE: This usually means the Firestore Database hasn't been created yet, or it was created as a 'Realtime Database' instead.");
      throw err;
    }

    const leaveTypes = [
      { name: "Sick Leave", maxDays: 30 },
      { name: "Personal Leave", maxDays: 10 },
      { name: "Activity Leave", maxDays: 5 }
    ];

    console.log("Adding default Leave Types...");
    const leaveTypesRef = db.collection("leaveTypes");
    for (const lt of leaveTypes) {
      const snapshot = await leaveTypesRef.where("name", "==", lt.name).get();
      if (snapshot.empty) {
        await leaveTypesRef.add(lt);
        console.log(`  + Added: ${lt.name}`);
      } else {
        console.log(`  ~ Exists: ${lt.name}`);
      }
    }

    console.log("\n==================================");
    console.log("Seeding completed successfully!");
    console.log("You can now login with:");
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log("==================================");
    
  } catch (err) {
    console.error("Error during seeding:", err.message);
  } finally {
    process.exit();
  }
}

seed();
