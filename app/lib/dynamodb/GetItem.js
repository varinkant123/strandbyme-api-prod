import ClientDynamoDB from "./ClientDynamoDB";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

/**
 * Fetch an item from DynamoDB.
 *
 * @param {string} tableName - The name of the DynamoDB table.
 * @param {string} partitionKeyName - The name of the partition key.
 * @param {string} partitionKeyValue - The value of the partition key.
 * @param {string} [sortKeyName] - The name of the sort key (optional).
 * @param {string} [sortKeyValue] - The value of the sort key (optional).
 * @returns {Object} The retrieved item or null if not found.
 */

export async function GetItem(
  tableName,
  partitionKeyName,
  partitionKeyValue,
  sortKeyName = null,
  sortKeyValue = null,
  attributes = null
) {
  // prepare the query
  const key = {
    [partitionKeyName]: { S: partitionKeyValue },
  };

  if (sortKeyName && sortKeyValue) {
    key[sortKeyName] = { S: sortKeyValue };
  }

  const getItemParams = {
    TableName: tableName,
    Key: key,
  };

  // If attributes is not null, add ProjectionExpression
  if (attributes) {
    getItemParams.ProjectionExpression = attributes;
  }

  // execute the query
  try {
    const data = await ClientDynamoDB.send(new GetItemCommand(getItemParams));
    if (!data.Item) return null;
    const item = unmarshall(data.Item);
    return item;
  } catch (error) {
    throw new Error(`Failed to get item: ${error.message}`);
  }
}
