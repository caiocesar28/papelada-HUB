# Papelada HUB — gerador de documentos da enfermaria

Ferramenta pessoal e informal para preencher os formulários oficiais do HUB-UnB/EBSERH
(e da SES-DF) a partir de um cadastro único do paciente. O fluxo é: preencher o paciente uma
vez, marcar os documentos, revisar e imprimir.

Inspirado no gerador de alta da puérpera de João Gualda
(https://joaogualda19.github.io/enfermaria.gohub/). É um projeto novo, não um fork, e deve dar o crédito a ele no README.

## Princípios inegociáveis

1. **Nenhum dado de paciente sai do navegador.** Sem backend, sem analytics, sem fontes
   ou scripts de CDN que recebam dados. Sem localStorage/IndexedDB para dados do paciente.
   Tudo some ao fechar a aba. O app deve mostrar isso de forma visível na tela.
2. **O formulário oficial é a fonte da verdade.** Os documentos são gerados sobrepondo
   texto ao PDF original (pdf-lib) ou preenchendo os campos AcroForm do PDF editável.
   Nunca recriar o layout em HTML.
3. **Texto de TCLE nunca é alterado.** Nos termos de consentimento, o app preenche apenas
   a identificação (nome, registro, data, procedimento, médico). O corpo do termo vem
   intacto do PDF.
4. **Nenhum conteúdo clínico inventado.** Doses, posologias, kits de receita e textos de
   orientação vêm SOMENTE de `src/presets/` escritos pelo usuário. Se um preset não
   existir, o campo fica em branco para preenchimento à mão. Claude não deve sugerir nem
   completar doses por conta própria.
5. **Antimicrobiano sai em 2 vias** (retenção na farmácia).

## Stack

- Vite + TypeScript, sem framework de UI (DOM puro ou lit-html, se ficar grande).
- `pdf-lib` para preencher e sobrepor PDFs e montar 2 documentos por A4 quando o formulário
  for meia-folha.
- Deploy estático no GitHub Pages (`vite build`, com `base` configurado).
- Testes: Vitest para regras e mapeamento de campos. Testes visuais por snapshot do PDF
  gerado (renderizado em PNG) para os documentos principais.

## Estrutura

```
public/forms/            PDFs oficiais (originais, nomes estáveis, sem editar)
src/patient.ts           modelo do paciente (campos comuns a todos os documentos)
src/documents/<id>.ts    um arquivo por documento (ver contrato abaixo)
src/presets/             conteúdo clínico escrito pelo usuário (kits de receita, orientações)
src/rules.ts             quais documentos são sugeridos a partir do contexto
src/render/              pdf-lib: preencher, sobrepor, juntar, 2-por-folha
tools/calibrate.html     página para descobrir coordenadas (x,y) clicando no PDF
forms.manifest.json      origem, data de download e sha256 de cada PDF
```

### Contrato de um documento

```ts
export const doc: DocumentDef = {
  id: 'tcle-transfusao',
  tipo: 'tcle-transfusao',   // tipo lógico da tela (src/tipos.ts); variantes HUB/SES compartilham
  hospital: ['HUB'],         // em quais hospitais esta variante vale
  title: 'TCLE — Transfusão',
  area: ['clinica', 'cirurgia'],
  form: 'forms/tcle-transfusao.pdf',
  mode: 'overlay' | 'acroform',
  copies: 1,                 // 2 para ATB
  viasNaFolha: 2,            // opcional: vias já impressas lado a lado na folha
  perSheet: 1 | 2,
  fields: [                  // overlay: coordenadas em pt; acroform: nome do campo
    { key: 'paciente.nome', name: 'Texto1' },
    { key: 'paciente.nome', page: 0, x: 120, y: 700, size: 10, se: 'doc.via2' },
  ],
  extraInputs: [...],        // campos específicos deste documento (aba do documento)
  calcular: (v, ctx) => ({ 'doc.x': '...' }), // opcional: valores derivados 'doc.*'
};
```

Chaves disponíveis: ver `valores()` em `src/patient.ts` (`paciente.*`, `hospital.nome`, `hoje.*`,
`extra.*`). Não há dados do médico: nome e CRM saem no carimbo. Arquivos `src/documents/_*.ts`
são auxiliares e não são registrados.

Adicionar um documento novo deve exigir apenas um arquivo em `src/documents/` e o PDF em
`public/forms/`.

## Documentos prioritários (MVP)

Fonte: https://www.camedunb.com/documentos-hub-ses (espelho mantido pelo CAMed, não é fonte
oficial; conferir a versão vigente na enfermaria antes de usar).

- TCLE cirurgia
- TCLE transfusão (ATENÇÃO: há dois arquivos, "TRANSFUSÃO" e "tcle transfusão"; confirmar qual vale)
- Receituário comum (sintomáticos)
- Prescrição/receita de ATB (2 vias)
- Requisição de transfusão / reserva de sangue (ATENÇÃO: há a versão Hemocentro e a do HUB)
- Orientações de alta: NÃO existe formulário na página; texto vem de `src/presets/orientacoes/`

## Atualização dos formulários

`npm run forms:check` baixa de novo os PDFs listados no manifest e compara o sha256. Se mudou,
avisa e marca o documento como "precisa recalibrar". Rodar periodicamente.

## Convenções

- Interface e código de domínio em português (nomes de campos clínicos), infraestrutura em inglês.
- Datas em dd/mm/aaaa, fuso America/Sao_Paulo.
- Pré-visualização obrigatória antes de imprimir; destacar campos que ficaram vazios.
- Modelos de receita/TCLE: fonte da verdade em `src/presets/modelos.json` (o app usa só ele).
  A página ADM (`adm.html`) edita um rascunho no localStorage de quem edita e publica copiando o
  JSON para o GitHub; só quem tem permissão de escrita no repositório faz o commit (deploy
  automático). Sem senha no código. Conteúdo clínico dos modelos é escrito pelo usuário.
