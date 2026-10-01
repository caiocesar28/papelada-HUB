/** Repositório onde os modelos são publicados (quem tem permissão de escrita pode editá-los). */
export const REPO = 'caiocesar28/papelada-HUB';
export const BRANCH = 'main';
export const ARQUIVO_MODELOS = 'src/presets/modelos.json';

/** Página de edição do arquivo de modelos no GitHub (pede login; só colaboradores fazem commit). */
export const URL_EDITAR_MODELOS = `https://github.com/${REPO}/edit/${BRANCH}/${ARQUIVO_MODELOS}`;
export const URL_REPO = `https://github.com/${REPO}`;
