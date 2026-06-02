$headers = @{
  "Authorization" = "Bearer sb_publishable_pExllwJqej3PZyE0GFXlbw_5D1jIENZ"
  "apikey" = "sb_publishable_pExllwJqej3PZyE0GFXlbw_5D1jIENZ"
  "Prefer" = "resolution=merge-duplicates"
}

$body1 = @{
  event_slug = "raka-dina"
  name = "test-upsert-antigravity"
  image_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  output_format = "portrait"
  frame_fit = "cover"
} | ConvertTo-Json

$body2 = @{
  event_slug = "raka-dina"
  name = "test-upsert-antigravity"
  image_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==Updated"
  output_format = "portrait"
  frame_fit = "cover"
} | ConvertTo-Json

Write-Output "--- Testing First Insert ---"
try {
  $response = Invoke-RestMethod -Uri "https://bjjibgbwgvphysavutiw.supabase.co/rest/v1/twibbon_concepts?on_conflict=event_slug,name" -Method Post -Headers $headers -Body $body1 -ContentType "application/json"
  Write-Output "First insert succeeded."
} catch {
  Write-Output "First insert failed: $_"
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Output "Error: $($reader.ReadToEnd())"
  }
}

Write-Output "--- Testing Second Insert (Upsert with on_conflict) ---"
try {
  $response = Invoke-RestMethod -Uri "https://bjjibgbwgvphysavutiw.supabase.co/rest/v1/twibbon_concepts?on_conflict=event_slug,name" -Method Post -Headers $headers -Body $body2 -ContentType "application/json"
  Write-Output "Second insert (upsert) succeeded."
} catch {
  Write-Output "Second insert (upsert) failed: $_"
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Output "Error: $($reader.ReadToEnd())"
  }
}
