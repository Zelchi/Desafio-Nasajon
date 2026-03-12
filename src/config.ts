import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// URL pública da API do IBGE.
export const IBGE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";

// Caminhos principais do projeto.
export const INPUT_PATH = resolve(process.cwd(), "input.csv");
export const OUTPUT_PATH = resolve(process.cwd(), "resultado.csv");
export const ENV_PATH = resolve(process.cwd(), ".env");

let envLoaded = false;

// Remove aspas do valor, se existirem.
const stripQuotes = (value: string): string => {
    const trimmed = value.trim();

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

// Carrega variáveis do .env sem depender de bibliotecas externas.
export const loadEnv = async (): Promise<void> => {
    if (envLoaded) return;
    envLoaded = true;

    try {
        const content = await readFile(ENV_PATH, "utf8");
        const lines = content.split(/\r?\n/);

        for (const rawLine of lines) {
            const line = rawLine.trim();

            // Ignora linhas vazias e comentários.
            if (!line || line.startsWith("#")) continue;

            const separatorIndex = line.indexOf("=");

            // Permite linhas inválidas sem quebrar a execução.
            if (separatorIndex === -1) continue;

            const key = line.slice(0, separatorIndex).trim();
            const value = stripQuotes(line.slice(separatorIndex + 1));

            if (key && !process.env[key]) {
                process.env[key] = value;
            }
        }
    } catch {
        console.log("Arquivo .env não encontrado.");
    }
}

type ConnectApiConfig = {
    backendUrl: string; accessToken: string;
}

// Lê a configuração usada no envio para a API de correção.
export const getConnectApiConfig = async (): Promise<ConnectApiConfig> => {
    await loadEnv();
    return {
        backendUrl: (process.env.BACKEND_URL ?? "").trim(),
        accessToken: (process.env.ACCESS_TOKEN ?? "").trim(),
    };
}