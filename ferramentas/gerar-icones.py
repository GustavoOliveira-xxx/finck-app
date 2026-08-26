















from PIL import Image, ImageFilter
import math
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(RAIZ, "assets", "logo-ck-512.png")
SAIDA = os.path.join(RAIZ, "assets")






PARADAS = [
    (0.00, (0x33, 0x06, 0x4C)),
    (0.50, (0x68, 0x0C, 0x90)),
    (1.00, (0x93, 0x33, 0xC4)),
]

MESTRE = 1024
ANGULO = 120


def cor_em(t):

    t = max(0.0, min(1.0, t))
    for i in range(len(PARADAS) - 1):
        p0, c0 = PARADAS[i]
        p1, c1 = PARADAS[i + 1]
        if p0 <= t <= p1:
            f = 0 if p1 == p0 else (t - p0) / (p1 - p0)
            return tuple(round(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
    return PARADAS[-1][1]


def fundo(n, angulo=ANGULO):

    rad = math.radians(angulo - 90)
    dx, dy = math.cos(rad), math.sin(rad)

    span = abs(dx) * n + abs(dy) * n
    ox = (n - 1) / 2
    oy = (n - 1) / 2

    tabela = [cor_em(i / 255) for i in range(256)]
    dados = bytearray(n * n * 3)
    i = 0
    for y in range(n):
        py = y - oy
        base = py * dy
        for x in range(n):
            proj = (x - ox) * dx + base
            idx = int((proj / span + 0.5) * 255)
            r, g, b = tabela[0 if idx < 0 else 255 if idx > 255 else idx]
            dados[i] = r
            dados[i + 1] = g
            dados[i + 2] = b
            i += 3

    img = Image.frombytes("RGB", (n, n), bytes(dados)).convert("RGBA")


    brilho = Image.new("L", (n, n), 0)
    raio = int(n * 0.62)
    centro = Image.new("L", (raio * 2, raio * 2), 0)
    for i, a in enumerate(range(raio, 0, -1)):
        v = int(46 * (i / raio) ** 2)
        centro.paste(v, (raio - a, raio - a, raio + a, raio + a))
    centro = centro.filter(ImageFilter.GaussianBlur(raio * 0.35))
    brilho.paste(centro, (int(n * 0.10), int(-n * 0.16)))
    img.alpha_composite(Image.merge("RGBA", (
        Image.new("L", (n, n), 255), Image.new("L", (n, n), 255),
        Image.new("L", (n, n), 255), brilho,
    )))
    return img


def compor(n, ocupacao):

    arte = fundo(n)

    logo = Image.open(LOGO).convert("RGBA")
    bbox = logo.getchannel("A").point(lambda p: 255 if p > 8 else 0).getbbox()
    logo = logo.crop(bbox)

    alvo = int(n * ocupacao)
    escala = min(alvo / logo.width, alvo / logo.height)
    logo = logo.resize(
        (max(1, round(logo.width * escala)), max(1, round(logo.height * escala))),
        Image.LANCZOS,
    )


    sombra = Image.new("RGBA", arte.size, (0, 0, 0, 0))
    silhueta = Image.new("RGBA", logo.size, (0, 0, 0, 90))
    silhueta.putalpha(logo.getchannel("A").point(lambda p: int(p * 0.42)))
    pos = ((n - logo.width) // 2, (n - logo.height) // 2)
    sombra.paste(silhueta, (pos[0], pos[1] + int(n * 0.012)), silhueta)
    sombra = sombra.filter(ImageFilter.GaussianBlur(n * 0.018))
    arte.alpha_composite(sombra)

    arte.alpha_composite(logo, pos)
    return arte


def salvar(img, nome, tamanho):
    caminho = os.path.join(SAIDA, nome)
    img.resize((tamanho, tamanho), Image.LANCZOS).save(caminho, "PNG", optimize=True)
    kb = os.path.getsize(caminho) // 1024
    print(f"  {nome:30} {tamanho}x{tamanho}  {kb} kB")


print("Gerando ícones do FinCK\n")


qualquer = compor(MESTRE, 0.84)
print("purpose any (sem recorte):")
salvar(qualquer, "icone-512.png", 512)
salvar(qualquer, "icone-192.png", 192)



salvar(qualquer, "icone-apple-180.png", 180)



mascara = compor(MESTRE, 0.66)
print("\npurpose maskable (recortado pelo Android):")
salvar(mascara, "icone-maskable-512.png", 512)
salvar(mascara, "icone-maskable-192.png", 192)

print("\nPronto. Os nomes são os mesmos que o HTML já usa —")
print("só os dois 'maskable' são novos e entram no manifest.json.")
