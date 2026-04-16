# 添加新論文工作流程

## 目錄結構

```
ADWM/
├── papers/                          # 論文原始檔案 (PDF/MD)
│   └── {YYMM}_{ShortName}/
│       └── {YYMM}_{ShortName}.pdf   # 或 .md（博客文章）
├── phyra-read/                      # Phyra 解析產出（MD + HTML）
│   └── {YYMM}_{ShortName}_{YYMM}_{ShortName}.{md,html}
└── ad-world-model-survey/           # GitHub Pages 網站（此 repo）
    ├── build/
    │   └── build_data.py            # 從 _notes.md 生成 papers.json + notes/*.json
    ├── data/
    │   ├── papers.json              # 主論文列表（首頁 + 白板共用）
    │   └── notes/{ShortName}.json   # 每篇論文詳細筆記（lazy-loaded）
    ├── phyra-read/
    │   ├── notes/                   # Phyra 筆記 HTML（供網頁連結）
    │   └── slides/                  # Phyra 投影片 HTML
    ├── home.html                    # 首頁
    ├── index.html                   # 白板頁
    └── js/
        ├── data.js                  # 資料載入
        └── paper-list.js           # 論文列表過濾邏輯

ad-survey-26/survey/
├── notes/                           # ⭐ SOURCE OF TRUTH: *_notes.md 原始筆記
│   └── {YYMM}_{ShortName}_notes.md
└── project-page-adwm/              # ad-world-model-survey 的另一份 clone（同 remote）
    └── build/build_data.py
```

## 命名規範

- `YYMM`：兩位年 + 兩位月，例如 `2505`（2025年5月）
- `ShortName`：論文簡稱，用於所有引用，例如 `Omni-Scene`、`X-World`

---

## 步驟一：下載論文

將論文 PDF 或博客文章保存到 `ADWM/papers/` 目錄。

```bash
# 建立目錄
mkdir -p papers/{YYMM}_{ShortName}

# 有 arXiv PDF 的：
wget -O papers/{YYMM}_{ShortName}/{YYMM}_{ShortName}.pdf "https://arxiv.org/pdf/{arXiv_ID}"

# 無 PDF 的博客文章：保存為 .md
# 手動或用工具抓取文章內容存為 papers/{YYMM}_{ShortName}/{YYMM}_{ShortName}.md
```

## 步驟二：Phyra 解析

使用 `phyra:paper-parser` agent 解析論文，產出結構化 MD + HTML 筆記。

產出檔案會存到 `ADWM/phyra-read/`，命名格式：
- `{YYMM}_{ShortName}_{YYMM}_{ShortName}.md`
- `{YYMM}_{ShortName}_{YYMM}_{ShortName}.html`

解析完成後，將 HTML 複製到網站目錄：
```bash
cp phyra-read/{YYMM}_{ShortName}*.html ad-world-model-survey/phyra-read/notes/
cp phyra-read/{YYMM}_{ShortName}*.html ad-world-model-survey/phyra-read/slides/  # 如果有投影片
```

## 步驟三：建立 `_notes.md` 原始筆記

在 `ad-survey-26/survey/notes/` 建立筆記原始檔。這是 **build_data.py 的唯一輸入源**。

檔名格式：`{YYMM}_{ShortName}_notes.md`

內容格式（必須包含以下 section，`build_data.py` 靠 `## N.` 標題解析）：

```markdown
# 論文閱讀筆記：{ShortName}

---

## 1. 基本資訊

| 項目 | 內容 |
|------|------|
| **論文簡稱** | {ShortName} |
| **論文全稱** | {Full Title} |
| **arXiv ID** | {arXiv ID 或 N/A} |
| **PDF 檔案** | [PDF](../papers/{YYMM}_{ShortName}/{YYMM}_{ShortName}.pdf) |
| **釋出日期** | {YYYY-MM} |
| **發表會議/期刊** | {Venue} |
| **論文連結** | {URL} |
| **程式碼連結** | (待補充) |
| **專案主頁** | (待補充) |

### 1.1 作者資訊

{作者列表}

### 1.2 關鍵詞

- Keyword1
- Keyword2

---

## 2. 研究概述

### 2.1 研究主題

> {一句話摘要}

### 2.2 研究領域分類

- [ ] World Model (世界模型)
- [ ] Video Generation (影片生成)
- [ ] 3D Scene Understanding (3D場景理解)
- [ ] Motion Planning (運動規劃)
- [ ] End-to-End Driving (端到端駕駛)
- [ ] Simulation (模擬器)
- [ ] Occupancy Prediction (佔用預測)
- [ ] Neural Rendering (神經渲染)

### 2.3 所使用的自動駕駛架構

- [ ] **Modular Pipeline** (模組化管線)
- [ ] **End-to-End** (端到端)
- [ ] **World Model + Planner** (世界模型 + 規劃器)
- [ ] **Foundation Model** (基石模型)

---

## 3. 論文評價

### 3.1 影響程度評級

| 評分維度 | 分數 (1-5) | 說明 |
|---------|-----------|------|
| **創新性** | ⭐⭐⭐ | |
| **技術深度** | ⭐⭐⭐ | |
| **實驗完整度** | ⭐⭐⭐ | |
| **寫作品質** | ⭐⭐⭐ | |
| **實用價值** | ⭐⭐⭐ | |
| **綜合評分** | ⭐⭐⭐ | |

## 4-15: 其他 sections...
```

> **重點**：`build_data.py` 從 `## N.` 標題解析 sections，從表格和 checkbox 提取 metadata。
> checkbox 用 `[x]` 標記選中，`[ ]` 標記未選中。星級用 ⭐ 字元數計算。

## 步驟四：執行 build_data.py

```bash
cd ad-survey-26/survey/project-page-adwm
python3 build/build_data.py
```

這會：
1. **清空** `data/notes/` 目錄
2. 讀取 `ad-survey-26/survey/notes/*_notes.md`
3. 生成 `data/papers.json`（主列表）
4. 生成 `data/notes/{ShortName}.json`（每篇詳細筆記）

> ⚠️ **注意**：`build_data.py` 會覆蓋整個 `papers.json` 和 `data/notes/`。
> 它**不會**生成 `relevance`、`phyra_slides`、`phyra_notes` 欄位。

## 步驟五：Post-build 補充欄位

`build_data.py` 產出的 `papers.json` 缺少三個欄位，需手動或腳本補充：

| 欄位 | 用途 | 值範例 |
|------|------|--------|
| `relevance` | 論文分類，影響首頁過濾 | `"World Model Core"` / `"Long Tail & Corner Case"` / `"Survey"` |
| `phyra_notes` | Phyra 筆記連結 | `"phyra-read/notes/{YYMM}_{ShortName}_{YYMM}_{ShortName}.html"` |
| `phyra_slides` | Phyra 投影片連結 | `"phyra-read/slides/{YYMM}_{ShortName}_{YYMM}_{ShortName}.html"` 或 `""` |

可用腳本批次補充：

```python
import json

with open('data/papers.json') as f:
    papers = json.load(f)

for p in papers:
    sn = p['short_name']
    yymm = p.get('year', '')

    # relevance（根據論文性質判斷）
    if not p.get('relevance'):
        cats = p.get('task_category', [])
        if 'World Model' in cats:
            p['relevance'] = 'World Model Core'
        else:
            p['relevance'] = 'Long Tail & Corner Case'

    # phyra_notes path
    if not p.get('phyra_notes'):
        import glob as g
        matches = g.glob(f'phyra-read/notes/{yymm}_{sn}_*.html')
        p['phyra_notes'] = matches[0] if matches else ''

    # phyra_slides path
    if not p.get('phyra_slides'):
        p['phyra_slides'] = ''

with open('data/papers.json', 'w') as f:
    json.dump(papers, f, ensure_ascii=False, indent=1)
```

> ⚠️ **`relevance` 為空會導致論文在過濾器啟用時被隱藏**（`paper-list.js` 第 160 行）。

## 步驟六：同步到 ad-world-model-survey 並推送

如果是在 `ad-survey-26` 的 clone 中 build 的，需要同步到 `ad-world-model-survey`：

```bash
# 複製 build 產物到 ad-world-model-survey
cp ad-survey-26/survey/project-page-adwm/data/papers.json \
   ad-world-model-survey/data/papers.json

cp ad-survey-26/survey/project-page-adwm/data/notes/*.json \
   ad-world-model-survey/data/notes/
```

然後 commit + push：

```bash
cd ad-world-model-survey
git add data/papers.json data/notes/*.json phyra-read/
git commit -m "Add N new papers: {paper list}"
git push origin main
```

GitHub Pages 通常 1-2 分鐘部署完成。

---

## 快速檢查清單

- [ ] `papers/{YYMM}_{ShortName}/` 有 PDF 或 MD
- [ ] `phyra-read/` 有解析產出
- [ ] `ad-survey-26/survey/notes/{YYMM}_{ShortName}_notes.md` 已建立
- [ ] `build_data.py` 執行成功，紙數正確
- [ ] `papers.json` 中每篇都有 `relevance` 值
- [ ] `phyra-read/notes/` 和 `phyra-read/slides/` 已複製 HTML
- [ ] `papers.json` 中 `phyra_notes` 路徑正確
- [ ] `git push` 完成
- [ ] 瀏覽器驗證紙數正確

## papers.json 完整欄位說明

```json
{
  "id": 1,
  "short_name": "ShortName",
  "title": "Full Paper Title",
  "date": "2025-05",
  "year": "2505",
  "venue": "ICCV 2025",
  "keywords": ["World Model", "..."],
  "task_category": ["World Model", "Video Generation"],
  "architecture": ["World Model + Planner"],
  "ratings": { "innovation": 3, "overall": 3 },
  "arxiv_id": "2505.12345",
  "has_notes": true,
  "relevance": "World Model Core",
  "phyra_slides": "phyra-read/slides/...",
  "phyra_notes": "phyra-read/notes/..."
}
```

| 來源 | 欄位 |
|------|------|
| `build_data.py` 自動生成 | id, short_name, title, date, year, venue, keywords, task_category, architecture, ratings, arxiv_id, has_notes |
| Post-build 手動補充 | relevance, phyra_slides, phyra_notes |
