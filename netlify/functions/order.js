const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { name, phone, email, items, address } = JSON.parse(event.body);

    if (!name || !phone || !email || !address || !Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const itemList = items
      .map((item) => `<li>${item.name} x${item.qty} — ${item.price * item.qty} kr</li>`)
      .join("");

    const payload = JSON.stringify({
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
        <p><strong>Totalt:</strong> ${total} kr</p>
      `,
    });

    return new Promise((resolve) => {
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
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve({ statusCode: 200, body: "OK" });
            } else {
              resolve({ statusCode: 500, body: `Resend error: ${data}` });
            }
          });
        }
      );

      req.on("error", (e) => resolve({ statusCode: 500, body: e.message }));
      req.write(payload);
      req.end();
    });
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
