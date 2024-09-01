import ClientDynamoDB from "./ClientDynamoDB";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

/**
 * Update an item in DynamoDB.
 *
 * @param {string} tableName - The name of the DynamoDB table.
 * @param {string} partitionKeyName - The name of the partition key.
 * @param {string} partitionKeyValue - The value of the partition key.
 * @param {Object} updateValues - An object containing the names and values to update.
 * @param {string} [sortKeyName] - The name of the sort key (optional).
 * @param {string} [sortKeyValue] - The value of the sort key (optional).
 * @returns {Object} The updated item attributes or null if update failed.
 */
export async function UpdateItem(
  tableName,
  partitionKeyName,
  partitionKeyValue,
  sortKeyName,
  sortKeyValue,
  updateValues
) {
  const key = {
    [partitionKeyName]: { S: partitionKeyValue },
  };

  if (sortKeyName && sortKeyValue) {
    key[sortKeyName] = { S: sortKeyValue };
  }

  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  for (const [attribute, value] of Object.entries(updateValues)) {
    const attributeKey = `#${attribute}`;
    const valueKey = `:${attribute}`;
    updateExpressions.push(`${attributeKey} = ${valueKey}`);
    expressionAttributeNames[attributeKey] = attribute;
    expressionAttributeValues[valueKey] = { S: value };
  }

  const updateParams = {
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  try {
    const data = await ClientDynamoDB.send(new UpdateItemCommand(updateParams));
    return data.Attributes || null;
  } catch (error) {
    throw new Error(`Failed to update item: ${error.message}`);
  }
}
