import json
from pathlib import Path

from playwright.sync_api import sync_playwright


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = PROJECT_ROOT / "artifacts" / "motion-qa"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
URL = "http://127.0.0.1:8443/"
CHROME_PATHS = (
    Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
    Path("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
    Path("C:/Program Files/Microsoft/Edge/Application/msedge.exe"),
    Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),
)
CHROME = next((path for path in CHROME_PATHS if path.exists()), None)


def check(result, name, condition, details=None):
    entry = {"name": name, "passed": bool(condition)}
    if details is not None:
        entry["details"] = details
    result["checks"].append(entry)


def scroll_to(page, y):
    page.evaluate("y => window.scrollTo({ top: y, behavior: 'auto' })", y)
    page.wait_for_timeout(1250)


def transition_metrics(page):
    return page.evaluate(
        """() => {
          const hero = document.querySelector('#abertura')
          const circle = document.querySelector('.hipocampo-transition-circle')
          const lines = [...document.querySelectorAll('.hipocampo-memory-line')]
          const header = document.querySelector('body > #root > header')
          return {
            scrollY: window.scrollY,
            progress: Number.parseFloat(hero.style.getPropertyValue('--hipocampo-scroll-progress')) || 0,
            circleTransform: getComputedStyle(circle).transform,
            circleColor: getComputedStyle(circle).backgroundColor,
            lineOpacities: lines.map(line => Number.parseFloat(getComputedStyle(line).opacity)),
            headerOpacity: Number.parseFloat(getComputedStyle(header.firstElementChild).opacity),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          }
        }"""
    )


def run_desktop(browser, motion):
    result = {"motion": motion, "viewport": "1916x851", "checks": [], "transition": []}
    context = browser.new_context(
        viewport={"width": 1916, "height": 851},
        reduced_motion=motion,
        device_scale_factor=1,
        ignore_https_errors=True,
    )
    page = context.new_page()
    console_errors = []
    page_errors = []
    http_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on(
        "response",
        lambda response: http_errors.append(f"{response.status} {response.url}")
        if response.status >= 400 else None,
    )

    page.goto(URL, wait_until="networkidle")
    page.wait_for_selector(".memory-char")
    page.evaluate("document.fonts.ready")

    entry_state = page.locator(".memory-char").evaluate_all(
        """chars => ({
          count: chars.length,
          moving: chars.filter(char => {
            const style = getComputedStyle(char)
            return Number.parseFloat(style.opacity) < 0.98 || style.transform !== 'none'
          }).length,
        })"""
    )
    check(result, "entrada das letras iniciou", entry_state["moving"] > 0, entry_state)
    check(result, "hero possui oito linhas", page.locator(".hipocampo-memory-line").count() == 8)
    check(result, "texto foi separado em letras", entry_state["count"] > 250, entry_state["count"])
    check(
        result,
        "efeitos antigos não estão no DOM",
        page.locator(".hipocampo-memory-text-lens, .hipocampo-memory-stripes, .hipocampo-photo-text").count() == 0,
    )

    page.wait_for_timeout(1700)
    page.screenshot(path=ARTIFACTS / f"{motion}-1916x851-00-top.png")

    field = page.locator(".hipocampo-memory-field")
    box = field.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.wait_for_timeout(750)
    affected = page.locator(".memory-char").evaluate_all(
        """chars => chars.filter(char => {
          const style = getComputedStyle(char)
          return style.filter !== 'none' && style.filter !== 'blur(0px)'
        }).length"""
    )
    check(result, "mouse afasta e desfoca letras", affected > 0, affected)
    page.screenshot(path=ARTIFACTS / f"{motion}-1916x851-01-letter-hover.png")
    page.mouse.move(10, 10)
    page.wait_for_timeout(1350)
    restored = page.locator(".memory-char").evaluate_all(
        """chars => chars.every(char => {
          const style = getComputedStyle(char)
          return style.filter === 'none' || style.filter === 'blur(0px)'
        })"""
    )
    check(result, "letras retornam ao sair", restored)

    project_y = page.locator("#projeto").evaluate("element => window.scrollY + element.getBoundingClientRect().top")
    for ratio in (0, 0.25, 0.5, 0.75, 1):
        scroll_to(page, project_y * ratio)
        metrics = transition_metrics(page)
        metrics["ratio"] = ratio
        result["transition"].append(metrics)
        page.screenshot(path=ARTIFACTS / f"{motion}-1916x851-forward-{round(ratio * 100):03d}.png")

    forward = result["transition"]
    check(
        result,
        "transição progride continuamente",
        all(forward[index]["progress"] <= forward[index + 1]["progress"] for index in range(len(forward) - 1)),
        [item["progress"] for item in forward],
    )
    check(result, "círculo termina branco", forward[-1]["circleColor"] == "rgb(255, 255, 255)", forward[-1]["circleColor"])
    check(result, "sem overflow horizontal desktop", abs(forward[-1]["overflow"]) <= 1, forward[-1]["overflow"])

    page.wait_for_timeout(1700)
    page2 = page.evaluate(
        """() => ({
          title: document.querySelector('.hipocampo-page2-title')?.getAttribute('aria-label'),
          copyLines: document.querySelectorAll('.page2-copy-line').length,
          mapPieces: document.querySelectorAll('.memory-map-piece-frame').length,
          mapCanvases: document.querySelectorAll('.memory-map-lines').length,
          oldPhotos: document.querySelectorAll('.page2-photo').length,
          background: getComputedStyle(document.querySelector('#projeto')).backgroundColor,
          oldProjectContent: Boolean(document.querySelector('#projeto .eyebrow')),
        })"""
    )
    check(result, "título da página 2 corresponde à referência", page2["title"] == "como uma memória é construída?", page2)
    check(result, "manifesto possui quinze linhas", page2["copyLines"] == 15, page2["copyLines"])
    check(result, "mapa possui 32 fragmentos", page2["mapPieces"] == 32, page2)
    check(result, "mapa usa um único canvas de linhas", page2["mapCanvases"] == 1, page2)
    check(result, "colagem fotográfica anterior foi removida", page2["oldPhotos"] == 0, page2)
    check(result, "página 2 usa fundo branco", page2["background"] == "rgb(255, 255, 255)", page2["background"])
    check(result, "conteúdo legado de projeto foi substituído", not page2["oldProjectContent"])

    scroll_to(page, project_y)
    moving_piece = page.locator('[data-piece-id="peca-18"] .memory-map-piece')
    piece_box = moving_piece.bounding_box()
    page.mouse.move(piece_box["x"] + piece_box["width"] / 2, piece_box["y"] + piece_box["height"] / 2)
    page.wait_for_timeout(900)
    repelled = moving_piece.evaluate(
        """element => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
          return { transform: getComputedStyle(element).transform, distance: Math.hypot(matrix.m41, matrix.m42) }
        }"""
    )
    check(result, "cursor repele os fragmentos", repelled["distance"] > 2, repelled)
    page.screenshot(path=ARTIFACTS / f"{motion}-1916x851-02-page2-map.png")
    page.mouse.move(10, 10)
    page.wait_for_timeout(2100)
    returned = moving_piece.evaluate(
        """element => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
          return { transform: getComputedStyle(element).transform, distance: Math.hypot(matrix.m41, matrix.m42) }
        }"""
    )
    check(result, "fragmentos retornam suavemente", returned["distance"] < repelled["distance"], [repelled, returned])

    anchor_results = []
    for section_id in ("projeto", "oficina", "instalacao", "fragmentos", "fotofilmes", "informacoes"):
        page.eval_on_selector(f'header a[href="#{section_id}"]', "element => element.click()")
        page.wait_for_timeout(2600)
        top = page.locator(f"#{section_id}").evaluate("element => element.getBoundingClientRect().top")
        anchor_results.append({"id": section_id, "top": round(top, 2)})
    check(
        result,
        "links do menu rolam via Lenis",
        all(abs(item["top"]) < 50 for item in anchor_results),
        anchor_results,
    )

    reverse = []
    for ratio in (1, 0.75, 0.5, 0.25, 0):
        scroll_to(page, project_y * ratio)
        metrics = transition_metrics(page)
        metrics["ratio"] = ratio
        reverse.append(metrics)
        page.screenshot(path=ARTIFACTS / f"{motion}-1916x851-reverse-{round(ratio * 100):03d}.png")
    result["reverse"] = reverse
    check(
        result,
        "transição reverte continuamente",
        all(reverse[index]["progress"] >= reverse[index + 1]["progress"] for index in range(len(reverse) - 1)),
        [item["progress"] for item in reverse],
    )
    check(
        result,
        "hero retorna ao estado inicial",
        reverse[-1]["progress"] <= 0.01 and reverse[-1]["headerOpacity"] >= 0.99,
        reverse[-1],
    )
    check(result, "console sem erros", not console_errors, console_errors)
    check(result, "página sem exceções", not page_errors, page_errors)
    check(result, "rede sem 404/erros HTTP", not http_errors, http_errors)
    result["consoleErrors"] = console_errors
    result["pageErrors"] = page_errors
    result["httpErrors"] = http_errors
    context.close()
    return result


def run_mobile(browser, motion):
    result = {"motion": motion, "viewport": "390x844", "checks": []}
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        reduced_motion=motion,
        device_scale_factor=1,
        is_mobile=True,
        has_touch=True,
        ignore_https_errors=True,
    )
    page = context.new_page()
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="networkidle")
    page.wait_for_selector(".memory-char")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(1700)
    page.screenshot(path=ARTIFACTS / f"{motion}-390x844-00-top.png")

    top_state = page.evaluate(
        """() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          lines: document.querySelectorAll('.hipocampo-memory-line').length,
          chars: document.querySelectorAll('.memory-char').length,
        })"""
    )
    check(result, "hero mobile mantém oito linhas", top_state["lines"] == 8, top_state)
    check(result, "mobile sem overflow horizontal no topo", abs(top_state["overflow"]) <= 1, top_state["overflow"])

    project_y = page.locator("#projeto").evaluate("element => scrollY + element.getBoundingClientRect().top")
    scroll_to(page, project_y)
    page.wait_for_timeout(1700)
    page.screenshot(path=ARTIFACTS / f"{motion}-390x844-01-page2.png")
    mobile_page2 = page.evaluate(
        """() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          titleVisible: document.querySelector('.hipocampo-page2-title').getBoundingClientRect().top < innerHeight,
          copyWidth: document.querySelector('.hipocampo-page2-copy').getBoundingClientRect().width,
          mapPieces: document.querySelectorAll('.memory-map-piece-frame').length,
          viewport: innerWidth,
        })"""
    )
    check(result, "página 2 aparece no mobile", mobile_page2["titleVisible"], mobile_page2)
    check(result, "mapa mobile mantém os 32 fragmentos", mobile_page2["mapPieces"] == 32, mobile_page2)
    check(result, "mobile sem overflow horizontal na página 2", abs(mobile_page2["overflow"]) <= 1, mobile_page2["overflow"])
    check(result, "texto da página 2 cabe no viewport", mobile_page2["copyWidth"] <= mobile_page2["viewport"], mobile_page2)
    check(result, "mobile sem erros de console", not errors, errors)
    context.close()
    return result


def capture_reference_view(browser):
    context = browser.new_context(
        viewport={"width": 1600, "height": 900},
        reduced_motion="no-preference",
        ignore_https_errors=True,
    )
    page = context.new_page()
    page.goto(URL, wait_until="networkidle")
    page.wait_for_selector(".memory-char")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(1700)
    project_y = page.locator("#projeto").evaluate("element => scrollY + element.getBoundingClientRect().top")
    scroll_to(page, project_y)
    page.wait_for_timeout(1700)
    page.screenshot(path=ARTIFACTS / "comparison-page2-1600x900-actual.png")
    context.close()


def run_viewport_smoke(browser, width, height, name, zoom=1):
    result = {"viewport": f"{width}x{height}", "name": name, "zoom": zoom, "checks": []}
    is_mobile = width < 768
    context = browser.new_context(
        viewport={"width": width, "height": height},
        reduced_motion="no-preference",
        ignore_https_errors=True,
        is_mobile=is_mobile,
        has_touch=is_mobile,
    )
    page = context.new_page()
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="networkidle")
    page.wait_for_selector(".memory-char")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(1700)

    if zoom != 1:
        page.evaluate("value => { document.documentElement.style.zoom = String(value) }", zoom)
        page.wait_for_timeout(500)

    top = page.evaluate(
        """() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          lines: document.querySelectorAll('.hipocampo-memory-line').length,
          sections: ['projeto','oficina','instalacao','fragmentos','fotofilmes','informacoes']
            .every(id => Boolean(document.getElementById(id))),
        })"""
    )
    check(result, "hero responsiva preservada", top["lines"] == 8, top)
    check(result, "seções subsequentes preservadas", top["sections"], top)
    check(result, "sem overflow no topo", abs(top["overflow"]) <= 1, top["overflow"])
    page.screenshot(path=ARTIFACTS / f"smoke-{name}-top.png")

    if not is_mobile and zoom == 1:
        page.focus('header a[href="#projeto"]')
        page.keyboard.press("Enter")
        page.wait_for_timeout(1800)
        keyboard_top = page.locator("#projeto").evaluate("element => element.getBoundingClientRect().top")
        check(result, "âncora funciona por teclado", abs(keyboard_top) < 3, keyboard_top)
    else:
        project_y = page.locator("#projeto").evaluate("element => scrollY + element.getBoundingClientRect().top")
        scroll_to(page, project_y)

    project_state = page.evaluate(
        """() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          title: document.querySelector('.hipocampo-page2-title')?.getAttribute('aria-label'),
        })"""
    )
    check(result, "página 2 responsiva aparece", project_state["title"] == "como uma memória é construída?", project_state)
    check(result, "sem overflow na página 2", abs(project_state["overflow"]) <= 1, project_state["overflow"])
    check(result, "viewport sem erros de console", not errors, errors)
    page.screenshot(path=ARTIFACTS / f"smoke-{name}-page2.png")
    context.close()
    return result


def main():
    if CHROME is None:
        raise RuntimeError("Chrome ou Edge não encontrado")

    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=str(CHROME), headless=True)
        for motion in ("no-preference", "reduce"):
            results.append(run_desktop(browser, motion))
            results.append(run_mobile(browser, motion))
        results.append(run_viewport_smoke(browser, 1366, 768, "1366x768"))
        results.append(run_viewport_smoke(browser, 1366, 768, "1366x768-zoom125", zoom=1.25))
        results.append(run_viewport_smoke(browser, 375, 667, "375x667"))
        capture_reference_view(browser)
        browser.close()

    summary = {
        "browser": str(CHROME),
        "passed": sum(check["passed"] for result in results for check in result["checks"]),
        "failed": sum(not check["passed"] for result in results for check in result["checks"]),
        "results": results,
    }
    (ARTIFACTS / "motion-qa-results.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if summary["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
