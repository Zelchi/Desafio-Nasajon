import { getConnectApiConfig } from "../config";
import type { Stats, SubmissionResponse } from "../types";

// Envia as estatísticas para a API de correção.
export const submitStats = async (stats: Stats): Promise<SubmissionResponse> => {
    const { backendUrl, accessToken } = await getConnectApiConfig();

    if (!backendUrl) {
        throw new Error("BACKEND_URL nao configurado no .env.");
    }

    if (!accessToken) {
        throw new Error("ACCESS_TOKEN nao configurado no .env.");
    }

    const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ stats }),
    });

    if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Falha no envio (${response.status}): ${responseText}`);
    }

    return (await response.json()) as SubmissionResponse;
}