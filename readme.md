## Desafio Nasajon

Aplicação em TypeScript que lê um `input.csv`, enriquece os municípios com dados do IBGE, gera um `resultado.csv`, calcula estatísticas e envia essas estatísticas para a API de correção autenticada com `ACCESS_TOKEN`.

## Como rodar

1. Configure no `.env` as variáveis `BACKEND_URL` e `ACCESS_TOKEN`.
2. Execute `yarn dev` para processar o arquivo e enviar as estatísticas.
3. Execute `yarn build` para gerar o bundle em `dist/`.

## Ciclo de vida do sistema

1. O ponto de entrada em `index.ts` carrega `src/app.ts`.
2. `src/app.ts` lê o `input.csv` e usa `src/utils/csv.ts` para identificar o cabeçalho e transformar o conteúdo em linhas.
3. `src/services/ibge.ts` consulta a API pública de municípios do IBGE, normaliza os registros e monta índices auxiliares para busca.
4. `src/stats.ts` processa cada linha do input e tenta resolver o município em duas etapas:
	- primeiro faz match exato normalizado;
	- se não houver match exato, usa similaridade textual para tolerar acentos, caixa e erros pequenos de digitação.
5. Quando existem nomes oficiais duplicados no IBGE, a resolução usa o contexto das linhas já resolvidas no próprio lote para escolher a UF/região mais coerente.
6. Ambiguidades vindas de fuzzy match não entram automaticamente como `OK`; elas ficam fora do conjunto válido para evitar distorção nas estatísticas.
7. Depois do enriquecimento, `src/app.ts` grava o `resultado.csv` com as colunas pedidas no desafio.
8. `src/stats.ts` calcula os agregados finais:
	- `total_municipios`
	- `total_ok`
	- `total_nao_encontrado`
	- `total_erro_api`
	- `pop_total_ok`
	- `medias_por_regiao`
9. `src/services/submission.ts` envia o JSON `{ "stats": ... }` para a Edge Function com `Authorization: Bearer <ACCESS_TOKEN>`.
10. A resposta da API é impressa no console com `score` e `feedback`.

## Decisões técnicas principais

- Normalização textual para remover acentos, padronizar caixa e reduzir ruído de entrada.
- Fuzzy matching com corte mínimo para recuperar erros pequenos como `Belo Horzionte` sem aceitar aproximações muito fracas.
- Separação entre ambiguidade exata e ambiguidade fuzzy para não transformar palpites fracos em `OK`.
- Resolução de homônimos com contexto do próprio arquivo, o que permitiu chegar ao resultado final aceito pela correção.
- Cálculo das estatísticas apenas com linhas `OK`, preservando aderência ao enunciado.

## Resultado final

Com a estratégia atual, o sistema gera o `resultado.csv`, calcula as estatísticas esperadas e retorna nota máxima na API de correção.
