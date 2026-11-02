// api/lead.js

module.exports = async function handler(req, res) {
  const allowedOrigin = "https://raihana1mran.github.io";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  if (req.headers.origin && req.headers.origin !== allowedOrigin) {
    return res.status(403).json({ success: false, message: "Request not allowed." });
  }

  try {
    const {
      SF_MY_DOMAIN_URL,
      SF_CLIENT_ID,
      SF_CLIENT_SECRET,
      SF_API_VERSION
    } = process.env;

    if (!SF_MY_DOMAIN_URL || !SF_CLIENT_ID || !SF_CLIENT_SECRET || !SF_API_VERSION) {
      return res.status(500).json({
        success: false,
        message: "Server configuration is incomplete."
      });
    }

    const domain = SF_MY_DOMAIN_URL.replace(/\/+$/, "");

    if (!domain.startsWith("https://")) {
      return res.status(500).json({
        success: false,
        message: "Invalid Salesforce domain configuration."
      });
    }

    const data = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    if (!data || data.action !== "enquiry") {
      return res.status(400).json({
        success: false,
        message: "Invalid request."
      });
    }

    // Honeypot field: reject submissions from basic bots.
    if (data.website) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission."
      });
    }

    const clean = (value, max = 200) =>
      typeof value === "string" ? value.trim().slice(0, max) : "";

    const name = clean(data.name, 100);
    const phone = clean(data.phone, 30);
    const email = clean(data.email, 254);
    const service = clean(data.service, 150);
    const branch = clean(data.branch, 150);
    const preferredDate = clean(data.preferredDate, 20);
    const preferredTime = clean(data.preferredTime, 30);

    if (!name || !phone || !service || !branch || !preferredTime) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields."
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address."
      });
    }

    if (preferredDate && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid preferred date."
      });
    }

    const nameParts = name.split(/\s+/);
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");

    // Obtain a Salesforce access token.
    const tokenResponse = await fetch(
      `${domain}/services/oauth2/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: SF_CLIENT_ID,
          client_secret: SF_CLIENT_SECRET
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(502).json({
        success: false,
        message: "Could not connect to Salesforce. Please try again later."
      });
    }

    // Create a Lead for the appointment request.
    const lead = {
      FirstName: firstName || undefined,
      LastName: lastName,
      Company: "Zaara Dentistry Website",
      Phone: phone,
      Email: email || undefined,
      LeadSource: "Web",
      Description: [
        "Website appointment request",
        `Service: ${service}`,
        `Branch: ${branch}`,
        `Preferred Date: ${preferredDate || "Not specified"}`,
        `Preferred Time: ${preferredTime}`,
        "Status: Awaiting clinic confirmation.",
        "The clinic must contact the requester to confirm the appointment."
      ].join("\n")
    };

    const salesforceUrl =
      `${tokenData.instance_url || domain}/services/data/${SF_API_VERSION}/sobjects/Lead/`;

    const leadResponse = await fetch(salesforceUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(lead)
    });

    const leadResult = await leadResponse.json();

    if (!leadResponse.ok || !leadResult.success) {
      return res.status(502).json({
        success: false,
        message: "Your request could not be saved. Please contact the clinic."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Your appointment request has been received. Our team will contact you to confirm."
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later."
    });
  }
};
