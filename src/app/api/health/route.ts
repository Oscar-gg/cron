import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [users, crons] = await Promise.all([
    db.user.count(),
    db.apiCall.count(),
  ]);

  return Response.json({
    status: "ok",
    users,
    crons,
    timestamp: new Date().toISOString(),
  });
}
