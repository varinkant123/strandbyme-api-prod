import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withMiddleware } from "../../../middleware/withMiddleware";
import { authMiddleware } from "../../../middleware/authMiddleware";

// -----------------------------------------------------------------------------------------------------------
// app/user/search/route.js
// This route handles GET requests for user search by using the global serach index.
// query params
//   attributes: A comma-separated list of attributes to retrieve from the user record

async function handlerGET(req, context) {
  // We use the context object to access params and any data added by middleware
  // This is necessary because middleware like authMiddleware may add user information to the context
  // Safely access params, falling back to an empty object if undefined
  const { params = {} } = context || {};

  // Extract attributes from query params
  const searchParams = new URL(req.url).searchParams;
  const searchValue = searchParams.get("query");

  // Fetch using query
  if (!searchValue) {
    return new Response(JSON.stringify({ error: "Search value is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // process the search value and decode it
  const decodedSearchValue = decodeURIComponent(searchValue).toLowerCase().trim();
  const partitionKeyPrefix = decodedSearchValue.slice(0, 3).trim();

  const paramsQuery = {
    TableName: "sbm-user",
    IndexName: "GSISearchPK-GSISearchSK-index",
    KeyConditionExpression: "GSISearchPK = :pk AND begins_with(GSISearchSK, :sk)",
    ExpressionAttributeValues: {
      ":pk": { S: partitionKeyPrefix },
      ":sk": { S: decodedSearchValue },
    },
    Limit: 10,
    ProjectionExpression:
      "UID, UserFirstName, UserLastName, UserLocationCountry, UserAvatar",
  };

  try {
    const data = await ClientDynamoDB.send(new QueryCommand(paramsQuery));

    // Unmarshall the items
    const unmarshalledItems = data.Items.map((item) => unmarshall(item));

    return new Response(JSON.stringify(unmarshalledItems), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error querying users:", err);
    return new Response(
      JSON.stringify({ error: "An error occurred while searching users" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const GET = withMiddleware(handlerGET, authMiddleware);
