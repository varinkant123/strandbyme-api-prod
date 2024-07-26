import { auth } from "./firebaseAdmin";

export async function firebaseValidateToken(token) {
  let decodedToken;

  // Hardcoded token for testing API using tools like Insomnia.
  // Note: Validation of the token should be done separately.
  // The environment variable FIREBASE_TEST_IDTOKEN is used to simulate requests
  // during testing without needing a valid Firebase token.
  if (token === process.env.FIREBASE_TEST_IDTOKEN) {
    decodedToken = {
      uid: "testuid",
      email: "test@example.com",
      // Add other relevant fields as necessary
    };
    return decodedToken;
  }

  try {
    // Verify the ID token using Firebase Admin SDK
    decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Error verifying token:", error);
    throw new Error("Unauthorized");
  }
}
