import json

antes = json.load(open("docs/perf-antes.json", encoding="utf-8"))
depois = json.load(open("docs/perf-depois.json", encoding="utf-8"))

for vp in ["1916x851", "390x844"]:
    print(f"\n### Viewport {vp}")
    print("| Métrica / Cenário | Antes | Depois | Variação |")
    print("| :--- | :---: | :---: | :---: |")
    a_kb = antes["viewports"][vp]["initialTransferKB"]
    d_kb = depois["viewports"][vp]["initialTransferKB"]
    diff_pct = ((d_kb / a_kb) - 1) * 100
    print(f"| **KB Transferidos (Carga Inicial)** | **{a_kb:.2f} KB** | **{d_kb:.2f} KB** | **{diff_pct:.1f}%** |")
    for sc, name in [("heroScroll", "Hero Scroll"), ("heroPointer", "Hero Pointer"), ("mapPointer", "Mapa Pointer")]:
        asc = antes["viewports"][vp]["scenarios"][sc]
        dsc = depois["viewports"][vp]["scenarios"][sc]
        fps_diff = dsc["fpsAverage"] - asc["fpsAverage"]
        p5_diff = dsc["fpsP5"] - asc["fpsP5"]
        print(f"| {name} — FPS Médio | {asc['fpsAverage']} | {dsc['fpsAverage']} | {fps_diff:+.2f} |")
        print(f"| {name} — FPS p5 | {asc['fpsP5']} | {dsc['fpsP5']} | {p5_diff:+.2f} |")
        print(f"| {name} — Long Tasks (qtd / total ms) | {asc['longTasks']['count']} ({asc['longTasks']['totalMs']} ms) | {dsc['longTasks']['count']} ({dsc['longTasks']['totalMs']} ms) | {dsc['longTasks']['count'] - asc['longTasks']['count']:+} tasks |")
