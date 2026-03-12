import type { ResultadoLinha, Stats } from "./types";
import type { FetchMunicipiosResult } from "./services/ibge";
import {
    analyzeMunicipioMatch,
    resolveAmbiguousMatch,
    type MatchContext,
} from "./services/ibge";

// Converte a população do CSV para número.
// Mantém tolerância para espaços e caracteres extras.
const parsePopulation = (value: string): number => {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : 0;
}

// Arredonda para 2 casas decimais.
const roundToTwo = (value: number): number => {
    return Math.round(value * 100) / 100;
}

// Processa o arquivo em duas etapas:
// 1. resolve os casos claros para montar um contexto confiável do lote
// 2. usa esse contexto apenas nos homônimos exatos
// Isso evita que um fuzzy match duvidoso entre como OK e distorça as estatísticas finais.
export const processRows = (
    dataRows: string[][],
    apiData: FetchMunicipiosResult,
): ResultadoLinha[] => {
    const validRows = dataRows.filter((row) => row.length >= 2);

    if (!apiData.ok) {
        return validRows.map((row) => ({
            municipio_input: (row[0] ?? "").trim(),
            populacao_input: (row[1] ?? "").trim(),
            municipio_ibge: "",
            uf: "",
            regiao: "",
            id_ibge: "",
            status: "ERRO_API",
        }));
    }

    const analyzedRows = validRows.map((row) => ({
        municipioInput: (row[0] ?? "").trim(),
        populacaoInput: (row[1] ?? "").trim(),
        analysis: analyzeMunicipioMatch(
            (row[0] ?? "").trim(),
            apiData.municipios,
            apiData.exactIndex,
        ),
    }));

    // O contexto nasce só com matches seguros.
    // Ele serve de pista para desempatar nomes repetidos como "Santo André".
    const context: MatchContext = {
        regionCounts: new Map(),
        ufCounts: new Map(),
    };

    for (const row of analyzedRows) {
        if (row.analysis.kind !== "resolved") {
            continue;
        }

        const { municipio } = row.analysis;

        if (municipio.regiao) {
            context.regionCounts.set(
                municipio.regiao,
                (context.regionCounts.get(municipio.regiao) ?? 0) + 1,
            );
        }

        if (municipio.uf) {
            context.ufCounts.set(
                municipio.uf,
                (context.ufCounts.get(municipio.uf) ?? 0) + 1,
            );
        }
    }

    return analyzedRows.map((row) => {
        const buildErrorRow = (status: ResultadoLinha["status"]): ResultadoLinha => ({
            municipio_input: row.municipioInput,
            populacao_input: row.populacaoInput,
            municipio_ibge: "",
            uf: "",
            regiao: "",
            id_ibge: "",
            status,
        });

        if (row.analysis.kind === "not_found") {
            return buildErrorRow("NAO_ENCONTRADO");
        }

        const resolved = row.analysis.kind === "resolved"
            ? { status: "OK" as const, municipio: row.analysis.municipio }
            : row.analysis.source === "exact"
                // Homônimos exatos podem ser resolvidos com contexto do lote.
                ? resolveAmbiguousMatch(row.analysis.candidates, context, apiData.ufCounts)
                // Ambiguidade fuzzy continua fora do conjunto OK para não inflar o resultado.
                : { status: "NAO_ENCONTRADO" as const };

        if (resolved.status !== "OK" || !resolved.municipio) {
            return buildErrorRow(resolved.status);
        }

        // Depois de resolver um homônimo exato, o contexto é atualizado para as próximas linhas.
        if (row.analysis.kind === "ambiguous") {
            if (resolved.municipio.regiao) {
                context.regionCounts.set(
                    resolved.municipio.regiao,
                    (context.regionCounts.get(resolved.municipio.regiao) ?? 0) + 1,
                );
            }

            if (resolved.municipio.uf) {
                context.ufCounts.set(
                    resolved.municipio.uf,
                    (context.ufCounts.get(resolved.municipio.uf) ?? 0) + 1,
                );
            }
        }

        return {
            municipio_input: row.municipioInput,
            populacao_input: row.populacaoInput,
            municipio_ibge: resolved.municipio.nome,
            uf: resolved.municipio.uf,
            regiao: resolved.municipio.regiao,
            id_ibge: String(resolved.municipio.idIbge),
            status: "OK",
        };
    });
}

// Calcula exatamente os agregados enviados para a API de correção.
// Apenas linhas com status OK entram em população total e médias por região.
export const calculateStats = (resultados: ResultadoLinha[]): Stats => {
    let total_ok = 0;
    let total_nao_encontrado = 0;
    let total_erro_api = 0;
    let pop_total_ok = 0;

    const totalsByRegion = new Map<string, { sum: number; count: number }>();

    for (const item of resultados) {
        if (item.status === "OK") {
            total_ok += 1;

            const population = parsePopulation(item.populacao_input);
            pop_total_ok += population;

            const region = item.regiao;
            const current = totalsByRegion.get(region) ?? { sum: 0, count: 0 };

            current.sum += population;
            current.count += 1;

            totalsByRegion.set(region, current);
            continue;
        }

        if (item.status === "NAO_ENCONTRADO" || item.status === "AMBIGUO") {
            total_nao_encontrado += 1;
            continue;
        }

        if (item.status === "ERRO_API") {
            total_erro_api += 1;
        }
    }

    const medias_por_regiao: Record<string, number> = {};

    for (const [region, values] of totalsByRegion.entries()) {
        medias_por_regiao[region] = roundToTwo(values.sum / values.count);
    }

    return {
        total_municipios: resultados.length,
        total_ok,
        total_nao_encontrado,
        total_erro_api,
        pop_total_ok,
        medias_por_regiao,
    };
}