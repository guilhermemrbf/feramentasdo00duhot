import csv
import json


def csv_cell(value):
    text=str(value)
    # Spreadsheet applications may execute cells beginning with formula prefixes.
    return "'"+text if text.lstrip().startswith(('=','+','-','@','\t','\r')) else text


def export_edit_report(path,batch,items):
    """Operator-requested local report. No account, session or full message bodies."""
    with open(path,'w',encoding='utf-8-sig',newline='') as output:
        writer=csv.writer(output,delimiter=';')
        writer.writerow(['Análise','Canal','ID do canal','Novo destino','Post','Situação','Links alterados','Observação'])
        for item in items:
            writer.writerow([csv_cell(value) for value in (batch['id'],batch['title'],batch['channel'],batch['target'],item['message_id'],item['status'],len(json.loads(item['links'])),item['note'])])
