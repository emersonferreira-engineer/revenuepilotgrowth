export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

export const ORDERS_TEMPLATE_COLUMNS = [
  "order_id",
  "date",
  "customer_id",
  "product_id",
  "quantity",
  "unit_price",
  "channel",
] as const;

export const ORDERS_TEMPLATE_CSV = `order_id,date,customer_id,product_id,quantity,unit_price,channel
1001,2026-07-01,c-201,p-linho-01,1,489.00,paid
1002,2026-07-01,c-202,p-vela-07,2,99.00,email
1003,2026-07-02,c-203,p-tapete-08,1,399.00,organic
`;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  out.push(current.trim());
  return out;
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], errors: ["Arquivo vazio."] };
  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const rows: Record<string, string>[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    if (cells.length !== headers.length) {
      errors.push(`Linha ${i + 1}: esperava ${headers.length} colunas e encontrou ${cells.length}.`);
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cells[idx] ?? ""));
    rows.push(row);
  }
  return { headers, rows, errors };
}

export interface ValidationOutcome {
  validRows: Record<string, string>[];
  rowErrors: { line: number; message: string }[];
  missingColumns: string[];
}

export function validateOrdersCsv(parsed: CsvParseResult): ValidationOutcome {
  const missingColumns = ORDERS_TEMPLATE_COLUMNS.filter((c) => !parsed.headers.includes(c));
  const rowErrors: { line: number; message: string }[] = [];
  const validRows: Record<string, string>[] = [];
  if (missingColumns.length > 0) return { validRows, rowErrors, missingColumns };

  parsed.rows.forEach((row, idx) => {
    const line = idx + 2;
    const problems: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row["date"] ?? "")) problems.push("date deve estar em AAAA-MM-DD");
    if (!row["order_id"]) problems.push("order_id é obrigatório");
    if (!row["customer_id"]) problems.push("customer_id é obrigatório");
    if (!row["product_id"]) problems.push("product_id é obrigatório");
    const qty = Number(row["quantity"]);
    if (!Number.isFinite(qty) || qty <= 0) problems.push("quantity deve ser um número maior que zero");
    const price = Number(String(row["unit_price"] ?? "").replace(",", "."));
    if (!Number.isFinite(price) || price < 0) problems.push("unit_price deve ser numérico");
    if (!["paid", "organic", "email", "direct"].includes(row["channel"] ?? ""))
      problems.push("channel deve ser paid, organic, email ou direct");

    if (problems.length > 0) rowErrors.push({ line, message: problems.join("; ") });
    else validRows.push(row);
  });

  return { validRows, rowErrors, missingColumns };
}