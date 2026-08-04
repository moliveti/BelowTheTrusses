import dotenv from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STATES: [string, string][] = [
  ["Azar_Kennesaw/Acworth", "FL"],
  ["Azar_McDonough", "FL"],
  ["Azar_New Peachtree", "FL"],
  ["Azar_Sturbridge", "FL"],
  ["Azar_Yalda", "FL"],
  ["Baulder", "FL"],
  ["Bennett", "FL"],
  ["Bethany Primitive Baptist Church", "FL"],
  ["C. Keheley", "FL"],
  ["Chadwick", "FL"],
  ["COE__LT Gov Suite", "FL"],
  ["COE_ABS", "FL"],
  ["COE_Agriculture Building", "FL"],
  ["COE_Calhoun", "FL"],
  ["COE_Capital Suites", "FL"],
  ["COE_Carroll County Admin", "FL"],
  ["COE_Carroll County Conference/ Admin", "FL"],
  ["COE_Carroll County Courthouse", "FL"],
  ["COE_Danielle Stanley-Phi Mu — Commercial", "FL"],
  ["COE_Danielle Stanley-Phi Mu — Furniture", "FL"],
  ["COE_DNR", "FL"],
  ["COE_Douglas County", "FL"],
  ["COE_Furniture Commisions", "FL"],
  ["COE_GA Capital Reno — Commercial", "FL"],
  ["COE_GA Capital Reno — Furniture", "FL"],
  ["COE_GBA Law", "FL"],
  ["COE_GBA Patrol Post", "FL"],
  ["COE_Helicopter Hangar", "FL"],
  ["COE_House Clerk", "FL"],
  ["COE_InfraMetals", "FL"],
  ["COE_Janus Intern.", "FL"],
  ["COE_Legislative Building", "FL"],
  ["COE_Mens Prison", "FL"],
  ["COE_Nathan Deal Judicial", "FL"],
  ["COE_Powder Springs", "FL"],
  ["COE_Silvey Office", "FL"],
  ["COE_SouthWire", "FL"],
  ["COE_Stanley_Williams PR", "FL"],
  ["COE_Veteran Affairs", "FL"],
  ["COE_WGTC Murphy", "FL"],
  ["COE_WGTC Student Affairs", "FL"],
  ["COEC_GBA Swing Space", "FL"],
  ["COEC_SMI", "FL"],
  ["COEC_TipTop Poultry", "FL"],
  ["COEC_UES Norross Engineering", "FL"],
  ["COEC_Westbrook Christian Media Center", "FL"],
  ["Commission", "FL"],
  ["Cyr, Austin", "FL"],
  ["Dantzler Ulvi", "FL"],
  ["Dantzler_Brodsky", "FL"],
  ["Dantzler_Fleet Landing", "FL"],
  ["Danztler_Spanish Point", "FL"],
  ["Duchausee, Garnet", "FL"],
  ["Focus Design Group_Horizon", "Bahamas"],
  ["Frank & Cindy Cyr", "FL"],
  ["Genners", "FL"],
  ["Haghani", "GA"],
  ["Hayes", "FL"],
  ["Hersey", "GA"],
  ["Ingram", "NC"],
  ["Jeff Paciolla", "FL"],
  ["Katz_Fletcher", "FL"],
  ["Kelli Marsh", "FL"],
  ["Krusing", "FL"],
  ["Mckinney, Maureen", "FL"],
  ["Melissa Strumlauf", "FL"],
  ["Monroe", "FL"],
  ["Parker Davis", "FL"],
  ["Rebecca Livingston", "FL"],
  ["Rebekkah Heafer", "FL"],
  ["Reddy Wang", "GA"],
  ["Rose Lickenbrock", "FL"],
  ["Seeley", "FL"],
  ["Sheryn Lobrano", "FL"],
  ["Smart Interior Group", "FL"],
  ["Smart_BOMA Monarch", "FL"],
  ["Spears, Nick", "FL"],
  ["Terry, Kit", "FL"],
  ["Thompson", "FL"],
  ["Wallace", "FL"],
  ["Yang", "FL"],
];

async function main() {
  let updated = 0;
  let missing: string[] = [];
  for (const [name, state] of STATES) {
    const { data, error } = await supabase
      .from("projects")
      .update({ state })
      .eq("name", name)
      .select("id");
    if (error) throw new Error(`${name}: ${error.message}`);
    if (!data || data.length === 0) missing.push(name);
    else updated += data.length;
  }
  console.log(`Updated ${updated} projects.`);
  if (missing.length) {
    console.log("No matching project found for:");
    missing.forEach((m) => console.log(`  - ${m}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
