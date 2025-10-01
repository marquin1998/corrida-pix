import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { nome, email, valor } = req.body;

  if (!nome || !email || !valor) {
    return res.status(400).json({ error: "Dados incompletos" });
  }

  try {
    // 1. Pega token OAuth da Gerencianet
    const credentials = Buffer.from(
      `${process.env.GN_CLIENT_ID}:${process.env.GN_CLIENT_SECRET}`
    ).toString("base64");

    const authResponse = await fetch("https://api-pix.gerencianet.com.br/oauth/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ grant_type: "client_credentials" })
    });

    const { access_token } = await authResponse.json();

    // 2. Cria cobrança Pix
    const txid = "cdm" + Date.now(); // ID único por cobrança
    const chargeResponse = await fetch(`https://api-pix.gerencianet.com.br/v2/cob/${txid}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        calendario: { expiracao: 3600 }, // 1h para pagar
        devedor: { nome, email },
        valor: { original: valor.toFixed(2) },
        chave: process.env.GN_PIX_KEY, // sua chave Pix
        solicitacaoPagador: "Pagamento inscrição Corrida de La Muertos"
      })
    });

    const charge = await chargeResponse.json();

    // 3. Gera QR Code
    const qrcodeResponse = await fetch("https://api-pix.gerencianet.com.br/v2/gn/qr", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: charge.loc.id })
    });

    const qrcode = await qrcodeResponse.json();

    return res.status(200).json({
      status: "success",
      txid,
      valor,
      qrcode: qrcode.qrcode,
      copiaecola: qrcode.qrCode
    });

  } catch (error) {
    console.error("Erro Pix:", error);
    return res.status(500).json({ error: "Falha ao gerar Pix" });
  }
}
