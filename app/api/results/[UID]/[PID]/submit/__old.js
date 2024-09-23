import ClientDynamoDB from "@/app/lib/dynamodb/ClientDynamoDB";
import { PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { withMiddleware } from "@/app/middleware/withMiddleware";
import { authMiddleware } from "@/app/middleware/authMiddleware";
import { GetItem } from "@/app/lib/dynamodb/GetItem";
import { PutItem } from "@/app/lib/dynamodb/PutItem";
import _ from "lodash";
import { differenceInSeconds, parse } from "date-fns";

// -----------------------------------------------------------------------------------------------------------
// The POST request accepts the result of a puzzle in raw html format
// it processes this html and encodes the result as a string and determines the number of hints used
// it then queries results log to determine the total time taken for the puzzle
// it then stores the result in results

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

  // Deconstruct Body
  const { HTMLStringResult, HTMLStringDescription } = await req.json();

  // STEP 1: Process HTML String
  // -----------------------------------------------------------------------------------------------------------
  // Process HTMLStringResult and determine number of hints used and encoded result
  const processHTMLStringResult = (HTMLString) => {
    // Regular expression to match the circle elements in the HTML string
    // The regular expression has the following parts:
    // 1. <div class="(?:_5Nj5-q_)?circle": This part matches the div element with the class "circle" or "_5Nj5-q_circle".
    //    The (?:) syntax is a non-capturing group, which means the matched text is not stored in a capturing group.
    // 2. (?:\s+style="([^"]*)")?": This part matches the optional "style" attribute of the div element.
    //    The (?:\s+style="([^"]*)")?" part uses a non-capturing group to match the style attribute.
    //    The ([^"]*) part captures the value of the style attribute in the first capturing group.
    // 3. \s*<\/div>: This part matches the closing div tag, allowing for optional whitespace.
    // 4. /g: The global flag ensures that the regular expression matches all occurrences of the pattern in the HTML string.
    const circleRegex =
      /<div class="(?:_5Nj5-q_)?circle"(?:\s+style="([^"]*)")?>\s*<\/div>/g;

    const colorSequence = [];

    // Use a while loop to iterate through all the matches in the HTML string
    let match;
    while ((match = circleRegex.exec(HTMLString)) !== null) {
      // The first capturing group (match[1]) contains the value of the "style" attribute, if present
      const style = match[1];

      // Determine the color of the circle based on the style attribute
      if (!style) {
        // If the style attribute is not present, it's a hint/light bulb
        colorSequence.push("L");
      } else if (style.includes("--yellow")) {
        colorSequence.push("Y");
      } else if (style.includes("--hint-blue")) {
        colorSequence.push("B");
      } else {
        // If the style doesn't match the expected patterns, push an empty string
        colorSequence.push("");
      }
    }

    // Join the color sequence array into a single string, which represents the encoded result
    const EncodedResult = colorSequence.join("");

    // Calculate the number of hints used by counting the number of "L" (light bulb) elements in the color sequence
    const HintsUsed = colorSequence.filter((color) => color === "L").length;

    // Return an object containing the number of hints used and the encoded result
    return { HintsUsed, EncodedResult };
  };
  const { HintsUsed, EncodedResult } = processHTMLStringResult(HTMLStringResult);

  // STEP 2: Meta Data of Puzzle
  // -----------------------------------------------------------------------------------------------------------
  // First run a read to check if the puzzle title and description exist in the puzzle table
  // If costs become a issue we can eventually create a seperate function which runs this but given
  // reads are cheap in dynamodb.

  // get the description from the html string function
  const processHTMLStringDescription = (HTMLString) => {
    // Regular expression to match the circle elements in the HTML string
    // Nothing to process already returns as is
    return HTMLString;
  };

  // read to see if the puzzle title and description exist in the puzzle table
  const getPuzzleMetaData = async (PID) => {
    const data = await GetItem("sbm-reference", "PKID", "PID", "SKID", PID);
    return data;
  };
  const puzzleMetaData = await getPuzzleMetaData(PID);

  // if item doesn't exists then store in reference table
  if (puzzleMetaData === null) {
    try {
      // get title and description - this takes PID of S00161, extracts the number and formats it as a string
      const PIDTitle = `Strands #${parseInt(PID.match(/S0*(\d+)/)[1])}`;
      const PIDDescription = processHTMLStringDescription(HTMLStringDescription);

      const ItemParams = {
        TableName: "sbm-reference",
        Item: {
          PKID: { S: "PID" },
          SKID: { S: PID },
          Title: { S: PIDTitle },
          Description: { S: PIDDescription },
        },
      };

      await ClientDynamoDB.send(new PutItemCommand(ItemParams));
    } catch (error) {
      console.error("Error in Step 2: Store Puzzle Meta Data", error);
    }
  }

  // STEP 3A: Query Results Log
  // -----------------------------------------------------------------------------------------------------------
  // query results log
  // can confirm on frontend that the final log will be submitted before the submit route is invoked.
  // this means we can gurantee that the final log will be submitted before the submit route is invoked
  const queryResultLog = async (UID, PID) => {
    // Construct Primary Key which is a composite of UID and PID
    const PK = `${UID}#${PID}`;

    // Query results log
    const ItemParams = {
      TableName: "sbm-user-result-log",
      KeyConditionExpression: "UIDPID = :PK",
      ExpressionAttributeValues: {
        ":PK": { S: PK },
      },
      ProjectionExpression: "DateTimeEndOnDevice, DateTimeStartOnDevice",
    };

    const data = await ClientDynamoDB.send(new QueryCommand(ItemParams));
    return data.Items;
  };

  const dataResultLog = await queryResultLog(UID, PID);

  // STEP 3B: Sum up Time Taken
  // -----------------------------------------------------------------------------------------------------------
  // sample data structure returned is pasted below, need to use lodash and date-fns to parse end and
  // start and use a reduce to sum up time taken as minutes and seconds i.e. 3:15, filter out incomplete interval pairs
  // [
  //   {
  //     "DateTimeEndOnDevice": {
  //       "S": "2024-08-19 08:50:05 484"
  //     },
  //     "DateTimeStartOnDevice": {
  //       "S": "2024-08-19 08:47:48 233"
  //     }
  //   },
  //   {
  //     "DateTimeEndOnDevice": {
  //       "S": "2024-08-19 08:50:11 007"
  //     },
  //     "FlagClosed": {
  //       "S": "false"
  //     },
  //   },
  // ]

  const sumUpTimeTaken = (dataResultLog) => {
    // Use Lodash to sum up the time taken in minutes
    const TimeTakenInSeconds = _.reduce(
      dataResultLog,
      (acc, item) => {
        // check if both StartTime and EndTime are present
        if (item.DateTimeStartOnDevice && item.DateTimeEndOnDevice) {
          // Parse the DateTimeStartOnDevice string into a Date object
          const startDate = parse(
            item.DateTimeStartOnDevice.S,
            "yyyy-MM-dd HH:mm:ss SSS",
            new Date()
          );
          const endDate = parse(
            item.DateTimeEndOnDevice.S,
            "yyyy-MM-dd HH:mm:ss SSS",
            new Date()
          );

          // Check if the start date is before the end date
          if (startDate < endDate) {
            // Calculate the difference between the start and end dates in minutes
            const timeTakenInSeconds = differenceInSeconds(endDate, startDate);

            // Add the time taken to the accumulator
            return acc + timeTakenInSeconds;
          }
        }
        // If conditions are not met, return the accumulator without changes
        return acc;
      },
      0
    );

    // Return the time taken in minutes
    return TimeTakenInSeconds;
  };

  const TimeTakenInSeconds = sumUpTimeTaken(dataResultLog);

  // STEP 4: Store Result in Results Table
  // -----------------------------------------------------------------------------------------------------------
  try {
    const ItemParams = {
      TableName: "sbm-user-result",
      Item: {
        UID: { S: UID },
        PID: { S: PID },
        EncodedResult: { S: EncodedResult },
        HintsUsed: { S: HintsUsed },
        TimeTakenInSeconds: { S: TimeTakenInSeconds },
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

//------------------------------------------------------------------------------------------------------------
// sample html
// LOG  Extracted text: {"type":"contentAndHtml","content":"Back to puzzle\nPerfect!\nStrands #169\n“Hear me roar!”\nNice job finding the theme words 🔵
// and Spangram 🟡. You used 0 hints 💡.\nNEXT PUZZLE IN\n14:31:45\nShare Your Results\nPlay Today’s Spelling Bee\n",
// "circleWrapperHtml":"<div class=\"_5Nj5-q_circleWrapper\"><div class=\"_5Nj5-q_circle\" style=\"background-color: var(--yellow);\"></div><div class=\"_5Nj5-q_circle\"
// style=\"background-color: var(--hint-blue);\"></div><div class=\"_5Nj5-q_circle\" style=\"background-color: var(--hint-blue);\"></div><div class=\"_5Nj5-q_circle\"
// style=\"background-color: var(--hint-blue);\"></div><div class=\"_5Nj5-q_circle\" style=\"background-color: var(--hint-blue);\"></div><div class=\"_5Nj5-q_circle\"
// style=\"background-color: var(--hint-blue);\"></div><div class=\"_5Nj5-q_circle\" style=\"background-color: var(--hint-blue);\"></div><div class=\"_5Nj5-q_circle\"
// style=\"background-color: var(--hint-blue);\"></div></div>"}
