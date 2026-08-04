import { getDatabaseHealth } from "@/lib/db/articles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const health = await getDatabaseHealth();

    return Response.json(
      {
        status: "ok",
        database: "ok",
        publishedArticles: health.publishedArticles,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] 数据库健康检查失败", error);

    return Response.json(
      { status: "error", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
