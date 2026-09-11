import { PDFDocument, PDFFont, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Palette parchemin RP Skyrim
const PAPER = rgb(0.95, 0.92, 0.85); // parchemin clair
const PAPER_DARK = rgb(0.9, 0.84, 0.72);
const INK = rgb(0.16, 0.1, 0.04); // encre brune
const GOLD = rgb(0.62, 0.44, 0.12); // filets dorés
const RED = rgb(0.55, 0.14, 0.1);

const fmtSeptims = (n: number) =>
  `${(Math.round(n * 100) / 100).toFixed(2).replace(".", ",")} septims`;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

interface PdfMeta {
  sawmillName: string;
  sawmillAbbr: string;
  invoiceNo: string;
  date: string;
  clientLabel: string;
  sellerLabel?: string;
  kindLabel: string;
  discountPercent: number;
  total: number;
  lines: { productName: string; quantity: number; unitPrice: number; total: number }[];
}

function drawLine(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  italic: PDFFont,
  meta: PdfMeta
): Promise<Uint8Array> {
  const width = 595.28;
  const height = 841.89;
  const page = doc.addPage([width, height]);

  // Fond parchemin
  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });

  // Encadrement double style rouleau
  page.drawRectangle({ x: 22, y: 22, width: width - 44, height: height - 44, borderColor: GOLD, borderWidth: 1.5 });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: INK, borderWidth: 0.8 });

  const centerX = width / 2;
  let y = height - 96;

  // En-tête
  page.drawText("Les Scieries de Bordeciel", {
    x: centerX - 90, y, size: 11, font: italic, color: INK,
  });
  y -= 30;
  page.drawText(meta.sawmillName, {
    x: centerX - 130, y, size: 30, font: bold, color: INK,
  });
  y -= 26;
  page.drawText("F A C T U R E", {
    x: centerX - 62, y, size: 18, font: bold, color: RED,
  });
  y -= 22;
  page.drawText(meta.kindLabel, {
    x: centerX - 95, y, size: 11, font: italic, color: INK,
  });
  y -= 34;

  // Filet décoratif
  page.drawRectangle({ x: 90, y, width: width - 180, height: 1.2, color: GOLD });
  y -= 16;

  // Informations
  const infoSize = 10.5;
  // Colonne droite : n° et date
  page.drawText(`N°  ${meta.invoiceNo}`, { x: 360, y, size: infoSize, font: bold, color: INK });
  page.drawText(`Date : ${meta.date}`, { x: 360, y: y - 16, size: infoSize, font, color: INK });
  // Colonne gauche : client
  page.drawText("Reçu de :", { x: 58, y, size: 9.5, font: italic, color: INK });
  page.drawText(meta.clientLabel, { x: 58, y: y - 15, size: 13, font: bold, color: INK });
  if (meta.sellerLabel) {
    page.drawText(`Vente conclue par : ${meta.sellerLabel}`, {
      x: 58, y: y - 31, size: infoSize, font, color: INK,
    });
  }
  y -= 76;

  page.drawRectangle({ x: 90, y, width: width - 180, height: 1.2, color: GOLD });
  y -= 24;

  // Tableau des lignes
  const left = 58;
  const right = width - 58;
  const col1 = left; // désignation
  // Colonnes numériques alignées à droite pour éviter tout chevauchement
  const colQuant = right - 190; // quantité
  const colUnit = right - 115; // prix unitaire
  const colTotal = right; // total
  const rowH = 19;

  const drawRight = (text: string, xRight: number, yy: number, size: number, f: PDFFont, color: ReturnType<typeof rgb>) => {
    page.drawText(text, { x: xRight - f.widthOfTextAtSize(text, size), y: yy, size, font: f, color });
  };

  // En-tête du tableau
  page.drawRectangle({ x: left - 6, y: y - rowH + 4, width: right - left + 12, height: rowH, color: PAPER_DARK });
  page.drawText("Désignation", { x: col1, y: y - 14, size: 10.5, font: bold, color: INK });
  drawRight("Quantité", colQuant, y - 14, 10.5, bold, INK);
  drawRight("Prix unitaire", colUnit, y - 14, 10.5, bold, INK);
  drawRight("Total", colTotal, y - 14, 10.5, bold, INK);
  y -= rowH + 6;

  for (const l of meta.lines) {
    page.drawText(l.productName, { x: col1, y: y - 12, size: 11, font, color: INK });
    drawRight(`${l.quantity}`, colQuant, y - 12, 11, font, INK);
    drawRight(fmtSeptims(l.unitPrice), colUnit, y - 12, 11, font, INK);
    drawRight(fmtSeptims(l.total), colTotal, y - 12, 11, bold, INK);
    y -= rowH + 2;
  }
  y -= 10;

  // Totaux
  page.drawText("Total à payer :", { x: right - 210, y: y - 12, size: 12.5, font: bold, color: INK });
  if (meta.discountPercent > 0) {
    page.drawText(`(remise ${meta.discountPercent} % incluse)`, {
      x: right - 210, y: y - 28, size: 9.5, font: italic, color: INK,
    });
  }
  drawRight(fmtSeptims(meta.total), colTotal, y - 12, 14, bold, RED);
  y -= 58;

  page.drawRectangle({ x: 90, y, width: width - 180, height: 1, color: GOLD });
  y -= 34;

  // Mention de paiement
  page.drawText(`Facture payée ce jour, le ${fmtDate(new Date().toISOString())}.`, {
    x: centerX - 160, y, size: 11, font: bold, color: INK,
  });
  y -= 32;

  // Signature
  page.drawText("Le propriétaire :", { x: right - 200, y, size: 10, font, color: INK });
  page.drawLine({ start: { x: right - 210, y: y - 18 }, end: { x: right - 40, y: y - 18 }, thickness: 0.8, color: INK });
  page.drawText("D'jack Borgne", { x: right - 168, y: y - 30, size: 15, font: italic, color: INK });
  page.drawText(`Propriétaire de la scierie de ${meta.sawmillAbbr === "RBO" ? "Rivebois" : "Pénombris"}`, {
    x: right - 208, y: y - 46, size: 9.5, font: italic, color: INK,
  });

  // Pied
  page.drawText("Registre des Scieries de Bordeciel — Bordeciel, 4E 201", {
    x: centerX - 140, y: 46, size: 9, font: italic, color: INK,
  });

  return doc.save();
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function buildPdf(meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  return drawLine(doc, font, bold, italic, meta);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Non authentifié." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Session invalide." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, name, sawmill_access")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profil introuvable." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Seul le chef / admin peut émettre une facture
    if (profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Seul le chef / admin peut émettre une facture." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const kind = body?.kind;
    const sourceId = body?.id;
    if (kind !== "sale" && kind !== "order") {
      return new Response(JSON.stringify({ error: "Type de source invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Données de la vente ou de la commande
    let sawmillId: string | undefined;
    let clientLabel = "";
    let sellerLabel: string | undefined;
    let discountPercent = 0;
    let total = 0;
    let date = "";
    let lines: PdfMeta["lines"] = [];

    if (kind === "sale") {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("id, sawmill_id, client_label, discount_percent, total, sold_by, created_at, status")
        .eq("id", sourceId)
        .maybeSingle();
      if (saleError || !sale) {
        return new Response(JSON.stringify({ error: "Vente introuvable." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (sale.status !== "validated") {
        return new Response(JSON.stringify({ error: "Seules les ventes validées peuvent être facturées." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sawmillId = sale.sawmill_id;
      // Sans nom enregistré, on facture quand même au nom générique « Client »
      clientLabel = sale.client_label?.trim() || "Client";
      discountPercent = Number(sale.discount_percent ?? 0);
      total = Number(sale.total ?? 0);
      date = sale.created_at;

      const { data: sellerRows } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", sale.sold_by)
        .maybeSingle();
      sellerLabel = sellerRows?.name;

      const { data: saleLines } = await supabase
        .from("sale_lines")
        .select("product_id, quantity, unit_price, total")
        .eq("sale_id", sale.id);
      const { data: productRows } = await supabase.from("products").select("id, name");
      const productName = new Map((productRows ?? []).map((p) => [p.id, p.name]));
      lines = (saleLines ?? []).map((l) => ({
        productName: productName.get(l.product_id) ?? "Produit inconnu",
        quantity: Number(l.quantity ?? 0),
        unitPrice: Number(l.unit_price ?? 0),
        total: Number(l.total ?? 0),
      }));
    } else {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, sawmill_id, client_id, client_entry_id, discount_percent, total, created_at, status")
        .eq("id", sourceId)
        .maybeSingle();
      if (orderError || !order) {
        return new Response(JSON.stringify({ error: "Commande introuvable." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (order.status !== "taken" && order.status !== "done") {
        return new Response(
          JSON.stringify({ error: "La commande doit être prise en charge (ou terminée) pour être facturée." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      sawmillId = order.sawmill_id;
      discountPercent = Number(order.discount_percent ?? 0);
      total = Number(order.total ?? 0);
      date = order.created_at;

      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", order.client_id)
        .maybeSingle();
      clientLabel = clientProfile?.name ?? "Client";

      const { data: itemRows } = await supabase.from("orders").select("items").eq("id", order.id).maybeSingle();
      const { data: productRows } = await supabase.from("products").select("id, name, sale_price");
      const productName = new Map((productRows ?? []).map((p) => [p.id, p.name]));
      const items = (itemRows?.items ?? []) as { productId: string; quantity: number }[];
      const prices = new Map((productRows ?? []).map((p) => [p.id, Number(p.sale_price ?? 0)]));
      const factor = 1 - discountPercent / 100;
      lines = items.map((it) => {
        const unit = Math.round((prices.get(it.productId) ?? 0) * factor * 100) / 100;
        return {
          productName: productName.get(it.productId) ?? "Produit inconnu",
          quantity: Number(it.quantity ?? 0),
          unitPrice: unit,
          total: Math.round(unit * Number(it.quantity ?? 0) * 100) / 100,
        };
      });
    }

    if (!sawmillId || !clientLabel.trim()) {
      return new Response(JSON.stringify({ error: "Nom du client manquant pour établir la facture." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sawmillRows } = await supabase
      .from("sawmills")
      .select("id, name")
      .eq("id", sawmillId)
      .maybeSingle();
    const sawmillName = sawmillRows?.name ?? "Scierie";
    const abbr = sawmillId === "rivebois" ? "RBO" : "PEN";

    // Facture déjà émise pour cette source ? (on la régénère sans dupliquer)
    let invoice: { invoice_no: string } | null = null;
    const { data: existing } = await supabase
      .from("invoices")
      .select("invoice_no")
      .eq("kind", kind)
      .eq("source_id", sourceId)
      .maybeSingle();
    if (existing) invoice = existing;

    if (!invoice) {
      const year = new Date().getUTCFullYear();
      const { data: yearRows } = await supabase
        .from("invoices")
        .select("invoice_no")
        .eq("sawmill_id", sawmillId);
      let max = 0;
      for (const r of yearRows ?? []) {
        const m = r.invoice_no.match(/^FV-[A-Z]+-\d+-(\d+)$/);
        if (m) max = Math.max(max, Number(m[1]));
      }
      const seq = String(max + 1).padStart(4, "0");
      invoice = { invoice_no: `FV-${abbr}-${year}-${seq}` };

      const { error: insertError } = await supabase.from("invoices").insert({
        invoice_no: invoice.invoice_no,
        sawmill_id: sawmillId,
        kind,
        source_id: sourceId,
        client_label: clientLabel.trim(),
        seller_label: sellerLabel || null,
        discount_percent: discountPercent,
        total,
        items: lines,
        issued_by: user.id,
        issued_at: new Date().toISOString(),
      });
      if (insertError) {
        return new Response(JSON.stringify({ error: `Échec de l'enregistrement de la facture : ${insertError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const pdf = await buildPdf({
      sawmillName,
      sawmillAbbr: abbr,
      invoiceNo: invoice.invoice_no,
      date: fmtDate(date),
      clientLabel: clientLabel.trim(),
      sellerLabel,
      kindLabel: kind === "sale" ? "Vente de charbon et de bois" : "Commande client",
      discountPercent,
      total,
      lines,
    });

    const fileName = `${invoice.invoice_no}.pdf`;
    return new Response(
      JSON.stringify({ ok: true, invoiceNo: invoice.invoice_no, fileName, pdfBase64: toBase64(pdf) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erreur inconnue." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
