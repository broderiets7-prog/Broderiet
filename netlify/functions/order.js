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

    const productTotal = items.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );

    const deliveryFee = productTotal >= 350 ? 0 : 49;
    const finalTotal = productTotal + deliveryFee;

    const itemList = items
      .map(
        (item) =>
          `<li>${item.name} x${item.qty} — ${item.price * item.qty} kr</li>`
      )
      .join("");

    // 📩 ADMIN MAIL
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
        <ul>${itemList}</ul>

        <p><strong>Varor:</strong> ${productTotal} kr</p>
        <p><strong>Leverans:</strong> ${
          deliveryFee === 0 ? "Fri leverans" : deliveryFee + " kr"
        }</p>
        <p><strong>Totalt:</strong> ${finalTotal} kr</p>
      `,
    });

    // 📧 CUSTOMER MAIL
    const customerPayload = JSON.stringify({
      from: "Bröderiet <order@broderiets.se>",
      to: email,
      subject: "Vi har tagit emot din beställning 🥐",
      html: `
        <div style="margin:0; padding:24px 12px; background:#f6f0e8; font-family: Georgia, serif;">
          <div style="max-width:520px; margin:0 auto; background:#ffffff; padding:24px 20px; border-radius:16px; border:1px solid rgba(0,0,0,0.05); text-align:center;">

            <img src="https://broderiets.se/broderiet.png" style="width:96px; margin-bottom:16px;">

            <h2 style="margin:0 0 12px; font-size:20px; color:#1a1208;">
              Tack för din beställning, ${name}!
            </h2>

            <div style="margin:20px 0; padding:16px; background:#f9f6f1; border-radius:12px; text-align:left;">
              <ul style="padding-left:18px;">
                ${itemList}
              </ul>

              <p><strong>Varor:</strong> ${productTotal} kr</p>
              <p><strong>Leverans:</strong> ${
                deliveryFee === 0 ? "Fri leverans 🎉" : deliveryFee + " kr"
              }</p>
              <p><strong>Totalt:</strong> ${finalTotal} kr</p>
            </div>

            <p style="margin-top:20px;">
              Leveransadress:<br>${address}
            </p>

            <p style="margin-top:20px;">
              Leverans sker mellan 06:00–08:00.
            </p>

            <p style="margin-top:20px;">
              Har du frågor? Svara då på detta mail.
            </p>

            <p style="margin-top:12px;">
              Med vänliga hälsningar,<br>
              <span style="white-space:nowrap;">Bröderiet</span>
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
