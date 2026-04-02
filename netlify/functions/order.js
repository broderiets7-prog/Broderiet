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
            resolve({ ok: true });
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
    const { name, phone, email, items, address, deliveryTime } = JSON.parse(event.body);

    if (
      !name ||
      !phone ||
      !email ||
      !address ||
      !deliveryTime ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    const productTotal = items.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );

    const deliveryFee = productTotal >= 350 ? 0 : 49;
    const finalTotal = productTotal + deliveryFee;

    const itemListAdmin = items
      .map(
        (item) =>
          `<li>${item.name} x${item.qty} — ${item.price * item.qty} kr</li>`
      )
      .join("");

    const itemListCustomer = items
      .map(
        (item) => `
          <tr>
            <td style="padding: 8px 0; font-size: 15px; color: #2a1a0f;">
              ${item.name}
            </td>
            <td style="padding: 8px 0; font-size: 15px; color: #5c4b3b; text-align: center;">
              x${item.qty}
            </td>
            <td style="padding: 8px 0; font-size: 15px; color: #2a1a0f; text-align: right;">
              ${item.price * item.qty} kr
            </td>
          </tr>
        `
      )
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
        <p><strong>Önskad leveranstid:</strong> ungefär kl. ${deliveryTime}</p>

        <h3>Produkter:</h3>
        <ul>${itemListAdmin}</ul>

        <p><strong>Varor:</strong> ${productTotal} kr</p>
        <p><strong>Leverans:</strong> ${deliveryFee === 0 ? "Fri leverans" : `${deliveryFee} kr`}</p>
        <p><strong>Totalt:</strong> ${finalTotal} kr</p>
      `,
    });

    const customerPayload = JSON.stringify({
      from: "Bröderiet <order@broderiets.se>",
      to: email,
      subject: "Vi har tagit emot din beställning 🥐",
      html: `
        <div style="margin:0; padding:32px 14px; background:#f6f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid rgba(26,18,8,0.06); border-radius:18px; overflow:hidden;">

            <div style="padding:28px 28px 22px; text-align:center; border-bottom:1px solid rgba(26,18,8,0.06); background:#fbf8f4;">
              <img src="https://broderiets.se/broderiet.png" alt="Bröderiet" style="width:88px; margin:0 auto 14px; display:block;">
              <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7968;">
                Orderbekräftelse
              </p>
              <h1 style="margin:0; font-size:28px; line-height:1.2; font-weight:600; color:#1a1208;">
                Vi har tagit emot din beställning 🥐
              </h1>
              <p style="margin:12px 0 0; font-size:16px; line-height:1.6; color:#5c4b3b;">
                Hej ${name}, vi börjar förbereda din beställning direkt.
              </p>
            </div>

            <div style="padding:28px;">
              <div style="margin-bottom:24px; padding:18px 18px; background:#f9f6f1; border-radius:14px;">
                <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#8a7968;">
                  Leverans
                </p>
                <p style="margin:0; font-size:16px; line-height:1.7; color:#2a1a0f;">
                  Tack för din beställning.<br>
                  Vi levererar ditt bröd ungefär kl. ${deliveryTime}.
                </p>
              </div>

              <div style="margin-bottom:24px;">
                <p style="margin:0 0 14px; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#8a7968;">
                  Din beställning
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  ${itemListCustomer}
                </table>

                <div style="margin-top:16px; padding-top:16px; border-top:1px solid rgba(26,18,8,0.08);">
                  <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:15px; color:#5c4b3b;">Varor:</span>
                    <span style="font-size:15px; color:#2a1a0f;">${productTotal} kr</span>
                  </div>

                  <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:15px; color:#5c4b3b;">Leverans:</span>
                    <span style="font-size:15px; color:#2a1a0f;">
                      ${
                        deliveryFee === 0
                          ? "Fri leverans"
                          : `${deliveryFee} kr`
                      }
                    </span>
                  </div>

                  <div style="display:flex; justify-content:space-between; margin-top:12px; padding-top:12px; border-top:1px solid rgba(26,18,8,0.08);">
                    <span style="font-size:17px; font-weight:600; color:#1a1208;">Totalt:</span>
                    <span style="font-size:17px; font-weight:600; color:#1a1208;">${finalTotal} kr</span>
                  </div>
                </div>
              </div>

              <div style="margin-bottom:24px; padding:18px 18px; background:#fcfaf7; border:1px solid rgba(26,18,8,0.06); border-radius:14px;">
                <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#8a7968;">
                  Leveransadress
                </p>
                <p style="margin:0; font-size:16px; line-height:1.6; color:#2a1a0f;">
                  ${address}
                </p>
              </div>

              ${
                deliveryFee === 0
                  ? `
                <div style="margin-bottom:24px; padding:14px 16px; background:#eef6ee; border:1px solid rgba(47,125,50,0.12); border-radius:14px; text-align:center;">
                  <p style="margin:0; font-size:14px; line-height:1.6; color:#2f7d32; font-weight:600;">
                    Du har fri leverans på denna beställning.
                  </p>
                </div>
              `
                  : `
                <div style="margin-bottom:24px; padding:14px 16px; background:#f9f6f1; border-radius:14px; text-align:center;">
                  <p style="margin:0; font-size:14px; line-height:1.6; color:#5c4b3b;">
                    Leveransavgift 49 kr tillkommer på beställningar under 350 kr.
                  </p>
                </div>
              `
              }

              <p style="margin:0; font-size:15px; line-height:1.7; color:#5c4b3b; text-align:center;">
                Har du frågor? Svara då på detta mail.
              </p>
            </div>

            <div style="padding:18px 28px 26px; text-align:center; border-top:1px solid rgba(26,18,8,0.06); background:#fbf8f4;">
              <p style="margin:0; font-size:14px; line-height:1.6; color:#1a1208; font-weight:500;">
                Bröderiet
              </p>
              <p style="margin:4px 0 0; font-size:13px; line-height:1.6; color:#8a7968;">
                Hantverksbageri
              </p>
            </div>

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
