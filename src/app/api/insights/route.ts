import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getMyRole } from "@/lib/profile";
import { getDashboardData } from "@/lib/dashboard/queries";
import { computeYoyInsightFacts } from "@/lib/dashboard/insights";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a financial analyst writing a short year-over-year revenue insight for the owner of a small interior design firm.

You will be given a JSON object of pre-computed statistics. Write a short bullet list (one line each, starting with "- ") covering:
1. The overall year-over-year change (currentYearTotal vs priorYearTotal).
2. Which category (Residential/Commercial/Furniture) is trending up or down most notably, using categoryTrends.
3. The single biggest month-over-month swing (biggestSwing) and what drove it if a referral source is identified.
4. How much revenue is still outstanding/unpaid in total, using totalOutstanding — phrase this as money still left to be collected.
5. The monthly distribution of that outstanding (forecasted) income for the current year, using currentYearForecastByMonth — list the months with amounts, e.g. "Aug $12,000, Sep $8,400, ...".
6. Any notable forecast concentration worth flagging as a risk, using biggestForecastMonth (only if it stands out — skip if bullet 5 already covers it well).

Rules:
- Use ONLY the numbers and facts present in the JSON. Never invent, estimate, or infer a figure that is not explicitly given.
- If a field is null or empty, omit that bullet rather than guessing at it.
- Write dollar amounts like $33,000 or $1.2M — no decimals for amounts under $1M.
- Each bullet is a single line of plain text starting with "- ". No sub-bullets, no headers, no bold/markdown emphasis.
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
  try {
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
  } catch (err) {
    // Previously unhandled — a bad/expired key or an account-level issue
    // (no credits, no model access) surfaced as a bare 500 with no way to
    // tell which. Surfacing the real message here so it's diagnosable
    // without needing Vercel's function logs.
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Anthropic API call failed: ${message}` }, { status: 502 });
  }
}
