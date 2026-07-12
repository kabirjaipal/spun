import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory"
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const gstin = searchParams.get("gstin")?.toUpperCase().trim();

  if (!gstin) {
    return NextResponse.json({ error: "GSTIN parameter is required" }, { status: 400 });
  }

  // Basic validation of Indian GSTIN format
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
  if (!gstinRegex.test(gstin)) {
    return NextResponse.json({ error: "Invalid GSTIN format" }, { status: 400 });
  }

  const apiKey = process.env.GSTINCHECK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "GSTINCHECK_API_KEY is not configured in your environment variables. Please add it to your .env file."
    }, { status: 400 });
  }

  try {
    const res = await fetch(`https://sheet.gstincheck.co.in/check/${apiKey}/${gstin}`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `External API responded with status ${res.status}` }, { status: res.status });
    }

    const json = await res.json();

    if (!json || json.flag === false) {
      return NextResponse.json({ error: json?.message || "GSTIN lookup failed or key is invalid" }, { status: 400 });
    }

    const data = json.data;
    const stateCode = gstin.substring(0, 2);
    const state = STATE_CODES[stateCode] || "";
    const pan = gstin.substring(2, 12);

    // Parse Address fields from pradr
    const pradr = data.pradr || {};
    const addr = pradr.addr || {};

    let fullAddress = "";
    if (pradr.adr) {
      fullAddress = pradr.adr.replace(/,\s*,+/g, ",").replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();
      // Remove leading/trailing commas if any
      fullAddress = fullAddress.replace(/^,|,$/g, "").trim();
    }

    if (!fullAddress) {
      const parts = [
        addr.flno,
        addr.bnm,
        addr.bno,
        addr.st,
        addr.loc,
        addr.dst,
        state,
        addr.pncd
      ].filter((val) => val && val.trim().length > 0);
      fullAddress = parts.join(", ");
    }

    const city = addr.city || addr.dst || "";
    const pincode = addr.pncd || "";

    // Normalize gstType: regular / composition / unregistered
    let gstType = "regular";
    const rawDty = (data.dty || "").toLowerCase();
    if (rawDty.includes("composition")) {
      gstType = "composition";
    } else if (rawDty.includes("unregistered")) {
      gstType = "unregistered";
    }

    return NextResponse.json({
      success: true,
      data: {
        gstin,
        companyName: data.tradeNam || data.lgnm || "",
        panNo: pan,
        stateCode,
        state,
        city,
        address: fullAddress,
        pincode,
        gstType
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch GST details" }, { status: 500 });
  }
}
