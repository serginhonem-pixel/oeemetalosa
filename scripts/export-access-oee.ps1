param(
  [string]$AccessPath = "C:\DadosVBA\BDMETALOSA.accdb",
  [string]$OutDir = "data-import"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $AccessPath)) {
  throw "Arquivo Access nao encontrado: $AccessPath"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

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

$connString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$AccessPath;Persist Security Info=False;"
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
    $dataIso = To-IsoDate $r[0]
    $maq = [string]$r[4]
    $cod = [string]$r[5]
    $desc = [string]$r[6]
    $qtd = 0
    if ($r[11] -ne $null -and $r[11].ToString() -ne "") {
      [void][int]::TryParse($r[11].ToString(), [ref]$qtd)
    }

    if ([string]::IsNullOrWhiteSpace($dataIso) -or [string]::IsNullOrWhiteSpace($cod) -or $qtd -le 0) {
      continue
    }

    $producaoRows += [PSCustomObject]@{
      DATA      = $dataIso
      MAQUINA   = if ([string]::IsNullOrWhiteSpace($maq)) { "" } else { $maq.Trim() }
      CODIGO    = $cod.Trim()
      QTD       = $qtd
      DESCRICAO = if ([string]::IsNullOrWhiteSpace($desc)) { "Item s/ descricao" } else { $desc.Trim() }
      DESTINO   = "Estoque"
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
    $dataIso = To-IsoDate $r[7]
    if ([string]::IsNullOrWhiteSpace($dataIso)) {
      $dataIso = To-IsoDate $r[9]
    }

    $inicio = To-HhMm $r[8]
    $fim = To-HhMm $r[10]

    $cod = [string]$r[0]
    $desc = [string]$r[1]
    $categoria = [string]$r[2]
    $maq = [string]$r[3]
    $obs = [string]$r[12]

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
