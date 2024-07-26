import { withMiddleware } from "../../middleware/withMiddleware";
import { authMiddleware } from "../../middleware/authMiddleware";

export const dynamic = "force-dynamic";

const handler = function (request) {
  const value = "lorem ipsum";

  return new Response(value, {
    headers: { "Content-Type": "text/plain" },
  });
};

// Export the GET handler with authentication middleware applied.
export const GET = withMiddleware(handler, authMiddleware);
