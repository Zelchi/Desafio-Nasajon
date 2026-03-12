import { readFile, writeFile } from "node:fs/promises";
import { INPUT_PATH, OUTPUT_PATH } from "./config";
import { fetchMunicipios } from "./services/ibge";
import { submitStats } from "./services/submission";
import { calculateStats, processRows } from "./stats";
import { hasHeader, parseCsv, toCsv } from "./utils/csv";

// Monta as linhas finais do CSV de saída.
const buildOutputRows = (resultados: ReturnType<typeof processRows>): string[][] => {
    return [
        ["municipio_input", "populacao_input", "municipio_ibge", "uf", "regiao", "id_ibge", "status"],
        ...resultados.map((item) => [
            item.municipio_input,
            item.populacao_input,
            item.municipio_ibge,
            item.uf,
            item.regiao,
            item.id_ibge,
            item.status,
        ]),
    ];
}

// Fluxo principal:
// 1. lê input.csv
// 2. consulta API do IBGE
// 3. gera resultado.csv
// 4. calcula stats
// 5. envia stats para a API de correção
const main = async (): Promise<void> => {
    const inputContent = await readFile(INPUT_PATH, "utf8");
    const rows = parseCsv(inputContent);
    const dataRows = hasHeader(rows[0]) ? rows.slice(1) : rows;

    const apiData = await fetchMunicipios();
    const resultados = processRows(dataRows, apiData);
    const outputRows = buildOutputRows(resultados);
    const stats = calculateStats(resultados);

    await writeFile(OUTPUT_PATH, toCsv(outputRows), "utf8");

    console.log(`Arquivo gerado em: ${OUTPUT_PATH}`);
    console.log("Stats calculadas:");
    console.log(JSON.stringify({ stats }, null, 2));

    // O envio é feito no final, sem impedir a geração do CSV caso falhe.
    try {
        const submission = await submitStats(stats);
        console.log(`Score: ${submission.score}`);
        console.log(`Feedback: ${submission.feedback}`);
    } catch (error) {
        console.error(
            "Falha ao enviar estatisticas:",
            error instanceof Error ? error.message : error,
        );
    }
}

main().catch((error) => {
    console.error("Erro ao processar arquivo:", error);
    process.exitCode = 1;
});