// app/api/secureRoute/route.js
import { withMiddleware } from "../../middleware/withMiddleware";
import { authMiddleware } from "../../middleware/authMiddleware";

// Sets this route to be dynamically rendered on each request.
// Ensures fresh data and proper authentication handling for every API call.
export const dynamic = "force-dynamic";

const handler = async (request) => {
  // The full URL of the incoming request
  // This includes the protocol, host, and path
  const url = request.url;

  // The HTTP method of the request (in this case, it will be 'GET')
  const method = request.method;

  // Retrieve the value of the 'User-Agent' header from the request
  // The 'User-Agent' header contains information about the client's browser and operating system
  const userAgent = request.headers.get("User-Agent");

  // Parse the URL to get query parameters
  // URLSearchParams allows us to easily access query parameters
  // For example, if the URL is '/api/details?name=John', `name` will be 'John'
  const searchParams = new URL(request.url).searchParams;
  const name = searchParams.get("name") || "Guest"; // Default to 'Guest' if `name` is not provided

  // Retrieve the 'Cookie' header from the request
  // This contains all cookies sent by the client
  const cookies = request.headers.get("Cookie");

  // Construct a response text with the extracted information
  // You can modify this template to include other details as needed
  const responseText = `
      URL: ${url}
      Method: ${method}
      User-Agent: ${userAgent}
      Query Parameter - Name: ${name}
      Cookies: ${cookies}
    `;

  // Create and return a new Response object
  // The response body contains the constructed response text
  // The 'Content-Type' header is set to 'text/plain' to indicate that the response is plain text
  return new Response(responseText, {
    headers: { "Content-Type": "text/plain" },
  });
};

/**
 * Export the GET handler with authentication middleware applied.
 *
 * This ensures that every request to this route passes through the authMiddleware first.
 * If the middleware validates the request, the main handler is executed.
 */
export const GET = withMiddleware(handler, authMiddleware);
