// Note: It is not possible to use a custom token to directly retrieve an ID token server-side using the Firebase Admin SDK.
// The custom token is meant to be sent to a client application, where it can be exchanged for an ID token using Firebase Client SDK.

// import { auth } from "@/app/lib/firebase/firebaseAdmin";

// export const dynamic = "force-dynamic";

// export async function GET(request) {
//   // get uid from search param
//   const uid = new URL(request.url).searchParams.get("uid");

//   // handle uid not provided
//   if (!uid) {
//     return new Response("No uid provided", { status: 400 });
//   }

//   let customToken;
//   try {
//     // Generate custom token
//     customToken = await auth.createCustomToken(uid);
//   } catch (error) {
//     console.log("Error creating custom token:", error);
//     return new Response("Error creating custom token", { status: 500 });
//   }

//   // Response with custom token
//   return new Response(customToken, {
//     headers: { "Content-Type": "text/plain" },
//   });
// }

// ID Token vs Refresh Token:
// ID Token: This is a short-lived token (usually expires in an hour) that contains user information and is used to authenticate requests to your API.
// Refresh Token: This is a long-lived token that can be used to obtain new ID tokens without requiring the user to log in again. It helps maintain a user's session.
