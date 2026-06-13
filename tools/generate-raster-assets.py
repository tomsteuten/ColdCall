from PIL import Image, ImageDraw, ImageFilter

WIDTH = 512
HEIGHT = 512

BACKGROUND_TOP = (20, 30, 50)
BACKGROUND_BOTTOM = (12, 18, 32)
MACHINE_BODY = (54, 89, 132)
PANEL = (219, 246, 255)
DARK_PANEL = (89, 118, 146)
WARNING = (255, 126, 66)
WORKING = (112, 255, 178)
SHADOW = (0, 0, 0, 96)


def make_canvas():
    base = Image.new("RGBA", (WIDTH, HEIGHT), BACKGROUND_TOP)
    grad = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        r = int(BACKGROUND_TOP[0] * (1 - t) + BACKGROUND_BOTTOM[0] * t)
        g = int(BACKGROUND_TOP[1] * (1 - t) + BACKGROUND_BOTTOM[1] * t)
        b = int(BACKGROUND_TOP[2] * (1 - t) + BACKGROUND_BOTTOM[2] * t)
        ImageDraw.Draw(grad).line([(0, y), (WIDTH, y)], fill=(r, g, b, 255))
    base = Image.alpha_composite(base, grad)
    return base


def draw_glow(draw, center, radius, color, alpha=120):
    for i in range(radius, 0, -1):
        a = int(alpha * (i / radius) ** 2)
        draw.ellipse([
            center[0] - i,
            center[1] - i,
            center[0] + i,
            center[1] + i,
        ], outline=color + (a,))


def draw_machine_base(draw):
    draw.rounded_rectangle([96, 124, 416, 396], radius=42, fill=MACHINE_BODY)
    draw.rounded_rectangle([120, 154, 392, 290], radius=28, fill=PANEL)
    draw.rounded_rectangle([132, 302, 380, 374], radius=22, fill=DARK_PANEL)
    draw.rectangle([236, 306, 276, 368], fill=(237, 252, 255))
    for x in range(148, 364, 36):
        draw.rectangle([x, 178, x + 20, 262], fill=(163, 209, 229))
    draw.ellipse([96, 114, 150, 164], fill=(255, 191, 99))
    draw.ellipse([120, 132, 136, 152], fill=(42, 63, 88))


def draw_broken_machine(path):
    base = make_canvas()
    shadow = Image.new("RGBA", base.size)
    sdraw = ImageDraw.Draw(shadow)
    sdraw.ellipse([132, 340, 380, 470], fill=SHADOW)
    base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(20)))
    draw = ImageDraw.Draw(base)
    draw_machine_base(draw)
    draw.line([(260, 160), (360, 192)], fill=(255, 230, 200), width=20)
    draw.line([(360, 192), (286, 232)], fill=(20, 28, 40), width=18)
    draw.line([(316, 178), (328, 216)], fill=(20, 28, 40), width=18)
    draw.ellipse([310, 178, 370, 238], fill=WARNING)
    draw.ellipse([330, 198, 354, 222], fill=(255, 255, 255))
    draw.text((WIDTH / 2, 68), "FAULT", fill=(255, 200, 140), anchor="mm", align="center", font=None)
    badge = Image.new("RGBA", base.size)
    bdraw = ImageDraw.Draw(badge)
    bdraw.rounded_rectangle([182, 392, 330, 438], radius=20, fill=(255, 86, 88, 220))
    bdraw.text((WIDTH / 2, 414), "ERROR", fill=(255, 255, 255), anchor="mm", align="center", font=None)
    base = Image.alpha_composite(base, badge)
    base.save(path)


def draw_working_machine(path):
    base = make_canvas()
    shadow = Image.new("RGBA", base.size)
    sdraw = ImageDraw.Draw(shadow)
    sdraw.ellipse([132, 340, 380, 470], fill=SHADOW)
    base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(20)))
    draw = ImageDraw.Draw(base)
    draw_machine_base(draw)
    draw.ellipse([294, 170, 352, 224], fill=WORKING)
    draw.ellipse([308, 184, 336, 212], fill=(255, 255, 255))
    draw_glow(draw, (298, 196), 44, WORKING, alpha=90)
    draw.line([(160, 192), (206, 238)], fill=(255, 255, 255), width=18)
    draw.line([(202, 238), (248, 166)], fill=(255, 255, 255), width=18)
    draw.text((WIDTH / 2, 68), "READY", fill=(183, 255, 214), anchor="mm", align="center", font=None)
    base.save(path)


def draw_tech_portrait(path):
    base = Image.new("RGBA", (WIDTH, HEIGHT), BACKGROUND_TOP)
    grad = Image.new("RGBA", base.size, (0, 0, 0, 0))
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        r = int(BACKGROUND_TOP[0] * (1 - t) + BACKGROUND_BOTTOM[0] * t)
        g = int(BACKGROUND_TOP[1] * (1 - t) + BACKGROUND_BOTTOM[1] * t)
        b = int(BACKGROUND_TOP[2] * (1 - t) + BACKGROUND_BOTTOM[2] * t)
        ImageDraw.Draw(grad).line([(0, y), (WIDTH, y)], fill=(r, g, b, 255))
    base = Image.alpha_composite(base, grad)
    draw = ImageDraw.Draw(base)
    draw.ellipse([124, 88, 388, 308], fill=(255, 205, 136))
    draw.ellipse([170, 112, 204, 160], fill=(43, 61, 79))
    draw.ellipse([308, 112, 342, 160], fill=(43, 61, 79))
    draw.arc([164, 156, 344, 260], 12, 168, fill=(35, 45, 58), width=16)
    draw.rectangle([128, 252, 384, 420], fill=(82, 145, 164))
    draw.rectangle([148, 276, 280, 428], fill=(52, 92, 114))
    draw.ellipse([290, 108, 346, 152], fill=(255, 234, 153))
    highlight = Image.new("RGBA", base.size)
    hdraw = ImageDraw.Draw(highlight)
    hdraw.ellipse([150, 46, 342, 168], fill=(255, 255, 255, 24))
    base = Image.alpha_composite(base, highlight)
    draw.text((WIDTH / 2, 460), "TECH", fill=(235, 245, 255), anchor="mm", align="center", font=None)
    base.save(path)


if __name__ == "__main__":
    draw_broken_machine("assets/machine-broken.png")
    draw_working_machine("assets/machine-working.png")
    draw_tech_portrait("assets/tech-avatar.png")
    print("Generated assets:")
    print("  assets/machine-broken.png")
    print("  assets/machine-working.png")
    print("  assets/tech-avatar.png")
