# Presets clínicos

Conteúdo clínico (kits de receita, posologias, modelos de TCLE) escrito e revisado pelo
usuário. É a ÚNICA fonte desse tipo de texto no app (princípio 4 do CLAUDE.md):

- Se não houver preset, o campo fica em branco para preenchimento à mão.
- Não gerar, sugerir nem completar doses automaticamente.

`modelos.json` guarda os modelos de receita e de TCLE usados pelo app. Edite pela página
**Modelos** (`adm.html`) e publique com "Publicar no GitHub": só quem tem permissão de escrita
no repositório consegue fazer o commit, e o site é republicado automaticamente.

Em cada item de receita, `quantidade` é um texto livre ("20 comprimidos", "1 frasco") que sai
na linha 1 ligado por tracejado ("Dipirona 500 mg ------ 20 comprimidos"). Não há cálculo a
partir de dose, frequência ou dias: o número é sempre o que o usuário escreveu.
