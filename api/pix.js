export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { nome, email, valor } = req.body;

  // Aqui você chamaria a API da Gerencianet com sua chave Pix
  // Exemplo de resposta fake para teste
  return res.status(200).json({
    status: "success",
    qrcode: "qrcode_fake_para_teste",
    copiaecola: "00020101021226890014BR.GOV.BCB.PIX..."
  });
}
