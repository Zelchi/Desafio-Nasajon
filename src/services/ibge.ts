import type { ApiMunicipio, MunicipioInfo, Status } from "../types";
import { normalizeText, similarity } from "../utils/text";
import { IBGE_URL } from "../config";

export type FetchMunicipiosResult = {
    ok: boolean;
    municipios: MunicipioInfo[];
    exactIndex: Map<string, MunicipioInfo[]>;
    ufCounts: Map<string, number>;
}

export type MatchAnalysis =
    | { kind: "resolved"; municipio: MunicipioInfo }
    | { kind: "not_found" }
    | {
        kind: "ambiguous";
        candidates: MunicipioInfo[];
        source: "exact" | "fuzzy";
    };

export type MatchContext = {
    regionCounts: Map<string, number>;
    ufCounts: Map<string, number>;
};

// Lê UF e região considerando formatos diferentes da API do IBGE.
const getUfAndRegion = (item: ApiMunicipio): { uf: string; regiao: string } => {
    const ufFromMicrorregiao = item.microrregiao?.mesorregiao?.UF;

    if (ufFromMicrorregiao?.sigla && ufFromMicrorregiao.regiao?.nome) {
        return {
            uf: ufFromMicrorregiao.sigla,
            regiao: ufFromMicrorregiao.regiao.nome,
        };
    }

    const ufFromRegiaoImediata = item["regiao-imediata"]?.["regiao-intermediaria"]?.UF;

    return {
        uf: ufFromRegiaoImediata?.sigla ?? "",
        regiao: ufFromRegiaoImediata?.regiao?.nome ?? "",
    };
}

// Normaliza a resposta do IBGE e prepara índices auxiliares.
// O contador por UF é usado depois como critério de desempate para nomes homônimos.
const buildMunicipios = (apiItems: ApiMunicipio[]): Omit<FetchMunicipiosResult, "ok"> => {
    const municipios: MunicipioInfo[] = apiItems.map((item) => {
        const { uf, regiao } = getUfAndRegion(item);

        return {
            idIbge: item.id,
            nome: item.nome,
            uf,
            regiao,
            normalized: normalizeText(item.nome),
        };
    });

    const exactIndex = new Map<string, MunicipioInfo[]>();
    const ufCounts = new Map<string, number>();

    for (const municipio of municipios) {
        const currentList = exactIndex.get(municipio.normalized) ?? [];
        currentList.push(municipio);
        exactIndex.set(municipio.normalized, currentList);

        if (municipio.uf) {
            ufCounts.set(municipio.uf, (ufCounts.get(municipio.uf) ?? 0) + 1);
        }
    }

    return { municipios, exactIndex, ufCounts };
}

// Busca todos os municípios na API do IBGE.
export const fetchMunicipios = async (): Promise<FetchMunicipiosResult> => {
    try {
        const response = await fetch(IBGE_URL);

        if (!response.ok) {
            return {
                ok: false,
                municipios: [],
                exactIndex: new Map(),
                ufCounts: new Map(),
            };
        }

        const data = (await response.json()) as ApiMunicipio[];
        const built = buildMunicipios(data);

        return {
            ok: true,
            municipios: built.municipios,
            exactIndex: built.exactIndex,
            ufCounts: built.ufCounts,
        };
    } catch {
        return {
            ok: false,
            municipios: [],
            exactIndex: new Map(),
            ufCounts: new Map(),
        };
    }
}

// Ordena candidatos ambíguos usando o contexto já resolvido do próprio arquivo.
// A ideia é favorecer a região/UF que já apareceu mais vezes entre os matches seguros.
const scoreCandidate = (
    municipio: MunicipioInfo,
    context: MatchContext,
    stateMunicipioCounts: Map<string, number>,
): [number, number, number, number] => {
    const regionCount = context.regionCounts.get(municipio.regiao) ?? 0;
    const ufCount = context.ufCounts.get(municipio.uf) ?? 0;
    const stateCount = stateMunicipioCounts.get(municipio.uf) ?? 0;

    return [regionCount, ufCount, stateCount, municipio.idIbge];
};

const compareScores = (
    left: [number, number, number, number],
    right: [number, number, number, number],
): number => {
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) {
            return left[index] - right[index];
        }
    }

    return 0;
};

const dedupeCandidates = (candidates: MunicipioInfo[]): MunicipioInfo[] => {
    const unique = new Map<number, MunicipioInfo>();

    for (const candidate of candidates) {
        unique.set(candidate.idIbge, candidate);
    }

    return [...unique.values()];
};

// Faz a análise inicial sem decidir tudo de uma vez.
// Primeiro tenta o match exato normalizado; se não houver, parte para fuzzy match.
// A saída diferencia ambiguidade exata de ambiguidade fuzzy porque elas têm tratamentos diferentes.
export const analyzeMunicipioMatch = (
    inputName: string,
    municipios: MunicipioInfo[],
    exactIndex: Map<string, MunicipioInfo[]>,
): MatchAnalysis => {
    const normalizedInput = normalizeText(inputName);

    if (!normalizedInput) {
        return { kind: "not_found" };
    }

    const exactMatches = exactIndex.get(normalizedInput) ?? [];

    if (exactMatches.length === 1) {
        return { kind: "resolved", municipio: exactMatches[0] };
    }

    if (exactMatches.length > 1) {
        return { kind: "ambiguous", candidates: exactMatches, source: "exact" };
    }

    const bestCandidates: MunicipioInfo[] = [];
    let bestScore = 0;
    let secondScore = 0;
    const epsilon = 1e-9;

    for (const municipio of municipios) {
        const score = similarity(normalizedInput, municipio.normalized);

        if (score > bestScore + epsilon) {
            secondScore = bestScore;
            bestScore = score;
            bestCandidates.length = 0;
            bestCandidates.push(municipio);
        } else if (Math.abs(score - bestScore) <= epsilon) {
            bestCandidates.push(municipio);
        } else if (score > secondScore) {
            secondScore = score;
        }
    }

    // O corte de 0.85 mantém erros pequenos como "Belo Horzionte"
    // e ainda evita aceitar aproximações muito soltas.
    if (bestCandidates.length === 0 || bestScore < 0.85) {
        return { kind: "not_found" };
    }

    const uniqueBestCandidates = dedupeCandidates(bestCandidates);

    if (uniqueBestCandidates.length === 1 && bestScore - secondScore > 0.015) {
        return { kind: "resolved", municipio: uniqueBestCandidates[0] };
    }

    // Quando o melhor resultado não se destaca com folga, deixamos a decisão para a fase seguinte.
    return {
        kind: "ambiguous",
        candidates: uniqueBestCandidates,
        source: "fuzzy",
    };
}

// Resolve apenas ambiguidades reais de homônimos exatos.
// Se dois municípios têm o mesmo nome oficial, usamos o contexto do lote para escolher o mais coerente.
// Se ainda houver empate total, a linha continua ambígua.
export const resolveAmbiguousMatch = (
    candidates: MunicipioInfo[],
    context: MatchContext,
    stateMunicipioCounts: Map<string, number>,
): { status: Status; municipio?: MunicipioInfo } => {
    if (candidates.length === 0) {
        return { status: "NAO_ENCONTRADO" };
    }

    if (candidates.length === 1) {
        return { status: "OK", municipio: candidates[0] };
    }

    const ranked = dedupeCandidates(candidates)
        .map((municipio) => ({
            municipio,
            score: scoreCandidate(municipio, context, stateMunicipioCounts),
        }))
        .sort((left, right) => compareScores(right.score, left.score));

    if (ranked.length === 1) {
        return { status: "OK", municipio: ranked[0].municipio };
    }

    if (compareScores(ranked[0].score, ranked[1].score) === 0) {
        return { status: "AMBIGUO" };
    }

    return { status: "OK", municipio: ranked[0].municipio };
}