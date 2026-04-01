const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { name, phone, items, address } = JSON.parse(event.body);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemList = items.map(i => `<li>${i.name} x${i.qty} — ${i.price * i.qty} kr</li>`).join("");

  const payload = JSON.stringify({
    from: "Bröderiet <order@broderiets.se>",
    to: "jusuf.jobb@gmail.com",
    subject: `Ny beställning från ${name}`,
    html: `
      <h2>Ny beställning</h2>
      <p><strong>Namn:</strong> ${name}</p>
      <p><strong>Telefon:</strong> ${phone}</p>
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
};
