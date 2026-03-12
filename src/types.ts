// Status possíveis para cada linha processada.
export type Status = "OK" | "NAO_ENCONTRADO" | "ERRO_API" | "AMBIGUO";

// Estrutura retornada pela API de localidades do IBGE.
export type ApiMunicipio = {
    id: number;
    nome: string;
    microrregiao?: {
        mesorregiao?: {
            UF?: {
                sigla?: string;
                regiao?: {
                    nome?: string;
                };
            };
        };
    };
    "regiao-imediata"?: {
        "regiao-intermediaria"?: {
            UF?: {
                sigla?: string;
                regiao?: {
                    nome?: string;
                };
            };
        };
    };
};

// Estrutura interna normalizada para facilitar o matching.
export type MunicipioInfo = {
    idIbge: number;
    nome: string;
    uf: string;
    regiao: string;
    normalized: string;
};

// Linha final que será gravada no resultado.csv.
export type ResultadoLinha = {
    municipio_input: string;
    populacao_input: string;
    municipio_ibge: string;
    uf: string;
    regiao: string;
    id_ibge: string;
    status: Status;
};

// Estatísticas pedidas no desafio.
export type Stats = {
    total_municipios: number;
    total_ok: number;
    total_nao_encontrado: number;
    total_erro_api: number;
    pop_total_ok: number;
    medias_por_regiao: Record<string, number>;
};

// Resposta esperada da API de correção.
export type SubmissionResponse = {
    user_id: string;
    email: string;
    score: number;
    feedback: string;
    components?: Record<string, unknown>;
};