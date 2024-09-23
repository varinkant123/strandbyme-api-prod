import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { QueryCommand, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withMiddleware } from "@/app/middleware/withMiddleware";
import { authMiddleware } from "@/app/middleware/authMiddleware";
import _ from "lodash";
import getPIDMonthStartEnd from "@/app/lib/utils/getPIDMonthStartEnd";

// -----------------------------------------------------------------------------------------------------------
// app/results/[userid]/[pid]/leaderboard/monthly/route.js
// This route returns data requried for the monthly leaderboard
// results are cached on the frontend as such this only returns data for the puzzle provided.
// the return object looks like this:
// {
//   "Month": "2024-08",
//   "LeaderboardTotal": [
//     {
//       "UserFirstName": "John",
//       "UserAvatar": "001",
//       "Value": 1,
//       "Position": 1,
//    }
//  "LeaderboardBestTime": [
//     {
//       "UserFirstName": "John",
//       "UserAvatar": "001",
//       "Value": "3:12",
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

// handlet to query to get monthly results
// -----------------------------------------------------------------------------------------------------------
async function getMonthlyResults(UIDs, startPuzzle, endPuzzle) {
  const results = {};

  const queryPromises = UIDs.map(async (uid) => {
    const queryParams = {
      TableName: "sbm-user-result",
      KeyConditionExpression: "UID = :uid AND PID BETWEEN :startPid AND :endPid",
      ExpressionAttributeValues: {
        ":uid": { S: uid },
        ":startPid": { S: `S${startPuzzle.toString().padStart(5, "0")}` },
        ":endPid": { S: `S${endPuzzle.toString().padStart(5, "0")}` },
      },
      ProjectionExpression: "PID, TimeTakenInSeconds, HintsUsed",
    };

    const queryResponse = await ClientDynamoDB.send(new QueryCommand(queryParams));
    results[uid] = queryResponse.Items.map((item) => unmarshall(item));
  });

  await Promise.all(queryPromises);
  return results;
}

// -----------------------------------------------------------------------------------------------------------
// GET
async function handlerGET(req, context) {
  const { params = {} } = context || {};

  // Extract UID from params
  const { UID, DateYearMonth } = params;

  // Variables to hold the results
  // this keeps the total uid that are required for the leaderboard including the user
  let UIDArray = [UID];

  try {
    // Step 1: Query to get all friends for the user from `sbm-user-friends` table - filter for Confirmed only
    // -----------------------------------------------------------------------------------------------------------
    const ParamsUserFriends = {
      TableName: "sbm-user-friends",
      KeyConditionExpression: "UID = :uid",
      FilterExpression: "#status = :confirmStatus",
      ExpressionAttributeValues: {
        ":uid": { S: UID },
        ":confirmStatus": { S: "Confirmed" },
      },
      ExpressionAttributeNames: {
        "#status": "Status",
      },
      ProjectionExpression: "UIDF",
    };

    // Query the `sbm-user-friends` table
    const dataUserFriends = await ClientDynamoDB.send(
      new QueryCommand(ParamsUserFriends)
    );

    // if data is present then add to the UIDArray
    if (dataUserFriends.Count > 0) {
      // Unmarshall the items
      const dataUserFriendsUnmarshalled = dataUserFriends.Items.map((item) =>
        unmarshall(item)
      );
      const UIDFriends = dataUserFriendsUnmarshalled.map((item) => item.UIDF);
      UIDArray = UIDArray.concat(UIDFriends);
    }

    // Step 2: Query the `sbm-user` table using BatchGetItem to get name and location for each friend
    // -----------------------------------------------------------------------------------------------------------
    const userParams = {
      RequestItems: {
        "sbm-user": {
          Keys: UIDArray.map((uidf) => ({ UID: { S: uidf } })),
          ProjectionExpression: "UID, UserFirstName, UserAvatar",
        },
      },
    };

    const dataUserDetails = await ClientDynamoDB.send(
      new BatchGetItemCommand(userParams)
    );

    // Unmarshall the user details
    const dataUserDetailsUnmarshalled = dataUserDetails.Responses["sbm-user"].map(
      (item) => unmarshall(item)
    );

    // Step 3: Query the `sbm-user-result` table using BatchGetItem to get name and location for each friend
    // -----------------------------------------------------------------------------------------------------------
    // get the start and end of puzzle using the date
    // only need to return integer, strand id constructed inside of function
    const { PIDStart, PIDEnd } = getPIDMonthStartEnd(DateYearMonth);

    const dataUserResultsForMonth = await getMonthlyResults(UIDArray, PIDStart, PIDEnd);

    // Step 4: Process results and keep as seperate objects for leaderboard with uid and value for each
    // -----------------------------------------------------------------------------------------------------------
    const resultsTotalCompleted = {};
    const resultsTotalCompletdNoHints = {};
    const resultsBestTime = {};
    const resultsAverageTime = {};
    // const resultsDailyWins = {};

    UIDArray.forEach((uid) => {
      const userResults = dataUserResultsForMonth[uid] || [];

      if (userResults.length > 0) {
        // total completed
        resultsTotalCompleted[uid] = userResults.length;

        // best time
        const bestTime = Math.min(
          ...userResults.map((r) => Number(r.TimeTakenInSeconds))
        );
        resultsBestTime[uid] = bestTime;

        // average time
        const averageTime = _.mean(userResults.map((r) => Number(r.TimeTakenInSeconds)));
        resultsAverageTime[uid] = Math.round(averageTime);

        // total completed with no hints
        const totalCompletedNoHints = userResults.filter(
          (r) => r.HintsUsed === "0"
        ).length;
        resultsTotalCompletdNoHints[uid] = Math.round(
          (100 * totalCompletedNoHints) / userResults.length
        );
      } else {
        resultsTotalCompleted[uid] = null;
        resultsBestTime[uid] = null;
        resultsAverageTime[uid] = null;
        resultsTotalCompletdNoHints[uid] = null;
      }
    });

    // Step 5: Generic function which creates and sorts a leaderboard
    const createLeaderboard = (data, valueKey, sortOrder = "desc") => {
      return Object.entries(data)
        .map(([uid, value]) => {
          const userDetail = dataUserDetailsUnmarshalled.find((u) => u.UID === uid);
          return {
            UID: uid,
            UserFirstName: userDetail?.UserFirstName || "",
            UserAvatar: userDetail?.UserAvatar || "",
            [valueKey]: value,
          };
        })
        .sort((a, b) => {
          if (a[valueKey] === null && b[valueKey] === null) return 0;
          if (a[valueKey] === null) return 1;
          if (b[valueKey] === null) return -1;
          return sortOrder === "desc"
            ? b[valueKey] - a[valueKey]
            : a[valueKey] - b[valueKey];
        })
        .map((entry, index) => ({ ...entry, Position: index + 1 }));
    };

    const leaderboardTotal = createLeaderboard(resultsTotalCompleted, "Value", "desc");
    const leaderboardBestTime = createLeaderboard(resultsBestTime, "Value", "asc");
    const leaderboardAverageTime = createLeaderboard(resultsAverageTime, "Value", "asc");
    const leaderboardTotalCompletedNoHints = createLeaderboard(
      resultsTotalCompletdNoHints,
      "Value",
      "desc"
    );

    // Step 6: Response
    // -----------------------------------------------------------------------------------------------------------
    const response = {
      DateYearMonth: DateYearMonth,
      LeaderboardTotal: leaderboardTotal,
      LeaderboardBestTime: leaderboardBestTime,
      LeaderboardAverageTime: leaderboardAverageTime,
      LeaderboardTotalCompletedNoHints: leaderboardTotalCompletedNoHints,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// We use withMiddleware to wrap our handler with the authMiddleware
export const GET = withMiddleware(handlerGET, authMiddleware);
