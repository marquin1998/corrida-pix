// api/pix.js
import fetch from "node-fetch"; // ok em Vercel; se der ruim, remova essa linha (Node 18 tem fetch global)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // em produção prefira colocar apenas seu domínio
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

export default async function handler(req, res) {
  // Responder preflight OPTIONS
  if (req.method === "OPTIONS") {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  // Adiciona CORS em todas as respostas
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // GET de teste para confirmar que a rota está acessível
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "API pix funcionando" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Validação mínima
  const { nome, email, valor } = req.body || {};
  if (!nome || !email || !valor) {
    return res.status(400).json({ error: "Dados incompletos (nome, email, valor)" });
  }

  // Verifica variáveis de ambiente
  if (!process.env.GN_CLIENT_ID || !process.env.GN_CLIENT_SECRET || !process.env.GN_PIX_KEY) {
    return res.status(500).json({ error: "Variáveis de ambiente Gerencianet não configuradas" });
  }

  try {
    // -- Autenticação Gerencianet (exemplo) --
    const credentials = Buffer.from(`${process.env.GN_CLIENT_ID}:${process.env.GN_CLIENT_SECRET}`).toString("base64");
    const authResp = await fetch("https://api-pix.gerencianet.com.br/oauth/token", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials" })
    });
    if (!authResp.ok) {
      const t = await authResp.text();
      throw new Error("Auth falhou: " + t);
    }
    const authJson = await authResp.json();
    const accessToken = authJson.access_token;

    // Exemplo: criar cobrança (ajuste conforme API atual da Gerencianet)
    const txid = "cdm" + Date.now();
    const createResp = await fetch(`https://api-pix.gerencianet.com.br/v2/cob/${txid}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        calendario: { expiracao: 3600 },
        devedor: { nome, email },
        valor: { original: Number(valor).toFixed(2) },
        chave: process.env.GN_PIX_KEY,
        solicitacaoPagador: `Inscrição Corrida de La Muertos - ${nome}`
      })
    });

    if (!createResp.ok) {
      const t = await createResp.text();
      throw new Error("Criar cobrança falhou: " + t);
    }
    const createJson = await createResp.json();

    // Gera QRCode
    const qrResp = await fetch("https://api-pix.gerencianet.com.br/v2/gn/qr", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: createJson.loc.id })
    });

    if (!qrResp.ok) {
      const t = await qrResp.text();
      throw new Error("Gerar QR falhou: " + t);
    }
    const qrJson = await qrResp.json();

    return res.status(200).json({
      status: "success",
      txid,
      valor,
      qrcode: qrJson.qrcode,
      copiaecola: qrJson.qrCode || qrJson.copiaecola || qrJson.qr
    });
  } catch (err) {
    console.error("Erro Pix (server):", err.message || err);
    return res.status(500).json({ error: "Falha ao gerar Pix", details: String(err.message || err) });
  }
}
