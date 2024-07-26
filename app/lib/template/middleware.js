import { NextResponse } from "next/server";
// import { auth } from "../firebase/firebaseAdmin";

export async function middleware(req) {
  // Extract the token from the Authorization header
  const token = req.headers.get("authorization")?.split("Bearer ")[1];

  // Check if the token is present
  if (!token) {
    // Return a 401 Unauthorized response if no token is provided
    return new NextResponse("Auth Failed", { status: 401 });
  }

  try {
    // Verify the token using Firebase Admin SDK
    await auth.verifyIdToken(token);
    // If the token is valid, allow the request to proceed
    return NextResponse.next();
  } catch (error) {
    // Log the error for debugging purposes
    console.error("Authentication error:", error);
    // Return a 401 Unauthorized response if the token is invalid or verification fails
    return new NextResponse("Auth Failed", { status: 401 });
  }
}

// Apply middleware to all API routes under /api
export const config = {
  matcher: "/api/:path*", // Apply middleware to /api routes
};

/*
Notes:
1. File Naming and Location:
   - The middleware file must be named `middleware.js`.
   - The file should be placed in the `app` directory.
     └── ...

2. Middleware Function:
   - The middleware function is automatically applied to routes based on the `matcher` configuration.
   - This function extracts the token from the Authorization header and verifies it using the Firebase Admin SDK.

3. Matcher Configuration:
   - The `matcher` property in the config object specifies which routes the middleware should be applied to.
   - In this example, the pattern `'/api/:path*'` ensures that the middleware is applied to all routes under `/api/`.

4. Authentication Requirements:
   - API requests must include an Authorization header with a Bearer token.
   - Example: Authorization: Bearer <token>
   - The token must be a valid Firebase ID token.

5. Structure of req.headers:
   - The req.headers object is a JavaScript object containing all the HTTP headers sent by the client.
   - Common headers include:
     - host: The domain name of the server (e.g., 'example.com').
     - user-agent: Information about the client software making the request.
     - accept: Content types that the client can understand (e.g., 'text/html').
     - accept-encoding: Content encoding that the client can handle (e.g., 'gzip').
     - accept-language: Preferred languages for the response (e.g., 'en-US').
     - authorization: Contains the authentication credentials for HTTP authentication (e.g., 'Bearer <token>').
     - content-type: The media type of the request body (e.g., 'application/json').
     - x-forwarded-for: The originating IP address of the client connecting to the web server via an HTTP proxy or a load balancer.
     - x-forwarded-proto: The originating protocol of the HTTP request (e.g., 'http' or 'https').
     - x-vercel-ip-country, x-vercel-ip-region: Additional headers added by Vercel for geographic information.

6. Runtime Environment:
   - The runtime can be either `node` or `edge`.
   - Next.js enforces an `edge` runtime for middleware, which means certain packages like `firebase-admin` do not work.
   
7. Background on Runtime:
   - A runtime environment refers to the infrastructure that executes code. 
   - The `node` runtime is based on the Node.js server-side environment, suitable for handling complex backend logic and using various Node.js packages.
   - The `edge` runtime is designed for executing code closer to the user (on the edge of the network), providing lower latency and faster response times. 
      However, it has limitations on the packages that can be used due to a more restrictive execution environment.

8. Firebase Authentication:
   - Due to the restrictions of the Edge runtime, the `next-firebase-auth-edge` package is used for Firebase authentication.
   - This package allows Firebase Authentication to be used with the latest Next.js features and is compatible with both Edge and Node.js runtimes.
   - It leverages the Web Crypto API available in Edge runtimes to create and verify custom ID tokens.
   - Features include compatibility with Next.js App Router and Server Components, zero-bundle size, minimal configuration, and secure JWT validation with rotating keys.
   - For installation: `npm install next-firebase-auth-edge`, `yarn add next-firebase-auth-edge`, or `pnpm add next-firebase-auth-edge`.
   - Docs;
   -    https://www.npmjs.com/package/next-firebase-auth-edge
   -    https://next-firebase-auth-edge-docs.vercel.app/docs/getting-started/middleware

By following these conventions, Vercel and Next.js will automatically detect and apply your middleware to the specified routes.
*/
