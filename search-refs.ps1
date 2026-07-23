$f = 'C:\Users\Extra Terrestrial\Downloads\scholars-circle-main\scholars-circle-main\src\features\McqQuizRunner.jsx'
$matches = Select-String -Path $f -Pattern 'Next|Previous|Skip|currentIndex|setCurrentIndex|onBack|switchMode'
foreach ($m in $matches) { Write-Output ("L" + $m.LineNumber + ": " + $m.Line.Trim()) }
