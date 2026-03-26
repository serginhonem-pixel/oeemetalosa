param(
  [string]$AccessPath = "C:\DadosVBA\BDMETALOSA.accdb",
  [string]$OutDir = "data-import"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $AccessPath)) {
  throw "Arquivo Access nao encontrado: $AccessPath"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Normalize-AccessName {
  param([string]$value)
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  return ($value.ToUpperInvariant() -replace '[^A-Z0-9]', '')
}

function Get-RowValue {
  param(
    [System.Data.DataRow]$Row,
    [string[]]$Candidates,
    [object]$Fallback = $null
  )

  foreach ($candidate in ($Candidates | Where-Object { $_ })) {
    $target = Normalize-AccessName $candidate
    foreach ($col in $Row.Table.Columns) {
      if ((Normalize-AccessName $col.ColumnName) -eq $target) {
        return $Row[$col.ColumnName]
      }
    }
  }

  return $Fallback
}

function To-IsoDate {
  param($value)
  if ($null -eq $value) { return $null }
  try {
    return ([DateTime]$value).ToString("yyyy-MM-dd")
  } catch {
    return $null
  }
}

function To-HhMm {
  param($value)
  if ($null -eq $value) { return $null }
  try {
    return ([DateTime]$value).ToString("HH:mm")
  } catch {
    return $null
  }
}

$connString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$AccessPath;Mode=Share Deny None;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connString)
$conn.Open()

try {
  $prodCmd = $conn.CreateCommand()
  $prodCmd.CommandText = "SELECT * FROM [Producao]"
  $prodDa = New-Object System.Data.OleDb.OleDbDataAdapter($prodCmd)
  $prodDt = New-Object System.Data.DataTable
  [void]$prodDa.Fill($prodDt)

  $producaoRows = @()
  foreach ($r in $prodDt.Rows) {
    $dataIso = To-IsoDate (Get-RowValue $r @("DATA", "DATA_PRODUCAO", "DATAAPONTAMENTO") $r[0])
    $maq = [string](Get-RowValue $r @("MAQUINA", "EQUIPAMENTO", "NOME_MAQUINA") $r[4])
    $cod = [string](Get-RowValue $r @("CODIGO", "COD", "COD_PRODUTO", "PRODUTO") $r[5])
    $desc = [string](Get-RowValue $r @("DESCRICAO", "DESC", "PRODUTO_DESC") $r[6])
    $destino = [string](Get-RowValue $r @("DESTINO", "CLIENTE", "LOCAL_DESTINO") "Estoque")
    $qtd = 0
    $qtdRaw = Get-RowValue $r @("QTD", "QUANTIDADE", "PECAS", "PEÇAS") $r[11]
    if ($qtdRaw -ne $null -and $qtdRaw.ToString() -ne "") {
      [void][int]::TryParse($qtdRaw.ToString(), [ref]$qtd)
    }
    $comp = [string](Get-RowValue $r @("COMP", "COMPRIMENTO", "COMP_METROS", "METROS"))
    $pesoTotal = [string](Get-RowValue $r @("PESO_TOTAL", "PESOTOTAL", "PESO", "KG"))

    if ([string]::IsNullOrWhiteSpace($dataIso) -or [string]::IsNullOrWhiteSpace($cod) -or $qtd -le 0) {
      continue
    }

    $producaoRows += [PSCustomObject]@{
      DATA      = $dataIso
      MAQUINA   = if ([string]::IsNullOrWhiteSpace($maq)) { "" } else { $maq.Trim() }
      CODIGO    = $cod.Trim()
      QTD       = $qtd
      DESCRICAO = if ([string]::IsNullOrWhiteSpace($desc)) { "Item s/ descricao" } else { $desc.Trim() }
      DESTINO   = if ([string]::IsNullOrWhiteSpace($destino)) { "Estoque" } else { $destino.Trim() }
      COMP      = if ([string]::IsNullOrWhiteSpace($comp)) { "" } else { $comp.Trim() }
      PESO_TOTAL = if ([string]::IsNullOrWhiteSpace($pesoTotal)) { "" } else { $pesoTotal.Trim() }
    }
  }

  $parCmd = $conn.CreateCommand()
  $parCmd.CommandText = "SELECT * FROM [Apontamento]"
  $parDa = New-Object System.Data.OleDb.OleDbDataAdapter($parCmd)
  $parDt = New-Object System.Data.DataTable
  [void]$parDa.Fill($parDt)

  $paradasRows = @()
  foreach ($r in $parDt.Rows) {
    # Layout da tabela Apontamento (ordinal):
    # 0 Codigo, 1 Descricao, 2 Categoria, 7 Data Inicial, 8 Hora Inicial,
    # 9 Data Final, 10 Hora Final, 12 Comentarios
    $dataIso = To-IsoDate (Get-RowValue $r @("DATA", "DATA_INICIAL", "DATA_FINAL") $r[7])
    if ([string]::IsNullOrWhiteSpace($dataIso)) {
      $dataIso = To-IsoDate (Get-RowValue $r @("DATA_FINAL") $r[9])
    }

    $inicio = To-HhMm (Get-RowValue $r @("INICIO", "HORA_INICIAL", "HORAINICIAL") $r[8])
    $fim = To-HhMm (Get-RowValue $r @("FIM", "HORA_FINAL", "HORAFINAL") $r[10])

    $cod = [string](Get-RowValue $r @("COD_MOTIVO", "CODIGO", "COD") $r[0])
    $desc = [string](Get-RowValue $r @("DESC", "DESCRICAO") $r[1])
    $categoria = [string](Get-RowValue $r @("GRUPO", "CATEGORIA", "TIPO") $r[2])
    $maq = [string](Get-RowValue $r @("MAQUINA", "EQUIPAMENTO", "NOME_MAQUINA") $r[3])
    $obs = [string](Get-RowValue $r @("OBS", "OBSERVACAO", "COMENTARIOS") $r[12])

    if (
      [string]::IsNullOrWhiteSpace($dataIso) -or
      [string]::IsNullOrWhiteSpace($inicio) -or
      [string]::IsNullOrWhiteSpace($fim) -or
      [string]::IsNullOrWhiteSpace($cod)
    ) {
      continue
    }

    $paradasRows += [PSCustomObject]@{
      DATA       = $dataIso
      MAQUINA    = if ([string]::IsNullOrWhiteSpace($maq)) { "" } else { $maq.Trim() }
      INICIO     = $inicio
      FIM        = $fim
      COD_MOTIVO = $cod.Trim()
      DESC       = if ([string]::IsNullOrWhiteSpace($desc)) { "" } else { $desc.Trim() }
      GRUPO      = if ([string]::IsNullOrWhiteSpace($categoria)) { "" } else { $categoria.Trim() }
      OBS        = if ([string]::IsNullOrWhiteSpace($obs)) { "" } else { $obs.Trim() }
    }
  }

  $prodCsv = Join-Path $OutDir "import_producao.csv"
  $parCsv = Join-Path $OutDir "import_paradas.csv"

  $producaoRows | Export-Csv -Path $prodCsv -NoTypeInformation -Encoding UTF8
  $paradasRows | Export-Csv -Path $parCsv -NoTypeInformation -Encoding UTF8

  $summary = [PSCustomObject]@{
    accessPath = $AccessPath
    geradoEm = (Get-Date).ToString("s")
    producao = [PSCustomObject]@{
      total = $producaoRows.Count
      arquivo = $prodCsv
      minData = ($producaoRows | Measure-Object DATA -Minimum).Minimum
      maxData = ($producaoRows | Measure-Object DATA -Maximum).Maximum
      totalPecas = ($producaoRows | Measure-Object QTD -Sum).Sum
    }
    paradas = [PSCustomObject]@{
      total = $paradasRows.Count
      arquivo = $parCsv
      minData = ($paradasRows | Measure-Object DATA -Minimum).Minimum
      maxData = ($paradasRows | Measure-Object DATA -Maximum).Maximum
    }
  }

  $summaryPath = Join-Path $OutDir "resumo_import_access.json"
  $summary | ConvertTo-Json -Depth 6 | Set-Content -Path $summaryPath -Encoding UTF8

  Write-Output ("Producao pronta: " + $prodCsv + " (" + $producaoRows.Count + " linhas)")
  Write-Output ("Paradas prontas: " + $parCsv + " (" + $paradasRows.Count + " linhas)")
  Write-Output ("Resumo: " + $summaryPath)
}
finally {
  $conn.Close()
}
