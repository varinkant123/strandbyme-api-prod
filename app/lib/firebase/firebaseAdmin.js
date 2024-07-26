import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const auth = admin.auth();

// 1. Obtain the Firebase service account key:
//    - Go to Firebase Console: https://console.firebase.google.com/
//    - Select your project
//    - Navigate to Project Settings (gear icon) > Service Accounts tab
//    - Click "Generate new private key" and download the JSON file
//
// 2. Set the FIREBASE_SERVICE_ACCOUNT_KEY environment variable with the JSON content:
//    - Copy the entire content of the downloaded JSON file
//    - In your .env file, set:
//      FIREBASE_SERVICE_ACCOUNT_KEY='{"type": "service_account", "project_id": "your-project-id", ...}'
// Resources;
// https://firebase.google.com/docs/admin/setup
