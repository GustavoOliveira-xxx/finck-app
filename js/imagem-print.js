window.FinckPrint = (() => {
  // O print vai para a IA como JPEG reduzido. Um print de celular tem de 1 a
  // 4 MB, a Vercel recusa corpo acima de 4,5 MB e o base64 ainda cresce um
  // terço no caminho. Com o lado maior em até 2048 px o texto do preço segue
  // legível para o modelo, e o envio fica na casa das centenas de KB.
  const LADO_MAXIMO = 2048;
  const ALVO_BYTES = 1.5 * 1024 * 1024;
  // O mesmo teto que api/buscar-preco-ia.js aceita.
  const LIMITE_ENVIO_BYTES = 3 * 1024 * 1024;
  // Acima disso nem vale decodificar: é foto de câmera profissional, não print.
  const LIMITE_ARQUIVO_BYTES = 40 * 1024 * 1024;
  const QUALIDADES = [ .85, .72, .6 ];
  const EXTENSOES = /\.(jpe?g|png|webp|heic|heif)$/i;
  const ehImagem = arquivo => Boolean(arquivo) && (/^image\//i.test(arquivo.type || "") || EXTENSOES.test(arquivo.name || ""));
  const ehHeic = arquivo => /^image\/hei[cf]$/i.test(arquivo.type || "") || /\.hei[cf]$/i.test(arquivo.name || "");
  function medidas(largura, altura, lado = LADO_MAXIMO) {
    const maior = Math.max(largura, altura);
    if (!(maior > lado)) {
      return {
        largura: largura,
        altura: altura
      };
    }
    const escala = lado / maior;
    return {
      largura: Math.max(1, Math.round(largura * escala)),
      altura: Math.max(1, Math.round(altura * escala))
    };
  }
  async function decodificar(arquivo) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(arquivo);
      } catch {}
    }
    return new Promise((resolver, rejeitar) => {
      const url = URL.createObjectURL(arquivo);
      const img = new Image;
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolver(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        rejeitar(new Error("imagem ilegível"));
      };
      img.src = url;
    });
  }
  // Arquivo HEIC às vezes chega sem tipo, e o servidor exige o tipo certo.
  const paraDataUrl = (blob, tipo = null) => new Promise((resolver, rejeitar) => {
    const leitor = new FileReader;
    leitor.onload = () => {
      const texto = String(leitor.result || "");
      resolver(tipo ? texto.replace(/^data:[^;,]*/, `data:${tipo}`) : texto);
    };
    leitor.onerror = () => rejeitar(leitor.error || new Error("leitura"));
    leitor.readAsDataURL(blob);
  });
  const paraJpeg = (canvas, qualidade) => new Promise(resolver => canvas.toBlob(resolver, "image/jpeg", qualidade));
  async function preparar(arquivo) {
    if (!ehImagem(arquivo)) {
      throw new Error("Esse arquivo não é uma imagem. Mande um print ou uma foto em JPG, PNG, WEBP ou HEIC.");
    }
    if (arquivo.size > LIMITE_ARQUIVO_BYTES) {
      throw new Error("Imagem grande demais. Recorte só a parte do produto e tente de novo.");
    }
    let imagem;
    try {
      imagem = await decodificar(arquivo);
    } catch {
      // HEIC fora do Safari: o navegador não desenha, mas o Gemini lê o
      // arquivo original. Vai sem miniatura.
      if (ehHeic(arquivo) && arquivo.size <= LIMITE_ENVIO_BYTES) {
        return {
          dataUrl: await paraDataUrl(arquivo, /heif/i.test(arquivo.type || arquivo.name) ? "image/heif" : "image/heic"),
          blob: null,
          largura: null,
          altura: null,
          bytes: arquivo.size
        };
      }
      throw new Error("Não consegui abrir essa imagem. Tente um print em JPG ou PNG.");
    }
    const {largura: largura, altura: altura} = medidas(imagem.naturalWidth || imagem.width, imagem.naturalHeight || imagem.height);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    // PNG com transparência viraria fundo preto no JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(imagem, 0, 0, largura, altura);
    if (typeof imagem.close === "function") {
      imagem.close();
    }
    for (const qualidade of QUALIDADES) {
      const blob = await paraJpeg(canvas, qualidade);
      if (!blob) {
        break;
      }
      const ultima = qualidade === QUALIDADES[QUALIDADES.length - 1];
      if (blob.size <= ALVO_BYTES || ultima && blob.size <= LIMITE_ENVIO_BYTES) {
        return {
          dataUrl: await paraDataUrl(blob),
          blob: blob,
          largura: largura,
          altura: altura,
          bytes: blob.size
        };
      }
    }
    throw new Error("Imagem grande demais. Recorte só a parte do produto e tente de novo.");
  }
  // Colar texto continua sendo colar texto, mesmo quando o Excel ou o Word
  // mandam junto uma imagem da seleção: só vira print a colagem que é só imagem.
  function imagemDaColagem(dados) {
    if (!dados) {
      return null;
    }
    const texto = typeof dados.getData === "function" ? dados.getData("text/plain") : "";
    if (String(texto || "").trim()) {
      return null;
    }
    const item = Array.from(dados.items || []).find(i => i.kind === "file" && /^image\//i.test(i.type || ""));
    if (item) {
      return item.getAsFile();
    }
    return Array.from(dados.files || []).find(ehImagem) || null;
  }
  const temArquivo = dados => Boolean(dados) && Array.from(dados.types || []).includes("Files");
  const imagemDoArraste = dados => Array.from(dados && dados.files || []).find(ehImagem) || null;
  return {
    LADO_MAXIMO: LADO_MAXIMO,
    LIMITE_ENVIO_BYTES: LIMITE_ENVIO_BYTES,
    ehImagem: ehImagem,
    medidas: medidas,
    preparar: preparar,
    imagemDaColagem: imagemDaColagem,
    imagemDoArraste: imagemDoArraste,
    temArquivo: temArquivo
  };
})();
