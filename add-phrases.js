/* ═══════════════════════════════════════════════════════════════
   ADD-PHRASES — Caixa para escrever novas frases e incluí-las na base
   Lousa da Fluência · Espanhol · Igarapé Digital

   PROBLEMA QUE RESOLVE
   O app carrega a base de frases substituindo o array inteiro a cada
   "Carregar Online" ou "Carregar TXT" (sentences = parseTxtToSentences).
   Qualquer frase digitada à mão viveria só no localStorage deste
   aparelho e seria apagada na próxima recarga do arquivo do GitHub.

   COMO ESTE MÓDULO RESOLVE (causa raiz, três níveis)
   1) STORAGE  — guarda suas adições numa chave própria, custom_phrases_v1,
                 separada da base de execução (sentences_v2).
   2) IMPORT   — "grampeia" window.parseTxtToSentences: toda carga futura
                 (online, TXT, offline) reinjeta automaticamente suas
                 frases. Elas passam a sobreviver a qualquer recarga.
   3) ESTADO   — ao adicionar, empurra os pares direto no array vivo
                 (window._sentences, em posição — sem reatribuir a
                 referência que o app.js compartilha), cria a entrada de
                 repetição espaçada, salva SRS e persiste a base.

   FECHAMENTO DO CICLO
   O botão "Exportar base (.txt)" baixa a base completa no formato
   Español | Inglês, pronta para substituir frases_unicas_espanhol.txt
   no GitHub — é assim que as adições viram permanentes entre aparelhos.

   Não altera app.js. Deve carregar depois de data-loader.js.
═══════════════════════════════════════════════════════════════ */

window.AddPhrases = (function () {
  "use strict";

  const CUSTOM_KEY = "custom_phrases_v1";
  const EXPORT_NAME = "frases_unicas_espanhol.txt";

  // Aceita "es | en", "es| en", "es |en", "es|en" e tabulação — mesma
  // tolerância do data-loader, para não exigir espaçamento perfeito.
  const PIPE = /\s*\|\s*/;

  /* ── Armazém das adições do usuário ──────────────────────── */

  function loadCustom() {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveCustom(list) {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    } catch (e) {
      // Se o storage estourar, avisa mas não derruba o app.
      say('<i class="fa fa-exclamation-triangle"></i> Espaço de armazenamento cheio. ' +
          'Exporte a base e limpe o histórico para liberar espaço.', "erro");
    }
  }

  /* ── Interpretação do que o usuário digitou ──────────────── */

  // Recebe texto livre (uma frase por linha) e devolve pares {en, pt}.
  // en = espanhol · pt = inglês (segue a convenção do arquivo).
  function parseInput(txt) {
    const out = [];
    const lines = String(txt || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    for (const line of lines) {
      let en = "";
      let pt = "";
      if (line.indexOf("|") >= 0) {
        const parts = line.split(PIPE);
        en = (parts[0] || "").trim();
        pt = parts.slice(1).join(" | ").trim();
      } else if (line.indexOf("\t") >= 0) {
        const parts = line.split("\t");
        en = (parts[0] || "").trim();
        pt = parts.slice(1).join("\t").trim();
      } else {
        en = line; // só espanhol, sem tradução — aceito, mas sinalizado
      }
      if (en) out.push({ en, pt });
    }
    return out;
  }

  /* ── Núcleo: incluir na base ─────────────────────────────── */

  function currentSentences() {
    if (!Array.isArray(window._sentences)) window._sentences = [];
    return window._sentences;
  }

  // Empurra em posição, sem reatribuir a referência que o app.js divide.
  function pushInPlace(arr, items) {
    Array.prototype.push.apply(arr, items);
  }

  function add(pairs) {
    const report = { pedidas: pairs.length, adicionadas: 0, duplicadas: 0, semTraducao: 0 };
    if (!pairs.length) return report;

    const live = currentSentences();

    // Chaves já existentes na base viva (espanhol em minúsculas).
    const seen = new Set(live.map((s) => String(s.en || "").toLowerCase()));

    const novos = [];
    for (const p of pairs) {
      const key = p.en.toLowerCase();
      if (seen.has(key)) { report.duplicadas++; continue; }
      seen.add(key);
      if (!p.pt) report.semTraducao++;
      novos.push({ en: p.en, pt: p.pt });
    }

    if (!novos.length) return report;

    // 1) Estado vivo — array compartilhado com o app.js.
    pushInPlace(live, novos);

    // 2) Repetição espaçada — cada frase nova entra no SRS.
    if (typeof ensureSrsEntry === "function") {
      novos.forEach((s) => ensureSrsEntry(s.en));
      if (typeof saveSRS === "function") saveSRS();
    }

    // 3) Persistência da base de execução.
    if (typeof persistSentences === "function") persistSentences();

    // 4) Armazém próprio das adições — o que garante a sobrevivência
    //    a recargas via o gancho no parser (ver hookParser).
    const custom = loadCustom();
    pushInPlace(custom, novos);
    saveCustom(custom);

    report.adicionadas = novos.length;

    // 5) Atualiza contadores e, se o quadro estiver vazio, mostra a
    //    primeira frase para o app não ficar em branco.
    if (typeof renderSrsStats === "function") renderSrsStats();
    revealAppButtons();
    ensureACardIsLoaded();

    return report;
  }

  // Se o app ainda não tinha frase alguma na tela, carrega uma.
  function ensureACardIsLoaded() {
    const board = document.getElementById("sentenceEn");
    const vazio = !board || !board.textContent.trim();
    if (vazio &&
        typeof pickCardForNavigation === "function" &&
        typeof loadSentence === "function") {
      try {
        const card = pickCardForNavigation(false, 1);
        if (card) loadSentence(card);
      } catch {}
    }
  }

  // Revela os botões que o app esconde quando abre sem frases.
  function revealAppButtons() {
    [
      "nextBtn", "reviewNowBtn", "trainWorstBtn", "speakModeBtn",
      "patternModeBtn", "autoReadBtn", "walkModeBtn", "favoriteBtn",
      "trainFavoritesBtn", "clearBtn", "groupModeBtn"
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.style.display === "none") el.style.display = "inline-flex";
    });
    const wrap = document.getElementById("newOnlyToggleWrap");
    if (wrap && wrap.style.display === "none") wrap.style.display = "inline-flex";
  }

  /* ── Remover só as adições do usuário ────────────────────── */

  function clearCustom() {
    const custom = loadCustom();
    if (!custom.length) {
      say("Não há frases adicionadas por você para remover.", "info");
      return;
    }
    const keys = new Set(custom.map((s) => String(s.en || "").toLowerCase()));
    const live = currentSentences();
    const kept = live.filter((s) => !keys.has(String(s.en || "").toLowerCase()));

    // Reescreve o array vivo em posição (preserva a referência).
    live.length = 0;
    pushInPlace(live, kept);

    localStorage.removeItem(CUSTOM_KEY);
    if (typeof persistSentences === "function") persistSentences();
    if (typeof renderSrsStats === "function") renderSrsStats();

    say(`<strong>${custom.length} frase(s) sua(s) removida(s).</strong> ` +
        `A base fonte não foi tocada.`, "ok");
  }

  /* ── Gancho no parser: adições sobrevivem a toda recarga ─── */

  // Envolve window.parseTxtToSentences para que qualquer carga (online,
  // TXT, cópia offline) devolva a base do arquivo MAIS as suas adições,
  // sem duplicar. É o ponto único de passagem de toda importação.
  function hookParser() {
    const cur = window.parseTxtToSentences;
    if (typeof cur !== "function") return false;
    if (cur._customWrapped) return true;

    const wrapped = function (txt) {
      const base = cur(txt) || [];
      const custom = loadCustom();
      if (!custom.length) return base;

      const seen = new Set(base.map((s) => String(s.en || "").toLowerCase()));
      const merged = base.slice();
      for (const s of custom) {
        const key = String(s.en || "").toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ en: s.en, pt: s.pt || "" });
      }
      return merged;
    };
    wrapped._customWrapped = true;
    window.parseTxtToSentences = wrapped;
    return true;
  }

  /* ── Exportar a base completa (.txt) ─────────────────────── */

  function exportTxt() {
    const live = currentSentences();
    if (!live.length) {
      say("Não há frases para exportar ainda.", "info");
      return;
    }
    const linhas = live.map((s) => {
      const en = String(s.en || "").trim();
      const pt = String(s.pt || "").trim();
      return pt ? `${en} | ${pt}` : en;
    });
    const blob = new Blob(["\uFEFF" + linhas.join("\n") + "\n"], {
      type: "text/plain;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = EXPORT_NAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    say(`<strong>Base exportada (${live.length} frases).</strong> ` +
        `Substitua o arquivo <code>${EXPORT_NAME}</code> no GitHub para ` +
        `torná-las permanentes em todos os aparelhos.`, "ok");
  }

  /* ── Painel de mensagens do módulo ───────────────────────── */

  function say(html, kind) {
    const el = document.getElementById("addphStatus");
    if (!el) return;
    el.className = "addph-status addph-" + (kind || "info");
    el.innerHTML = html;
    el.style.display = "block";
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function reportSay(r) {
    if (!r.adicionadas && !r.duplicadas) {
      say("Nada para adicionar — a caixa estava vazia.", "info");
      return;
    }
    let html = `<strong>${r.adicionadas} frase(s) adicionada(s) à base.</strong>`;
    if (r.duplicadas) html += ` ${r.duplicadas} já existia(m) e foi(ram) ignorada(s).`;
    if (r.semTraducao) html += ` ${r.semTraducao} entrou(entraram) sem tradução em inglês.`;
    say(html, "ok");
  }

  /* ── UI ──────────────────────────────────────────────────── */

  function injectStyles() {
    if (document.getElementById("addphStyles")) return;
    const css = `
    .addph-card{border:1px solid #d9e2ec;border-radius:14px;background:#fff;
      margin-top:14px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;}
    .addph-head{display:flex;align-items:center;gap:10px;cursor:pointer;
      padding:12px 16px;background:#f0f4fa;color:#0b3d66;font-weight:700;
      user-select:none;}
    .addph-head .addph-chev{margin-left:auto;transition:transform .2s;}
    .addph-card.open .addph-chev{transform:rotate(180deg);}
    .addph-body{padding:16px;display:none;flex-direction:column;gap:12px;}
    .addph-card.open .addph-body{display:flex;}
    .addph-row{display:flex;gap:8px;flex-wrap:wrap;}
    .addph-row .addph-field{flex:1 1 180px;min-width:140px;}
    .addph-label{font-size:.72rem;font-weight:700;text-transform:uppercase;
      letter-spacing:.5px;color:#5a6b7b;margin-bottom:4px;display:block;}
    .addph-input,.addph-textarea{width:100%;border:1px solid #cfd9e4;
      border-radius:10px;padding:10px 12px;font-size:.95rem;
      font-family:inherit;box-sizing:border-box;background:#fff;color:#1f2d3d;}
    .addph-input:focus,.addph-textarea:focus{outline:none;border-color:#2f7fd1;
      box-shadow:0 0 0 3px rgba(47,127,209,.15);}
    .addph-textarea{min-height:120px;resize:vertical;line-height:1.5;}
    .addph-hint{font-size:.78rem;color:#6b7a89;line-height:1.5;}
    .addph-hint code{background:#eef3f8;padding:1px 6px;border-radius:5px;
      font-size:.9em;}
    .addph-actions{display:flex;gap:8px;flex-wrap:wrap;}
    .addph-status{display:none;border-radius:10px;padding:10px 14px;
      font-size:.85rem;line-height:1.5;}
    .addph-status code{background:rgba(0,0,0,.06);padding:1px 6px;border-radius:5px;}
    .addph-ok{background:#e7f6ec;color:#1c6b3a;border:1px solid #b7e2c6;}
    .addph-info{background:#eef3fa;color:#2a4d6e;border:1px solid #c9dcf0;}
    .addph-erro{background:#fdecec;color:#9b2222;border:1px solid #f2c2c2;}
    .addph-note{font-size:.76rem;color:#7a8894;border-top:1px dashed #dbe3ec;
      padding-top:10px;line-height:1.5;}
    `;
    const style = document.createElement("style");
    style.id = "addphStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildUI() {
    if (document.getElementById("addphCard")) return;
    const shell = document.querySelector(".control-shell");
    if (!shell) return;

    injectStyles();

    const card = document.createElement("div");
    card.className = "addph-card";
    card.id = "addphCard";
    card.innerHTML = `
      <div class="addph-head" id="addphToggle">
        <i class="fa fa-plus-circle"></i>
        <span>Adicionar frases à base</span>
        <i class="fa fa-chevron-down addph-chev"></i>
      </div>
      <div class="addph-body">
        <div class="addph-row">
          <div class="addph-field">
            <label class="addph-label">Espanhol</label>
            <input type="text" class="addph-input" id="addphEs"
              placeholder="Ej.: ¿Podemos agendar la junta?" />
          </div>
          <div class="addph-field">
            <label class="addph-label">Inglês (tradução)</label>
            <input type="text" class="addph-input" id="addphEn"
              placeholder="Ex.: Can we schedule the meeting?" />
          </div>
        </div>
        <div class="addph-actions">
          <button class="btn btn-primary" id="addphAddOne">
            <i class="fa fa-plus"></i> Adicionar esta frase
          </button>
        </div>

        <div>
          <label class="addph-label">Ou cole várias — uma por linha</label>
          <textarea class="addph-textarea" id="addphBulk"
            placeholder="Español | Inglês&#10;Hola, ¿cómo estás? | Hello, how are you?&#10;Nos vemos mañana. | See you tomorrow."></textarea>
          <div class="addph-hint">Formato: <code>espanhol | inglês</code>.
            Sem a barra, entra só o espanhol (sem tradução).</div>
        </div>
        <div class="addph-actions">
          <button class="btn btn-primary" id="addphAddBulk">
            <i class="fa fa-layer-group"></i> Adicionar lista
          </button>
        </div>

        <div class="addph-status" id="addphStatus"></div>

        <div class="addph-actions">
          <button class="btn btn-soft" id="addphExport">
            <i class="fa fa-download"></i> Exportar base (.txt)
          </button>
          <button class="btn btn-soft" id="addphClear">
            <i class="fa fa-eraser"></i> Limpar minhas adições
          </button>
        </div>

        <div class="addph-note">
          Suas frases ficam guardadas neste aparelho e sobrevivem às
          recargas do app. Para torná-las permanentes em todos os
          dispositivos, exporte o <code>.txt</code> e substitua o arquivo
          no seu repositório do GitHub.
        </div>
      </div>`;
    shell.appendChild(card);

    // Abrir/fechar
    document.getElementById("addphToggle").onclick = () =>
      card.classList.toggle("open");

    // Adicionar uma frase pelos dois campos
    document.getElementById("addphAddOne").onclick = () => {
      const es = document.getElementById("addphEs").value.trim();
      const en = document.getElementById("addphEn").value.trim();
      if (!es) { say("Escreva ao menos a frase em espanhol.", "info"); return; }
      const r = add([{ en: es, pt: en }]);
      reportSay(r);
      if (r.adicionadas) {
        document.getElementById("addphEs").value = "";
        document.getElementById("addphEn").value = "";
        document.getElementById("addphEs").focus();
      }
    };

    // Enter no campo de inglês dispara o "adicionar esta frase"
    document.getElementById("addphEn").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("addphAddOne").click();
    });

    // Adicionar lista da textarea
    document.getElementById("addphAddBulk").onclick = () => {
      const txt = document.getElementById("addphBulk").value;
      const pairs = parseInput(txt);
      if (!pairs.length) { say("A lista está vazia.", "info"); return; }
      const r = add(pairs);
      reportSay(r);
      if (r.adicionadas) document.getElementById("addphBulk").value = "";
    };

    document.getElementById("addphExport").onclick = exportTxt;
    document.getElementById("addphClear").onclick = () => {
      if (confirm("Remover apenas as frases que você adicionou? A base original não é afetada.")) {
        clearCustom();
      }
    };
  }

  /* ── Boot ────────────────────────────────────────────────── */

  function boot() {
    buildUI();
    // Grampeia o parser assim que possível e reforça no próximo tique,
    // porque o data-loader.js troca window.parseTxtToSentences no boot
    // dele. O gancho é idempotente (não envolve duas vezes).
    hookParser();
    setTimeout(hookParser, 120);
  }

  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();

  return { add, parseInput, exportTxt, clearCustom, hookParser,
           get custom() { return loadCustom(); } };
})();
