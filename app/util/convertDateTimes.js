exports.convertScheduleDateTime = (timeStr) => {
  const [time, period] = timeStr.split(/[: ]/);
  let [hours, minutes] = time.split(":");

  if (!minutes) {
    minutes = "00";
  }

  hours = parseInt(hours);
  if (period.toLowerCase() === "pm" && hours < 12) hours += 12;
  if (period.toLowerCase() === "am" && hours === 12) hours -= 12;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
};
