import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { withMiddleware } from "@/app/middleware/withMiddleware";
import { authMiddleware } from "@/app/middleware/authMiddleware";
import { GetItem } from "@/app/lib/dynamodb/GetItem";
import _ from "lodash";
import { differenceInSeconds, parse } from "date-fns";
import getAESTTime from "@/app/lib/utils/getAESTTime";

// -----------------------------------------------------------------------------------------------------------
// The POST request is to store report issue to reference table in dynamodb, the body of the request
// contains Email, Message and UID in body

// -----------------------------------------------------------------------------------------------------------
// app/user/[userid]/results/log/start.js
// This route handles POST request to add intitaltime record for a given interval of a puzzle
async function handlerPOST(req, context) {
  // We use the context object to access params and any data added by middleware
  // This is necessary because middleware like authMiddleware may add user information to the context
  // Safely access params, falling back to an empty object if undefined
  const { params = {} } = context || {};

  // Deconstruct Body
  const { Email, Message, UID } = await req.json();

  // Store in reference table
  const DateTimeCreated = getAESTTime();

  try {
    const ItemParams = {
      TableName: "sbm-reference",
      Item: {
        PKID: { S: "RI" },
        SKID: { S: DateTimeCreated },
        Email: { S: Email },
        Message: { S: Message },
        UID: { S: UID },
      },
    };
    await ClientDynamoDB.send(new PutItemCommand(ItemParams));
    return new Response("Issue reported successfully", { status: 201 });
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
