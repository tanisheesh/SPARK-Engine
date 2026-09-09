/* Shared by billing-verify-payment and billing-webhook (both need to compute
   the same next-period-end from the same starting point) and by
   billing-status (which needs to know when a period is over). Previously
   duplicated in both writers with a naive `setMonth(getMonth()+1)`, which
   overflows on month-end dates (Jan 31 -> Mar 3, not Feb 28/29). */

function addCycle(date, cycle) {
  const d = new Date(date);
  const months = cycle === 'yearly' ? 12 : 1;
  const day = d.getDate();

  d.setDate(1); // park on the 1st so setMonth can't overflow past the target month
  d.setMonth(d.getMonth() + months);

  const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInTargetMonth));

  return d.toISOString();
}

function isExpired(currentPeriodEnd) {
  return !currentPeriodEnd || Date.now() > new Date(currentPeriodEnd).getTime();
}

module.exports = { addCycle, isExpired };
