import { normalizeText } from "./text";

// Parser CSV simples, com suporte a aspas.
export const parseCsv = (content: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let insideQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const next = content[i + 1];

        if (char === '"') {
            if (insideQuotes && next === '"') {
                currentField += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        if (char === "," && !insideQuotes) {
            currentRow.push(currentField);
            currentField = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (char === "\r" && next === "\n") {
                i++;
            }

            currentRow.push(currentField);
            currentField = "";

            if (currentRow.some((field) => field.length > 0)) {
                rows.push(currentRow);
            }

            currentRow = [];
            continue;
        }

        currentField += char;
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);

        if (currentRow.some((field) => field.length > 0)) {
            rows.push(currentRow);
        }
    }

    return rows;
}

// Escapa um campo para ser escrito corretamente no CSV.
export const escapeCsv = (value: string): string => {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
}

// Converte matriz de linhas para string CSV.
export const toCsv = (rows: string[][]): string => {
    return rows.map((row) => row.map((field) => escapeCsv(field ?? "")).join(",")).join("\n");
}

// Detecta se a primeira linha é cabeçalho.
export const hasHeader = (row: string[] | undefined): boolean => {
    if (!row || row.length < 2) return false;

    const first = normalizeText(row[0]);
    const second = normalizeText(row[1]);

    return (
        first.includes("municipio") ||
        first.includes("cidade") ||
        second.includes("populacao")
    );
}