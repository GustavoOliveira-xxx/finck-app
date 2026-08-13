"""
Gera uma arte provisória para a cena 3D de Metas (assets/meta-3d.png).

Isto é um substituto: um pódio isométrico de três degraus com bandeira, sobre
uma base circular. Serve para a cena ficar completa enquanto a arte definitiva
não entra.

    python3 ferramentas/gerar-arte-metas.py

Para trocar pela arte final, basta salvar o PNG por cima — mesmo nome, fundo
transparente, quadrado, de preferência 1024x1024. Nada no código muda.
"""

from PIL import Image, ImageDraw, ImageFilter
import os

N = 1024
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "assets", "meta-3d.png")

ROXO_ESCURO = (36, 10, 54)
ROXO = (104, 12, 144)
ROXO_CLARO = (147, 51, 196)
ROXO_NEON = (180, 92, 240)
AMARELO = (254, 200, 0)
GRAFITE = (28, 24, 38)
PRATA = (150, 145, 168)


def losango(d, cx, cy, rx, ry, cor):
    """Face de topo em perspectiva isométrica."""
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=cor)


def degrau(d, cx, base_y, largura, altura, topo_cor, frente_cor, borda):
    """Um bloco isométrico: topo elíptico + corpo reto."""
    rx = largura / 2
    ry = largura / 5.2
    topo_y = base_y - altura

    # corpo
    d.polygon(
        [(cx - rx, topo_y), (cx + rx, topo_y), (cx + rx, base_y), (cx - rx, base_y)],
        fill=frente_cor,
    )
    d.ellipse([cx - rx, base_y - ry, cx + rx, base_y + ry], fill=frente_cor)
    # topo
    losango(d, cx, topo_y, rx, ry, topo_cor)
    # aresta acesa
    d.arc([cx - rx, topo_y - ry, cx + rx, topo_y + ry], 0, 360, fill=borda, width=4)
    d.line([(cx - rx, topo_y), (cx - rx, base_y)], fill=borda, width=3)
    d.line([(cx + rx, topo_y), (cx + rx, base_y)], fill=borda, width=3)


def marca_certo(d, cx, cy, tam, cor):
    d.line(
        [(cx - tam * 0.45, cy), (cx - tam * 0.08, cy + tam * 0.4), (cx + tam * 0.5, cy - tam * 0.42)],
        fill=cor, width=max(4, int(tam * 0.17)), joint="curve",
    )


arte = Image.new("RGBA", (N, N), (0, 0, 0, 0))
d = ImageDraw.Draw(arte)

cx = N // 2
chao = int(N * 0.78)

# ---- base circular ----
brx, bry = int(N * 0.40), int(N * 0.13)
d.ellipse([cx - brx, chao - bry, cx + brx, chao + bry + 26], fill=GRAFITE)
d.ellipse([cx - brx, chao - bry, cx + brx, chao + bry], fill=(46, 38, 62))
d.arc([cx - brx, chao - bry, cx + brx, chao + bry], 0, 360, fill=ROXO_NEON, width=5)

# trilha interna acesa
irx, iry = int(brx * 0.70), int(bry * 0.70)
d.arc([cx - irx, chao - iry, cx + irx, chao + iry], 0, 360, fill=ROXO_CLARO, width=7)
irx2, iry2 = int(brx * 0.52), int(bry * 0.52)
d.arc([cx - irx2, chao - iry2, cx + irx2, chao + iry2], 190, 350, fill=AMARELO, width=6)

# ---- três degraus, o mais alto ao fundo ----
larguras = [int(N * 0.20), int(N * 0.21), int(N * 0.22)]
alturas = [int(N * 0.11), int(N * 0.19), int(N * 0.28)]
desloc = [-int(N * 0.17), 0, int(N * 0.17)]

for i in (2, 1, 0):
    degrau(
        d,
        cx + desloc[i],
        chao - int(N * 0.02),
        larguras[i],
        alturas[i],
        topo_cor=(58, 48, 78),
        frente_cor=(34, 28, 46),
        borda=ROXO_NEON,
    )
    marca_certo(
        d,
        cx + desloc[i],
        chao - alturas[i] + int(N * 0.055),
        int(N * 0.055),
        ROXO_NEON,
    )

# ---- mastro e bandeira no degrau mais alto ----
topo_x = cx + desloc[2]
topo_y = chao - int(N * 0.02) - alturas[2]
mastro_alto = int(N * 0.20)
d.line([(topo_x, topo_y), (topo_x, topo_y - mastro_alto)], fill=PRATA, width=9)
d.ellipse(
    [topo_x - 15, topo_y - mastro_alto - 15, topo_x + 15, topo_y - mastro_alto + 15],
    fill=PRATA,
)
d.polygon(
    [
        (topo_x + 5, topo_y - mastro_alto + 6),
        (topo_x + int(N * 0.20), topo_y - mastro_alto + int(N * 0.03)),
        (topo_x + int(N * 0.17), topo_y - mastro_alto + int(N * 0.075)),
        (topo_x + int(N * 0.20), topo_y - mastro_alto + int(N * 0.12)),
        (topo_x + 5, topo_y - mastro_alto + int(N * 0.10)),
    ],
    fill=ROXO_CLARO,
)

# ---- brilho geral ----
brilho = Image.new("RGBA", (N, N), (0, 0, 0, 0))
gb = ImageDraw.Draw(brilho)
gb.ellipse([cx - brx, chao - bry - 10, cx + brx, chao + bry + 10], outline=ROXO_NEON + (150,), width=16)
gb.line([(topo_x, topo_y), (topo_x, topo_y - mastro_alto)], fill=ROXO_NEON + (120,), width=22)
brilho = brilho.filter(ImageFilter.GaussianBlur(22))
arte = Image.alpha_composite(brilho, arte)

os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
arte.save(SAIDA, "PNG", optimize=True)
print(f"arte provisória: {SAIDA}  ({os.path.getsize(SAIDA)//1024} kB)")
print("Substitua por assets/meta-3d.png com a sua arte final quando quiser.")
