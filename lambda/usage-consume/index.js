const { client, TABLES, GetCommand, PutCommand } = require('../shared/dynamo');
const { userIdFrom, json } = require('../shared/auth');
const { getActiveTier } = require('../shared/billing');
const { quotaFor } = require('../shared/tiers');

function monthKeyOf(date) {
  return date.toISOString().slice(0, 7); // YYYY-MM, UTC — matches TIERS.txt's reset-on-the-1st-UTC note
}
function dayKeyOf(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

/* POST /usage/consume — called by the desktop app right before it sends a
   question to Groq. This is the actual enforcement of the "queries per
   month / per day" limits in TIERS.txt; nothing else in the codebase
   tracks or caps query volume. One row per user in spark-usage, reset in
   place whenever the calendar month or day rolls over (no cron needed —
   the reset happens lazily on the next call after the boundary). */
exports.handler = async (event) => {
  try {
    const userId = userIdFrom(event);
    const tier = await getActiveTier(client, TABLES, GetCommand, userId);
    const quota = quotaFor(tier);

    const now = new Date();
    const monthKey = monthKeyOf(now);
    const dayKey = dayKeyOf(now);

    const existing = await client.send(
      new GetCommand({ TableName: TABLES.usage, Key: { user_id: userId } })
    );
    const row = existing.Item || { user_id: userId };

    const queriesMonth = row.month_key === monthKey ? row.queries_month || 0 : 0;
    const queriesDay = row.day_key === dayKey ? row.queries_day || 0 : 0;

    const overMonthly = quota.queriesPerMonth !== null && queriesMonth >= quota.queriesPerMonth;
    const overDaily = quota.queriesPerDay !== null && queriesDay >= quota.queriesPerDay;

    if (overMonthly || overDaily) {
      // Persist the reset (if a boundary was just crossed) even on a denial,
      // so a FREE user who hits the daily cap on day N doesn't get a fresh
      // "0 used" reported next call before the day actually rolls over.
      await client.send(
        new PutCommand({
          TableName: TABLES.usage,
          Item: { user_id: userId, month_key: monthKey, queries_month: queriesMonth, day_key: dayKey, queries_day: queriesDay },
        })
      );
      return json(200, {
        allowed: false,
        reason: overMonthly ? 'monthly' : 'daily',
        tier,
        queriesMonth,
        queriesDay,
        limitMonth: quota.queriesPerMonth,
        limitDay: quota.queriesPerDay,
      });
    }

    const nextMonth = queriesMonth + 1;
    const nextDay = queriesDay + 1;
    await client.send(
      new PutCommand({
        TableName: TABLES.usage,
        Item: { user_id: userId, month_key: monthKey, queries_month: nextMonth, day_key: dayKey, queries_day: nextDay },
      })
    );

    return json(200, {
      allowed: true,
      tier,
      queriesMonth: nextMonth,
      queriesDay: nextDay,
      limitMonth: quota.queriesPerMonth,
      limitDay: quota.queriesPerDay,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message });
  }
};
