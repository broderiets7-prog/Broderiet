const https = require("https");

function sendEmail(payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve({ ok: true, data });
          } else {
            reject(new Error(`Resend error: ${data}`));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { name, phone, email, items, address } = JSON.parse(event.body);

    if (
      !name ||
      !phone ||
      !email ||
      !address ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    const itemListAdmin = items
      .map((item) => `<li>${item.name} x${item.qty} — ${item.price * item.qty} kr</li>`)
      .join("");

    const itemListCustomer = items
      .map((item) => `<li style="margin-bottom:6px;">${item.name} x${item.qty} — ${item.price * item.qty} kr</li>`)
      .join("");

    const adminPayload = JSON.stringify({
      from: "Bröderiet <order@broderiets.se>",
      to: "order@broderiets.se",
      subject: `Ny beställning från ${name}`,
      html: `
        <h2>Ny beställning</h2>
        <p><strong>Namn:</strong> ${name}</p>
        <p><strong>Telefon:</strong> ${phone}</p>
        <p><strong>Mailadress:</strong> ${email}</p>
        <p><strong>Adress:</strong> ${address}</p>
        <h3>Produkter:</h3>
        <ul>${itemListAdmin}</ul>
        <p><strong>Totalt:</strong> ${total} kr</p>
      `,
    });

    const customerPayload = JSON.stringify({
      from: "Bröderiet <order@broderiets.se>",
      to: email,
      subject: "Vi har tagit emot din beställning 🥐",
      html: `
        <div style="font-family: Georgia, serif; background:#f6f0e8; padding:40px 20px;">
          <div style="max-width:520px; margin:0 auto; background:#ffffff; padding:32px 28px; border-radius:16px; border:1px solid rgba(0,0,0,0.05); text-align:center;">

            <img src="https://broderiets.se/broderiet.png" alt="Bröderiet" style="width:110px; margin-bottom:20px;">

            <h2 style="margin:0 0 16px; font-size:22px; color:#1a1208;">
              Tack för din beställning, ${name}!
            </h2>

            <p style="margin:0 0 18px; font-size:15px; line-height:1.6; color:#3a2e1e;">
              Vi har tagit emot din beställning och börjar förbereda den direkt.
            </p>

            <div style="margin:24px 0; padding:18px; background:#f9f6f1; border-radius:12px; text-align:left;">
              <h3 style="margin:0 0 12px; font-size:15px; letter-spacing:0.05em; text-transform:uppercase; color:#6f655b;">
                Din beställning
              </h3>

              <ul style="padding-left:18px; margin:0 0 12px; color:#2a1a0f;">
                ${itemListCustomer}
              </ul>

              <p style="margin:8px 0 0; font-size:15px; color:#1a1208;">
                <strong>Totalt:</strong> ${total} kr
              </p>
            </div>

            <div style="margin:20px 0; text-align:left;">
              <p style="margin:0; font-size:14px; color:#3a2e1e;">
                <strong>Leveransadress:</strong><br>
                ${address}
              </p>
            </div>

            <div style="margin:24px 0; padding:16px; background:#f3efe9; border-radius:12px;">
              <p style="margin:0; font-size:14px; line-height:1.6; color:#3a2e1e;">
                Leverans sker inom Kalmar.<br>
                Beställ senast kl. 18:00 för leverans mellan 06:00–08:00.
              </p>
            </div>

            <p style="margin:24px 0 0; font-size:14px; color:#5a4a39;">
              Har du frågor? Svara på detta mail eller kontakta oss direkt.
            </p>

            <p style="margin:12px 0 0; font-size:14px; color:#1a1208;">
              / Bröderiet
            </p>

          </div>
        </div>
      `,
    });

    await sendEmail(adminPayload);
    await sendEmail(customerPayload);

    return { statusCode: 200, body: "OK" };
  } catch (error) {
    return {
      statusCode: 500,
      body: error.message || "Something went wrong",
    };
  }
};
