import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// config object
const config = {
  region: "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
  },
};

// This file defines utility functions for interacting with DynamoDB.
// The DynamoDB client is initialized once and reused across function calls,
// leveraging Node.js module caching to ensure efficiency in serverless environments.
const ClientDynamoDB = new DynamoDBClient(config);

// Create an Amazon DynamoDB service client object.
export default ClientDynamoDB;

// resources;
// https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/dynamodb-example-document-client.html
