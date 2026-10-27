// Monday weekly summary email. Netlify schedules run in UTC: 16:00 is 9am Pacific in summer, 8am in winter.
// The digest itself lives in app/api/cron/digest/route.ts; this only triggers it.
export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/digest`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  console.log(`[weekly-digest] ${res.status} ${await res.text()}`);
};

export const config = { schedule: "0 16 * * 1" };
