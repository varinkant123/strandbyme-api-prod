import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { QueryCommand, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withMiddleware } from "@/app/middleware/withMiddleware";
import { authMiddleware } from "@/app/middleware/authMiddleware";
import { GetItem } from "@/app/lib/dynamodb/GetItem";
import _ from "lodash";

// -----------------------------------------------------------------------------------------------------------
// app/results/[userid]/[pid]/leaderboard/daily/route.js
// This route returns data requried for the daily leaderboard
// results are cached on the frontend as such this only returns data for the puzzle provided.
// the return object looks like this:
// {
//   "PID": "S00161",
//   "Title": "Strands #161",
//   "Description": "“Hear me roar!”",
//   "Leaderboard": [
//     {
//       "UserFirstName": "John",
//       "UserLastName": "Doe",
//       "UserAvatar": "001",
//       "TimeTaken": "3:12",
//       "EncodedResult": "YBBBBBBB",
//       "Position": 1,
//    }
// }
//
// the tables used in order of logic and sequence are:
// 1. Retrieve list of friends from `sbm-user-friends` table using Query and add UID of the user as well to the list
// 2. Retrieve user details from `sbm-user` table using BatchGetItem
// 3. Retrieve results from `sbm-user-result` table using BatchGetItem
//
// Need to handle these cases:
// - No friends found: then return just the users results
// - If the user has no results: then still include the user results but have timetaken, encodedresult, position as empty strings
//
// Important
// I have added a new property called FriendRequestFlag which will return any new friends that requested to be added
// as this is returned to the page screen daily, it will also serve to show a modal to redirect to the friends screen.

// -----------------------------------------------------------------------------------------------------------
// GET
async function handlerGET(req, context) {
  const { params = {} } = context || {};
  const { UID, PID } = params;
  let UIDArray = [UID];
  let FriendRequestsFlag = false;
  let dataUserFriendsUnmarshalled = [];
  let dataUserDetailsUnmarshalled = [];
  let dataUserResultUnmarshalled = [];
  let PIDDetails = null;

  // Step 1: Query to get all friends for the user from `sbm-user-friends` table
  // -----------------------------------------------------------------------------------------------------------
  try {
    const ParamsUserFriends = {
      TableName: "sbm-user-friends",
      KeyConditionExpression: "UID = :uid",
      ExpressionAttributeValues: {
        ":uid": { S: UID },
      },
      ExpressionAttributeNames: {
        "#status": "Status",
      },
      ProjectionExpression: "UIDF, #status",
    };

    const dataUserFriends = await ClientDynamoDB.send(
      new QueryCommand(ParamsUserFriends)
    );

    if (dataUserFriends.Count > 0) {
      dataUserFriendsUnmarshalled = dataUserFriends.Items.map((item) => unmarshall(item));

      const UIDFriends = dataUserFriendsUnmarshalled
        .filter((item) => item.Status === "Confirmed")
        .map((item) => item.UIDF);

      FriendRequestsFlag = dataUserFriendsUnmarshalled
        .filter((item) => item.Status === "Pending")
        .map((item) => item.UIDF);

      UIDArray = UIDArray.concat(UIDFriends);
    }
  } catch (error) {
    console.error("Error in Step 1: Query user friends", error);
  }

  // Step 2: Query the `sbm-user` table to get all friends requests
  // -----------------------------------------------------------------------------------------------------------
  let FriendRequestsFlagBoolean = false;

  try {
    FriendRequestsFlagBoolean = FriendRequestsFlag.length > 0;
  } catch (error) {
    console.error("Error in Step 2: Setting FriendRequestsFlagBoolean", error);
  }

  // Step 3: Query the `sbm-user` table for user details
  // -----------------------------------------------------------------------------------------------------------
  try {
    const userParams = {
      RequestItems: {
        "sbm-user": {
          Keys: UIDArray.map((uidf) => ({ UID: { S: uidf } })),
          ProjectionExpression: "UID, UserFirstName, UserLastName, UserAvatar",
        },
      },
    };

    const dataUserDetails = await ClientDynamoDB.send(
      new BatchGetItemCommand(userParams)
    );

    dataUserDetailsUnmarshalled = dataUserDetails.Responses["sbm-user"].map((item) =>
      unmarshall(item)
    );
  } catch (error) {
    console.error("Error in Step 3: Query user details", error);
  }

  // Step 4: Query the `sbm-user-result` table
  // -----------------------------------------------------------------------------------------------------------
  try {
    const userResultParams = {
      RequestItems: {
        "sbm-user-result": {
          Keys: UIDArray.map((uid) => ({ UID: { S: uid }, PID: { S: PID } })),
          ProjectionExpression: "UID, EncodedResult, HintsUsed, TimeTakenInSeconds",
        },
      },
    };

    const dataUserResult = await ClientDynamoDB.send(
      new BatchGetItemCommand(userResultParams)
    );

    dataUserResultUnmarshalled = dataUserResult.Responses["sbm-user-result"].map((item) =>
      unmarshall(item)
    );
  } catch (error) {
    console.error("Error in Step 4: Query user results", error);
  }

  // Step 5: Merge user details with user result details
  // -----------------------------------------------------------------------------------------------------------
  const mergedUsers = _(dataUserDetailsUnmarshalled)
    .map((userDetail) => {
      const userResultDetail = _.find(dataUserResultUnmarshalled, {
        UID: userDetail.UID,
      });
      return {
        ...userDetail,
        // these are used in the app front-end
        TimeTaken: userResultDetail ? userResultDetail.TimeTakenInSeconds : "",
        HintsUsed: userResultDetail ? userResultDetail.HintsUsed : "",
        EncodedResult: userResultDetail ? userResultDetail.EncodedResult : "",

        // for sort only
        SortTimeTaken: userResultDetail
          ? parseInt(userResultDetail.TimeTakenInSeconds)
          : 9999999999,
        SortHintsUsed: userResultDetail
          ? parseInt(userResultDetail.HintsUsed)
          : 9999999999,
        SortCompletedFlag: userResultDetail ? 0 : 1,
      };
    })
    .sortBy(["SortCompletedFlag", "SortHintsUsed", "SortTimeTaken", "UserFirstName"])
    .value();

  // Step 6: Assign positions with tie handling
  // -----------------------------------------------------------------------------------------------------------
  let currentPosition = 1;
  let tieCount = 0;

  const mergedUsersWithPositions = _(mergedUsers).reduce((acc, user, index, array) => {
    if (index > 0) {
      const prevUser = array[index - 1];
      if (
        user.HintsUsed === prevUser.HintsUsed &&
        user.TimeTaken === prevUser.TimeTaken
      ) {
        tieCount++;
      } else {
        currentPosition += tieCount + 1;
        tieCount = 0;
      }
    }

    acc.push({
      ...user,
      Position: user.TimeTaken ? currentPosition : "",
    });

    return acc;
  }, []);

  // Step 7: Fetch puzzle details
  // -----------------------------------------------------------------------------------------------------------
  try {
    PIDDetails = await GetItem("sbm-reference", "PKID", "PID", "SKID", PID);
  } catch (error) {
    console.error("Error in Step 7: Fetch puzzle details", error);
  }

  // -----------------------------------------------------------------------------------------------------------

  const response = {
    PID: PID,
    Title: PIDDetails?.Title ?? null,
    Description: PIDDetails?.Description ?? null,
    Leaderboard: mergedUsersWithPositions,
    FriendRequestsFlag: FriendRequestsFlagBoolean,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// We use withMiddleware to wrap our handler with the authMiddleware
export const GET = withMiddleware(handlerGET, authMiddleware);
