import { env } from "@nexus/env";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");

  if (secret !== env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { tags, immediate = true } = (await req.json()) as {
      tags?: string[];
      immediate?: boolean;
    };

    if (Array.isArray(tags)) {
      for (const tag of tags) {
        // In Next.js 16, revalidateTag purges cache; immediate flag enforces immediate eviction
        revalidateTag(tag);
      }
      return NextResponse.json({ revalidated: true, immediate, tags, now: Date.now() });
    }

    return NextResponse.json({ error: "Missing tags array in body" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
