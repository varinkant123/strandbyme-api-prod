import { format, toZonedTime } from "date-fns-tz";

export default function getAESTTime() {
  // Get the current date/time in UTC
  const now = new Date();

  // Specify the time zone you want to convert to
  const timeZone = "Australia/Sydney"; // AEST

  // Convert the current date/time to AEST
  const aestTime = toZonedTime(now, timeZone);

  // Format the time in your desired format
  const formattedAESTTime = format(aestTime, "yyyy-MM-dd HH:mm:ss");

  return formattedAESTTime;
}
