import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { QueryCommand, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withMiddleware } from "@/app/middleware/withMiddleware";
import { authMiddleware } from "@/app/middleware/authMiddleware";
import _ from "lodash";

// -----------------------------------------------------------------------------------------------------------
// app/friend/[userid]/list/route.js
// This route returns a list of friends for a user.

// APIs:
// GET: This is to retrieve a user's friends - it can also accept in the body to retrieve a specific friend to validate if a friend exists

// -----------------------------------------------------------------------------------------------------------
// GET
async function handlerGET(req, context) {
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID } = params;

  // Step 1: Query to get all friends for the user from `sbm-user-friends` table
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

  try {
    // Query the `sbm-user-friends` table
    const data = await ClientDynamoDB.send(new QueryCommand(Params));

    if (!data.Items || data.Items.length === 0) {
      // Return an empty array if no friends found
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Unmarshall the items
    const friends = data.Items.map((item) => unmarshall(item));

    // Extract all UIDFs to query the `sbm-user` table
    const uidfList = friends.map((friend) => friend.UIDF);

    // Step 2: Query the `sbm-user` table using BatchGetItem to get name and location for each friend
    const userParams = {
      RequestItems: {
        "sbm-user": {
          Keys: uidfList.map((uidf) => ({ UID: { S: uidf } })),
          ProjectionExpression:
            "UID, UserFirstName, UserLastName, UserLocationCountry, UserAvatar",
        },
      },
    };

    const userData = await ClientDynamoDB.send(new BatchGetItemCommand(userParams));

    // Unmarshall the user details
    const userDetails = userData.Responses["sbm-user"].map((item) => unmarshall(item));

    // Step 3: Use lodash to merge friend details with user details
    const mergedFriends = _(friends)
      .map((friend) => {
        const userDetail = _.find(userDetails, { UID: friend.UIDF });
        const userStatus =
          friend.Status === "Pending" ? 1 : friend.Status === "Waiting" ? 2 : 3;
        return {
          ...friend,
          UserFirstName: _.get(userDetail, "UserFirstName", null),
          UserLastName: _.get(userDetail, "UserLastName", null),
          UserLocationCountry: _.get(userDetail, "UserLocationCountry", null),
          UserAvatar: _.get(userDetail, "UserAvatar", null),
          StatusCode: userStatus,
        };
      })
      .sortBy("StatusCode", "UserFirstName") // This will put "Confirmed" first as other options are waiting and pending
      .value();

    // Return the merged friends list
    return new Response(JSON.stringify(mergedFriends), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// We use withMiddleware to wrap our handler with the authMiddleware
export const GET = withMiddleware(handlerGET, authMiddleware);
