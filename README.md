# Papelada HUB

Gerador dos documentos da enfermaria do HUB-UnB/EBSERH e da SES-DF: você preenche o paciente
uma vez, marca os documentos, confere a prévia e imprime. Os documentos saem **nos formulários
oficiais** (o PDF original preenchido), não em uma recriação.

**Feito por Caio César, Letícia Brandão e Malu — Turma 114.**

Inspirado no [gerador de alta da puérpera de João Gualda](https://joaogualda19.github.io/enfermaria.gohub/).
É um projeto novo, não um fork; a ideia de "preencher uma vez e gerar tudo" vem de lá.

## Privacidade

- Nenhum dado de paciente sai do navegador: não há servidor, analytics nem CDN.
- Os dados do paciente não são salvos (nem em localStorage): fechou a aba, sumiu.
- "Novo paciente" apaga tudo para o próximo atendimento.

## Documentos

| Documento | HUB | SES-DF |
|---|---|---|
| Sintomáticos (receituário, 2 vias) | ✔ | ✔ |
| Receituário de controle especial (2 vias) | ✔ | ✔ |
| Atestado | ✔ | — |
| Retorno (marcação de consulta) | ✔ | — |
| Pedido de parecer | ✔ | ✔ |
| Requisição de exames (meia folha) | ✔ | — |
| Reserva de sangue / requisição de transfusão | ✔ | ✔ (Hemocentro) |
| TCLE cirurgia | ✔ | — |
| TCLE transfusão | ✔ | — |
| Reserva de leito UTI | ✔ | — |

Atestado, requisição de exames e retorno ocupam meia folha: com "Juntar meias folhas" (ligado por
padrão), dois deles saem na mesma A4 para economizar papel.

Os PDFs vêm do espelho mantido pelo CAMed-UnB (https://www.camedunb.com/documentos-hub-ses),
que não é fonte oficial: confira a versão vigente na enfermaria. Origem e sha256 de cada
arquivo estão em [`forms.manifest.json`](forms.manifest.json).

## Modelos de receita e de TCLE

Ficam em [`src/presets/modelos.json`](src/presets/modelos.json). Para editar:

1. Abra **Modelos** no topo do site e edite (é um rascunho, só no seu navegador).
2. Clique em **Publicar no GitHub**: o conteúdo é copiado e o arquivo abre no GitHub.
3. Cole, clique em **Commit changes**. O site atualiza sozinho em 1–2 minutos.

Só quem tem permissão de escrita neste repositório consegue salvar. Os outros podem
propor a mudança, que o dono aprova ou recusa.

O conteúdo clínico dos modelos (doses, posologias, complicações) é escrito por quem usa; o app
não sugere nem completa doses.

## Desenvolvimento

```bash
npm install
npm run dev        # app em http://localhost:5173
npm test           # testes (Vitest)
npm run build      # site estático em dist/
npm run calibrate  # ferramenta para achar coordenadas (x, y) clicando no PDF
```

Um documento novo = um arquivo em `src/documents/` + o PDF em `public/forms/`
(contrato em [`CLAUDE.md`](CLAUDE.md)). O deploy no GitHub Pages é feito pela Action em
`.github/workflows/deploy.yml` a cada push na `main`.
