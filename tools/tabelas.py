"""
Gera as tabelas de procedimentos (SIGTAP) e CID-10 usadas pela APAC.

Uso:
    python tools/tabelas.py                 # baixa a competência mais recente do DATASUS
    python tools/tabelas.py caminho.zip     # usa um TabelaUnificada_AAAAMM_*.zip já baixado

Fonte: Tabela Unificada de Procedimentos do SUS (SIGTAP/DATASUS),
ftp://ftp2.datasus.gov.br/pub/sistemas/tup/downloads/ — dados públicos do Ministério da Saúde.
Só biblioteca padrão do Python.

Saída (public/tabelas/):
    procedimentos-apac.json  [[codigo, nome, principal(1/0)], ...]  registros 06/07 (APAC)
    cid10.json               [[codigo, nome], ...]                  tb_cid do SIGTAP (CID-10 do SUS)
    compat-apac.json         {codigo_procedimento: [cid, ...]}      CIDs compatíveis (rl_procedimento_cid)
    tabelas.manifest.json    origem, competência, sha256 do zip, data de geração
"""
import datetime
import hashlib
import io
import json
import pathlib
import re
import sys
import urllib.request
import zipfile

FTP = 'ftp://ftp2.datasus.gov.br/pub/sistemas/tup/downloads/'
SAIDA = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'tabelas'


def ultimo_pacote() -> str:
    with urllib.request.urlopen(FTP, timeout=60) as r:
        listagem = r.read().decode('latin1')
    nomes = sorted(set(re.findall(r'TabelaUnificada_\d{6}_v\d+\.zip', listagem)))
    if not nomes:
        sys.exit('nenhum TabelaUnificada_*.zip encontrado no FTP do DATASUS')
    return FTP + nomes[-1]


def linhas(zf: zipfile.ZipFile, nome: str) -> list[str]:
    # Os arquivos do SIGTAP vêm em Windows-1252, com campos de largura fixa.
    return zf.read(nome).decode('cp1252').splitlines()


def gravar(nome: str, dados) -> None:
    caminho = SAIDA / nome
    caminho.write_text(json.dumps(dados, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'  {caminho.relative_to(SAIDA.parent.parent)}  {caminho.stat().st_size // 1024} KB')


def main() -> None:
    if len(sys.argv) > 1:
        origem = sys.argv[1]
        conteudo = pathlib.Path(origem).read_bytes()
    else:
        origem = ultimo_pacote()
        print('baixando', origem)
        with urllib.request.urlopen(origem, timeout=300) as r:
            conteudo = r.read()

    zf = zipfile.ZipFile(io.BytesIO(conteudo))
    competencia = linhas(zf, 'tb_registro.txt')[0][52:58]

    registros: dict[str, set[str]] = {}
    for l in linhas(zf, 'rl_procedimento_registro.txt'):
        registros.setdefault(l[:10], set()).add(l[10:12])
    apac = {c for c, r in registros.items() if r & {'06', '07'}}
    principal = {c for c, r in registros.items() if '06' in r}

    nomes = {l[:10]: l[10:260].strip() for l in linhas(zf, 'tb_procedimento.txt')}
    procedimentos = [[c, nomes[c], 1 if c in principal else 0] for c in sorted(apac) if c in nomes]

    cids = [[l[:4].strip(), l[4:104].strip()] for l in linhas(zf, 'tb_cid.txt')]

    compat: dict[str, list[str]] = {}
    for l in linhas(zf, 'rl_procedimento_cid.txt'):
        if l[:10] in apac:
            compat.setdefault(l[:10], []).append(l[10:14].strip())

    SAIDA.mkdir(parents=True, exist_ok=True)
    print(f'competência {competencia}: {len(procedimentos)} procedimentos de APAC, {len(cids)} CIDs')
    gravar('procedimentos-apac.json', procedimentos)
    gravar('cid10.json', cids)
    gravar('compat-apac.json', compat)
    gravar(
        'tabelas.manifest.json',
        {
            'fonte': 'SIGTAP/DATASUS — Tabela Unificada de Procedimentos do SUS',
            'origem': origem if origem.startswith('ftp') else pathlib.Path(origem).name,
            'competencia': competencia,
            'sha256': hashlib.sha256(conteudo).hexdigest(),
            'geradoEm': datetime.date.today().isoformat(),
            'procedimentos': len(procedimentos),
            'cids': len(cids),
        },
    )


if __name__ == '__main__':
    main()
