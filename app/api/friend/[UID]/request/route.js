import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { TransactWriteItemsCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withMiddleware } from "@/app/middleware/withMiddleware";
import { authMiddleware } from "@/app/middleware/authMiddleware";
import getAESTTime from "@/app/lib/utils/getAESTTime";

// -----------------------------------------------------------------------------------------------------------
// app/friend/[userid]/request/route.js
// This route handles friend requests from the search screen through put requests.
// It will return data if the user is already a friend, or if a request is sent.
//
// The table structure is as follows:
// UID: Unique identifier for the user
// UIDF: Unique identifier for the friend
// Status: Status of the friend request
// DateTimeCreated: Date and time of the friend request
//
// Important - Two records are created for each friend request in which UID and UIDF are swapped but
// with different statuses. This is handled using TransactWriteItemsCommand to ensure consistency.
//
// Statuses:
// "Pending": The friend request has been sent and can be accepted
// "Waiting": The friend request has been sent but it is on the other user to accept
// "Confirmed": The friend request has been accepted
// "Rejected": Is not a status but rather the records will be deleted, so it is not used
//
// APIs:
// POST: This is when a friend request is sent by adding from search screen
// DELETE: This is when a friend request is rejected or deleted and removes user-friend record pairs
// PUT: This is when a friend request is accepted
// GET: This is to retrieve a user's friends - it can also accept in the body to retrieve a specific friend to validate if a friend exists

// -----------------------------------------------------------------------------------------------------------
// POST
async function handlerPOST(req, context) {
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // Deconstruct Body
  const { UIDF } = await req.json();

  // Variables
  const DateTimeCreated = getAESTTime();

  // Construct Params for Both Writes
  const Params = {
    TransactItems: [
      {
        Put: {
          TableName: "sbm-user-friends",
          Item: {
            UID: { S: UID },
            UIDF: { S: UIDF },
            // note it is waiting as UID has sent the request
            Status: { S: "Waiting" },
            DateTimeCreated: { S: DateTimeCreated },
          },
        },
        ConditionExpression: "attribute_not_exists(UIDF)",
      },

      {
        Put: {
          TableName: "sbm-user-friends",
          Item: {
            UID: { S: UIDF },
            UIDF: { S: UID },
            // note it is pending as UIDF has to accept the request
            Status: { S: "Pending" },
            DateTimeCreated: { S: DateTimeCreated },
          },
        },
        ConditionExpression: "attribute_not_exists(UIDF)",
      },
    ],
  };

  try {
    await ClientDynamoDB.send(new TransactWriteItemsCommand(Params));
    return new Response("Friend request sent successfully", { status: 201 });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// We use withMiddleware to wrap our handler with the authMiddleware
export const POST = withMiddleware(handlerPOST, authMiddleware);

// -----------------------------------------------------------------------------------------------------------
// DELETE
async function handlerDELETE(req, context) {
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // Extract UIDF from query parameters
  const url = new URL(req.url);
  const UIDF = url.searchParams.get("UIDF");

  if (!UIDF) {
    return new Response("UIDF is required", { status: 400 });
  }

  // Construct Params for Both Writes
  const Params = {
    TransactItems: [
      {
        Delete: {
          TableName: "sbm-user-friends",
          Key: {
            UID: { S: UID },
            UIDF: { S: UIDF },
          },
          ConditionExpression: "attribute_exists(UID) AND attribute_exists(UIDF)",
        },
      },

      {
        Delete: {
          TableName: "sbm-user-friends",
          Key: {
            UID: { S: UIDF },
            UIDF: { S: UID },
          },
          ConditionExpression: "attribute_exists(UID) AND attribute_exists(UIDF)",
        },
      },
    ],
  };

  try {
    await ClientDynamoDB.send(new TransactWriteItemsCommand(Params));
    return new Response("Friend request deleted successfully", { status: 201 });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// We use withMiddleware to wrap our handler with the authMiddleware
export const DELETE = withMiddleware(handlerDELETE, authMiddleware);

// -----------------------------------------------------------------------------------------------------------
// PUT
async function handlerPUT(req, context) {
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // Deconstruct Body
  const { UIDF } = await req.json();

  // Construct Params for Both Writes
  const Params = {
    TransactItems: [
      {
        Update: {
          TableName: "sbm-user-friends",
          Key: {
            UID: { S: UID },
            UIDF: { S: UIDF },
          },
          UpdateExpression: "SET #status = :confirmedStatus",
          ExpressionAttributeNames: {
            "#status": "Status",
          },
          ExpressionAttributeValues: {
            ":confirmedStatus": { S: "Confirmed" },
          },
          ConditionExpression: "attribute_exists(UID) AND attribute_exists(UIDF)",
        },
      },
      {
        Update: {
          TableName: "sbm-user-friends",
          Key: {
            UID: { S: UIDF },
            UIDF: { S: UID },
          },
          UpdateExpression: "SET #status = :confirmedStatus",
          ExpressionAttributeNames: {
            "#status": "Status",
          },
          ExpressionAttributeValues: {
            ":confirmedStatus": { S: "Confirmed" },
          },
          ConditionExpression: "attribute_exists(UID) AND attribute_exists(UIDF)",
        },
      },
    ],
  };

  try {
    await ClientDynamoDB.send(new TransactWriteItemsCommand(Params));
    return new Response("Friend request sent successfully", { status: 201 });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// We use withMiddleware to wrap our handler with the authMiddleware
export const PUT = withMiddleware(handlerPUT, authMiddleware);

// -----------------------------------------------------------------------------------------------------------
// GET
async function handlerGET(req, context) {
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // UIDF is optional and is retrieved from query params, note it cannot be passed through body as it is
  // a GET request not a POST/PUT request
  const searchParams = new URL(req.url).searchParams;
  const UIDF = searchParams.get("UIDF");

  // Uses Query to get all friends for a user
  const Params = {
    TableName: "sbm-user-friends",
    KeyConditionExpression: "UID = :uid",
    ExpressionAttributeValues: {
      ":uid": { S: UID },
    },
    ProjectionExpression: "UIDF, #status",
    ExpressionAttributeNames: {
      "#status": "Status",
    },
  };

  // If UIDF is provided, add it to the KeyConditionExpression
  if (UIDF) {
    Params.KeyConditionExpression += " AND UIDF = :uidf";
    Params.ExpressionAttributeValues[":uidf"] = { S: UIDF };
  }

  // api call
  try {
    // query the table
    const data = await ClientDynamoDB.send(new QueryCommand(Params));

    // check if there are any items
    if (!data.Items) return null;

    // unmarshall the items
    const items = data.Items.map((item) => unmarshall(item));

    // return the items
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// We use withMiddleware to wrap our handler with the authMiddleware
export const GET = withMiddleware(handlerGET, authMiddleware);
