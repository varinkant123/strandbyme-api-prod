import { differenceInDays } from "date-fns";

// -----------------------------------------------------------------------------------------------------------------------
// this function returns the puzzle id which is in alignment with the nytimes strand id count
// based on the date found on local device. Note it uses the date and time of 22/8/24 being Strands ID 161 as the starting
// point
export const getPIDOnDevice = () => {
  const currentDateTime = new Date();
  const startDateTime = new Date();
  const diffInDays = differenceInDays(currentDateTime, startDateTime);

  const PIDNumber = diffInDays + 161;
  const PIDNumberPadded = PIDNumber.toString().padStart(5, "0");
  const PIDFormatted = `S${PIDNumberPadded}`;

  return PIDFormatted;
};
