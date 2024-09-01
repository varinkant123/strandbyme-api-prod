import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { withMiddleware } from "../../../../middleware/withMiddleware";
import { authMiddleware } from "../../../../middleware/authMiddleware";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";

// -----------------------------------------------------------------------------------------------------------
// app/user/[userid]/route.js
// This route handles GET requests and returns a 200 status code always with either true or false if the user exists.

async function handlerGET(req, context) {
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // Fetch the user from DynamoDB
  try {
    const command = new GetItemCommand({
      TableName: "sbm-user",
      Key: {
        UID: { S: UID },
      },
      ProjectionExpression: "UID", // We only need to check if the UID exists
    });

    const result = await ClientDynamoDB.send(command);

    const userStatus = !!result.Item; // Convert to boolean

    return new Response(JSON.stringify({ status: userStatus }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error checking user existence:", error);
    return new Response("Error checking user existence", { status: 500 });
  }
}

export const GET = withMiddleware(handlerGET, authMiddleware);
