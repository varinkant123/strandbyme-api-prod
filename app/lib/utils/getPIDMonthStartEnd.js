import { endOfMonth, startOfMonth, parse, format, differenceInDays } from "date-fns";

// -----------------------------------------------------------------------------------------------------------------------
// this function returns the puzzle id for start and end  which is in alignment with the nytimes strand id count
// based on the date of year month provided. Note it uses the date and time of 22/8/24 being Strands ID 161 as the starting
// point. only need to return integer, strand id constructed inside of function
const getPIDMonthStartEnd = (DateYearMonth) => {
  // note dateyearmonth is format yyyy-mm
  // use 22/8/24 mapping to 161 as the datum determine difference in days and then add to 161 to determine min and max
  // for the month which would represent the 1st and last day of a given month using date-fns functions
  const ReferenceDate = parse("2024-09-22", "yyyy-MM-dd", new Date());
  const ReferencePID = 203;

  const startDate = startOfMonth(parse(DateYearMonth, "yyyyMM", new Date()));
  const endDate = endOfMonth(startDate);

  const startDateDiffDays = differenceInDays(startDate, ReferenceDate);
  const endDateDiffDays = differenceInDays(endDate, ReferenceDate);
  const PIDStart = ReferencePID + startDateDiffDays;
  const PIDEnd = ReferencePID + endDateDiffDays;

  return {
    PIDStart: PIDStart,
    PIDEnd: PIDEnd,
  };
};

export default getPIDMonthStartEnd;
