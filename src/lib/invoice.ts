import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface InvoicePdfResult {
  ok: boolean;
  invoiceNo: string;
  fileName: string;
  pdfBase64: string;
}

/** Demande à la fonction backend d'émettre (ou de récupérer) la facture d'une vente ou commande. */
export async function generateInvoice(
  kind: "sale" | "order",
  id: string
): Promise<InvoicePdfResult> {
  const { data, error } = await supabase.functions.invoke("invoice-pdf", {
    body: { kind, id },
  });
  if (error) {
    // La fonction a répondu avec un statut non-2xx : on remonte son message réel
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { error?: string };
        throw new Error(body?.error || error.message);
      } catch {
        throw new Error(error.message);
      }
    }
    throw new Error(error.message || "Impossible de joindre le service de facturation.");
  }
  if (!data || data.ok !== true) {
    throw new Error(data?.error || "La facture n'a pas pu être générée.");
  }
  return data as InvoicePdfResult;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function downloadInvoicePdf(result: InvoicePdfResult): void {
  const blob = new Blob([base64ToBytes(result.pdfBase64)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.fileName || `${result.invoiceNo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
