import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getMyRole } from "@/lib/profile";
import { getDashboardData } from "@/lib/dashboard/queries";
import { computeYoyInsightFacts } from "@/lib/dashboard/insights";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a financial analyst writing a short year-over-year revenue insight for the owner of a small interior design firm.

You will be given a JSON object of pre-computed statistics. Write 2-4 sentences highlighting the most notable trends: the overall year-over-year change, which category (Residential/Commercial/Furniture) is trending up or down, the single biggest month-over-month swing and what drove it if a referral source is identified, and any notable upcoming forecast concentration.

Rules:
- Use ONLY the numbers and facts present in the JSON. Never invent, estimate, or infer a figure that is not explicitly given.
- If a field is null, simply omit that point rather than guessing at it.
- Write dollar amounts like $33,000 or $1.2M — no decimals for amounts under $1M.
- Plain prose, no markdown, no bullet points, no headers.
- Professional but direct tone, like a colleague giving a quick read of the numbers, not a formal report.`;

export async function GET() {
  const role = await getMyRole();
  if (role !== "owner" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Insights are not configured." }, { status: 503 });
  }

  const data = await getDashboardData();
  const currentYear = new Date().getFullYear();
  const facts = computeYoyInsightFacts(data, currentYear);

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(facts) }],
  });

  if (response.stop_reason === "refusal") {
    return NextResponse.json({ error: "Could not generate insights." }, { status: 502 });
  }

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  return NextResponse.json({ text });
}
