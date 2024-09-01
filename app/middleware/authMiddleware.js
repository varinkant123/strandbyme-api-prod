import { firebaseValidateToken } from "../lib/firebase/firebaseValidateToken";

export async function authMiddleware(req, context) {
  const authorizationHeader = req.headers.get("Authorization");

  if (!authorizationHeader) {
    return new Response("No token provided", { status: 401 });
  }

  const token = authorizationHeader.split("Bearer ")[1];
  if (!token) {
    return new Response("Invalid token format", { status: 401 });
  }

  try {
    const decodedToken = await firebaseValidateToken(token);

    // Add the user information to the context
    context.user = decodedToken;

    // If you need to access the UID specifically, you can add it separately
    context.uid = decodedToken.uid;

    // No need to return anything if authentication is successful
  } catch (error) {
    return new Response("Invalid or expired token", { status: 401 });
  }
}
