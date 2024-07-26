import { firebaseValidateToken } from "../lib/firebase/firebaseValidateToken";

export async function authMiddleware(req) {
  const authorizationHeader = req.headers.get("authorization");
  if (!authorizationHeader) {
    return new Response("No token provided", { status: 401 });
  }

  const token = authorizationHeader.split("Bearer ")[1];
  if (!token) {
    return new Response("Invalid token format", { status: 401 });
  }

  try {
    const decodedToken = await firebaseValidateToken(token);
    req.user = decodedToken;
    // Attach the decoded token to the request:
    // This allows subsequent middleware and route handlers to access the authenticated user's information
    // without needing to decode the token again. It helps to maintain a consistent user context throughout
    // the request lifecycle and enables easy implementation of user-specific features.
    return null; // No error, proceed with the handler
  } catch (error) {
    return new Response("Invalid or expired token", { status: 401 });
  }
}
