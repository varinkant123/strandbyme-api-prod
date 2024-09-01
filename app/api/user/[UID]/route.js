import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { withMiddleware } from "../../../middleware/withMiddleware";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { GetItem } from "@/app/lib/dynamodb/GetItem";
import { UpdateItem } from "@/app/lib/dynamodb/UpdateItem";

// -----------------------------------------------------------------------------------------------------------
// app/user/[userid]/route.js
// This route handles GET, POST, and PUT requests for user data.
// It uses the getItem utility function to fetch user data from DynamoDB.
// Firebase token verification ensures only authorized requests can create or update user records.
// DynamoDB client initialization occurs once per instance, benefiting from Node.js module caching.
async function handlerPOST(req, context) {
  // We use the context object to access params and any data added by middleware
  // This is necessary because middleware like authMiddleware may add user information to the context
  // Safely access params, falling back to an empty object if undefined
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // Add intialised state attributes for new user for non-null values
  const ItemDefaults = {
    // SettingsNotificationFriendRequest: { S: "false" },
  };

  try {
    const ItemParams = {
      TableName: "sbm-user",
      Item: {
        UID: { S: UID },
        DateTimeCreated: { S: new Date().toISOString() },
        SignupCompleted: { S: "false" },
        ...ItemDefaults,
      },
    };

    await ClientDynamoDB.send(new PutItemCommand(ItemParams));
    return new Response("User created successfully", { status: 201 });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// We use withMiddleware to wrap our handler with the authMiddleware
// withMiddleware is a higher-order function that applies middleware to our handler
// It ensures that authMiddleware is run before handlerPOST, and passes the context between them
// This allows authMiddleware to perform authentication and add user info to the context
// The modified context is then passed to handlerPOST
export const POST = withMiddleware(handlerPOST, authMiddleware);

// -----------------------------------------------------------------------------------------------------------
// app/user/[userid]/route.js
// This route handles GET requests for user data.
// query params
//   attributes: A comma-separated list of attributes to retrieve from the user record

async function handlerGET(req, context) {
  // We use the context object to access params and any data added by middleware
  // This is necessary because middleware like authMiddleware may add user information to the context
  // Safely access params, falling back to an empty object if undefined
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // Extract attributes from query params
  const searchParams = new URL(req.url).searchParams;
  const attributes = searchParams.get("attributes");

  // Fetch the user from DynamoDB
  try {
    const item = await GetItem("sbm-user", "UID", UID, null, null, attributes);
    if (!item) {
      return new Response("User not found", { status: 404 });
    }
    return new Response(JSON.stringify(item), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return new Response("Error fetching user", { status: 500 });
  }
}

export const GET = withMiddleware(handlerGET, authMiddleware);

// -----------------------------------------------------------------------------------------------------------
// This route handles PUT requests for user data.
async function handlerPUT(req, context) {
  // We use the context object to access params and any data added by middleware
  // This is necessary because middleware like authMiddleware may add user information to the context
  // Safely access params, falling back to an empty object if undefined
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // Extract Body
  const body = await req.json();

  // Special handling for Global Secondayry Index, which is used for search, for the partition key first three letters
  // are used to partition the table for queries
  if (body.UserFirstName && body.UserLastName) {
    body.GSISearchPK = `${body.UserFirstName.toLowerCase().slice(0, 3)}`;
    body.GSISearchSK = `${body.UserFirstName.toLowerCase()} ${body.UserLastName.toLowerCase()}`;
  }

  // Update the user from DynamoDB
  try {
    await UpdateItem("sbm-user", "UID", UID, null, null, body);

    // Return just a success message with 200 status
    return new Response("User updated successfully", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return new Response("Error updating user", { status: 500 });
  }
}

export const PUT = withMiddleware(handlerPUT, authMiddleware);
