import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { withMiddleware } from "@/app/middleware/withMiddleware";
import { authMiddleware } from "@/app/middleware/authMiddleware";

// -----------------------------------------------------------------------------------------------------------
// The POST request is for the start of a new interval of a puzzle
// The PUT request is for the end of an interval of a puzzle

// As these functions are quite brittle, i want to console.log the api calls which get captured in
// the vercel logs. This is to help me debug the api calls.

// -----------------------------------------------------------------------------------------------------------
// app/user/[userid]/results/log/start.js
// This route handles POST request to add intitaltime record for a given interval of a puzzle
async function handlerPOST(req, context) {
  // We use the context object to access params and any data added by middleware
  // This is necessary because middleware like authMiddleware may add user information to the context
  // Safely access params, falling back to an empty object if undefined
  const { params = {} } = context || {};

  // Extract UID and PID from params
  const { UID, PID } = params;

  // Construct Primary Key which is a composite of UID and PID
  const PK = `${UID}#${PID}`;

  // Deconstruct Body
  const { DateTimeStartOnDevice } = await req.json();

  // Logging
  try {
    const body = await req.json();
    console.log("POST /results/log/start");
    console.log("Body:", DateTimeStartOnDevice);
    console.log("UID:", UID, "PID:", PID);
    console.log("Headers:", req.headers);
  } catch (error) {
    console.error("Error logging POST /results/log/start", error);
  }

  try {
    const ItemParams = {
      TableName: "sbm-user-result-log",
      Item: {
        UIDPID: { S: PK },
        DateTimeStartOnDevice: { S: DateTimeStartOnDevice },
        FlagClosed: { S: "false" },
      },
    };

    await ClientDynamoDB.send(new PutItemCommand(ItemParams));
    return new Response("Result log created successfully", { status: 201 });
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
// app/user/[userid]/results/log/end.js
// This route handles PUT request to close out time record for a given interval of a puzzle

async function handlerPUT(req, context) {
  // We use the context object to access params and any data added by middleware
  // This is necessary because middleware like authMiddleware may add user information to the context
  // Safely access params, falling back to an empty object if undefined
  const { params = {} } = context || {};

  // Extract UID and PID from params
  const { UID, PID } = params;

  // Construct Primary Key which is a composite of UID and PID
  const PK = `${UID}#${PID}`;

  // Deconstruct Body
  const { DateTimeStartOnDevice, DateTimeEndOnDevice, FlagClosed } = await req.json();

  try {
    const ItemParams = {
      TableName: "sbm-user-result-log",
      Item: {
        UIDPID: { S: PK },
        DateTimeStartOnDevice: { S: DateTimeStartOnDevice },
        DateTimeEndOnDevice: { S: DateTimeEndOnDevice },
        FlagClosed: { S: FlagClosed },
      },
    };

    await ClientDynamoDB.send(new PutItemCommand(ItemParams));
    return new Response("Result log updated successfully", { status: 201 });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// We use withMiddleware to wrap our handler with the authMiddleware
// withMiddleware is a higher-order function that applies middleware to our handler
// It ensures that authMiddleware is run before handlerPOST, and passes the context between them
// This allows authMiddleware to perform authentication and add user info to the context
// The modified context is then passed to handlerPOST
export const PUT = withMiddleware(handlerPUT, authMiddleware);
