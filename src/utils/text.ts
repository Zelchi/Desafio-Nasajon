// Normaliza texto para melhorar o matching:
// - remove acentos
// - converte para minúsculas
// - remove caracteres especiais
// - compacta espaços
export const normalizeText = (value: string): string => {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Distância de Levenshtein para comparar strings com erro de digitação.
export const levenshtein = (a: string, b: string): number => {
    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;

            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            );
        }
    }

    return dp[a.length][b.length];
}

// Retorna um valor entre 0 e 1.
// Quanto mais perto de 1, mais parecidas as strings são.
export const similarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const distance = levenshtein(a, b);
    return 1 - distance / Math.max(a.length, b.length);
}