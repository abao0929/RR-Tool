import { Locator } from "@/src/template";

type LocateResult = { matched: Locator; nodeIds: number[] };

// ===== 工具 =====
async function ensureDom(tabId: number) {
  try { await chrome.debugger.sendCommand({ tabId }, "DOM.enable"); } catch { }
}

async function getRootNodeId(tabId: number, parentNodeId?: number): Promise<number> {
  if (typeof parentNodeId === "number") return parentNodeId;
  const { root } = await chrome.debugger.sendCommand(
    { tabId }, "DOM.getDocument", { depth: -1, pierce: true }
  ) as any;
  return root.nodeId as number;
}

// DOM.querySelectorAll
async function qsa(tabId: number, nodeId: number, selector: string): Promise<number[]> {
  const { nodeIds } = await chrome.debugger.sendCommand(
    { tabId }, "DOM.querySelectorAll", { nodeId, selector }
  ) as any;
  return (nodeIds as number[]) ?? [];
}

// 构造 [name="value"] / [name]（仅需转义 " 与 \）
function attrEquals(name: string, value?: string) {
  if (value == null || value === "") return `[${name}]`;
  const v = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${name}="${v}"]`;
}

// 构造 [name~="token"]（class 词元包含）
function attrContainsToken(name: string, token: string) {
  const v = String(token).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${name}~="${v}"]`;
}

// 集合交集（返回新 Set）
function intersect(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

// ===== 核心类 =====
export class ElementLocator {
  constructor(private tabId: number) { }

  // Step 1: 按 tag 初筛；tag 为空时等价于 "*"
  private async filterByTag(rootNodeId: number, tag?: string | null): Promise<number[]> {
    const sel = tag && tag.trim() ? tag.trim() : "*";
    return qsa(this.tabId, rootNodeId, sel);
  }

  // Step 2: classes 软过滤
  private async filterByClasses(
    rootNodeId: number, base: Set<number>, classes?: string[]
  ): Promise<{ nodes: Set<number>; used: string[] }> {
    const used: string[] = [];
    let current = new Set(base);
    if (!classes?.length || current.size === 0) return { nodes: current, used };

    for (const raw of classes) {
      const token = (raw ?? "").trim();
      if (!token) continue;
      const hits = new Set(await qsa(this.tabId, rootNodeId, attrContainsToken("class", token)));
      const inter = intersect(current, hits);
      if (inter.size) { current = inter; used.push(token); } // 软过滤
    }
    return { nodes: current, used };
  }

  // Step 3: attributes 软过滤（[name] / [name="value"]）
  private async filterByAttributes(
    rootNodeId: number,
    base: Set<number>,
    attrs?: Array<{ name: string; value: string }>
  ): Promise<{ nodes: Set<number>; used: Array<{ name: string; value: string }> }> {
    const used: Array<{ name: string; value: string }> = [];
    let current = new Set(base);
    if (!attrs?.length || current.size === 0) return { nodes: current, used };

    for (const a of attrs) {
      if (!a?.name) continue;
      const sel = attrEquals(a.name, a.value);
      const hits = new Set(await qsa(this.tabId, rootNodeId, sel));
      const inter = intersect(current, hits);
      if (inter.size) { current = inter; used.push({ name: a.name, value: a.value ?? "" }); }
    }
    return { nodes: current, used };
  }

  // Step 4: text 软过滤（DOM.performSearch 全局文本 → 与候选交集；交集为空则忽略）
  private async filterByText(
    base: Set<number>, text?: string | null
  ): Promise<{ nodes: Set<number>; used: string | null }> {
    let current = new Set(base);
    if (!text?.trim() || current.size === 0) return { nodes: current, used: null };

    const { searchId, resultCount } = await chrome.debugger.sendCommand(
      { tabId: this.tabId }, "DOM.performSearch",
      { query: String(text), includeUserAgentShadowDOM: true }
    ) as any;
    if (!resultCount) return { nodes: current, used: null };

    const { nodeIds } = await chrome.debugger.sendCommand(
      { tabId: this.tabId }, "DOM.getSearchResults",
      { searchId, fromIndex: 0, toIndex: resultCount }
    ) as any;

    const hits = new Set<number>(nodeIds as number[]);
    const inter = intersect(current, hits);
    if (inter.size) { current = inter; return { nodes: current, used: String(text) }; }
    return { nodes: current, used: null }; // 软过滤：无命中则忽略
  }

  // Step 5: id 软过滤（[id="..."]）
  private async filterById(
    rootNodeId: number, base: Set<number>, id?: string | null
  ): Promise<{ nodes: Set<number>; used: string | null }> {
    let current = new Set(base);
    if (!id || !id.length || current.size === 0) return { nodes: current, used: null };

    const sel = attrEquals("id", id);
    const hits = new Set(await qsa(this.tabId, rootNodeId, sel));
    const inter = intersect(current, hits);
    if (inter.size) { current = inter; return { nodes: current, used: id }; }
    return { nodes: current, used: null };
  }

  /**
   * 对外：按 tag → classes → attributes → text → id 顺序过滤
   * @param locator       输入的定位信息
   * @param parentNodeId  父节点 nodeId（可选；不传则全局 document）
   * @returns             { matched, nodeIds }
   */
  public async locate(locator: Locator, parentNodeId?: number): Promise<LocateResult> {
    await ensureDom(this.tabId);
    const rootNodeId = await getRootNodeId(this.tabId, parentNodeId);

    // matched 初始化（仅填入生效项）
    const matched: Locator = {
      id: null,
      tag: null,
      classes: [],
      text: null,
      attributes: [],
      positionAndSize: null,
    };

    // 1) tag
    const tagList = await this.filterByTag(rootNodeId, locator.tag);
    let current = new Set<number>(tagList);
    if (current.size > 0 && locator.tag && locator.tag.trim()) {
      matched.tag = locator.tag.trim();
    }

    // 2) classes
    const cls = await this.filterByClasses(rootNodeId, current, locator.classes);
    current = cls.nodes;
    if (cls.used.length) matched.classes = cls.used;

    // 3) attributes
    const at = await this.filterByAttributes(rootNodeId, current, locator.attributes);
    current = at.nodes;
    if (at.used.length) matched.attributes = at.used;

    // 4) text
    const tx = await this.filterByText(current, locator.text);
    current = tx.nodes;
    if (tx.used) matched.text = tx.used;

    // 5) id
    const idf = await this.filterById(rootNodeId, current, locator.id);
    current = idf.nodes;
    if (idf.used) matched.id = idf.used;

    return { matched, nodeIds: Array.from(current) };
  }
}
