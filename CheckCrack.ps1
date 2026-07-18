
# Che do kiem thu tu dong (mac dinh tat)
$testMode = $false

# Thiet lap bang ma UTF-8 cho console de hien thi tieng Viet co dau
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Clear-Host
Write-Host '   ____ _               _     ____                 _      ' -ForegroundColor Cyan
Write-Host '  / ___| |__   ___  ___| | __/ ___|_ __ __ _  ___| | __  ' -ForegroundColor Cyan
Write-Host ' | |   | ''_ \ / _ \/ __| |/ / |   | ''__/ _` |/ __| |/ /  ' -ForegroundColor Cyan
Write-Host ' | |___| | | |  __/ (__|   <| |___| | | (_| | (__|   <   ' -ForegroundColor Cyan
Write-Host '  \____|_| |_|\___|\___|_|\_\\____|_|  \__,_|\___|_|\_\  ' -ForegroundColor Cyan
Write-Host "                                                         " -ForegroundColor Cyan
Write-Host "  CONG CU KIEM TRA CRACK & BAN QUYEN WINDOWS/OFFICE" -ForegroundColor White
Write-Host "                 Developed by TRANHUYTRUNGTAMMMO"               -ForegroundColor White
Write-Host "========================================================================" -ForegroundColor Gray
Write-Host ""
Write-Host "[*] Dang quet he thong va thu thap du lieu phan cung/ban quyen. Vui long cho..." -ForegroundColor Yellow

# ========================================================================
# 1. THU THAP THONG TIN PHAN CUNG (HARDWARE INFO)
# ========================================================================

# Mainboard
$boardObj = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
$motherboard = "Khong xac dinh"
if ($boardObj) {
    $motherboard = "$($boardObj.Manufacturer.Trim()) $($boardObj.Product.Trim())"
}

# CPU
$cpuObj = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue
$cpuName = "Khong xac dinh"
$cpuCores = 0
$cpuThreads = 0
if ($cpuObj) {
    $cpuName = ($cpuObj.Name -replace '\s+', ' ').Trim()
    $cpuCores = $cpuObj.NumberOfCores
    $cpuThreads = $cpuObj.NumberOfLogicalProcessors
}

# RAM
$memDevices = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue
$ramTotalBytes = 0
$ramSpeed = 0
$ramSlots = 0
if ($memDevices) {
    $ramSlots = ($memDevices | Measure-Object).Count
    foreach ($mem in $memDevices) {
        $ramTotalBytes += $mem.Capacity
        if ($mem.Speed -gt $ramSpeed) { $ramSpeed = $mem.Speed }
    }
}
$ramTotalGB = [Math]::Round($ramTotalBytes / 1GB, 1)

# GPU
$gpuDevices = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue
$gpuNames = @()
if ($gpuDevices) {
    foreach ($gpu in $gpuDevices) {
        $gpuNames += $gpu.Name.Trim()
    }
}
$gpuStr = if ($gpuNames.Count -gt 0) { $gpuNames -join " / " } else { "Khong xac dinh" }

# Disk Drives (HDD/SSD)
$disks = @()
$disksObj = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue
if ($disksObj) {
    foreach ($disk in $disksObj) {
        $sizeGB = [Math]::Round($disk.Size / 1GB, 1)
        $pDisk = Get-CimInstance -Namespace ROOT/Microsoft/Windows/Storage -ClassName MSFT_PhysicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.DeviceId -eq $disk.Index -or $_.FriendlyName -eq $disk.Model -or $_.PhysicalDiskId -eq $disk.Index }
        if ($pDisk) {
            if ($pDisk.MediaType -eq 3) { $mediaType = "HDD" }
            elseif ($pDisk.MediaType -eq 4) { $mediaType = "SSD" }
            elseif ($pDisk.MediaType -eq 5) { $mediaType = "SCM" }
            elseif ($pDisk.SpindleSpeed -eq 0) { $mediaType = "SSD" }
            elseif ($pDisk.SpindleSpeed -gt 0) { $mediaType = "HDD" }
            else {
                $modelLower = $disk.Model.ToLower()
                if ($modelLower -like "*ssd*" -or $modelLower -like "*nvme*" -or $modelLower -like "*solid state*" -or $modelLower -like "*esd*" -or $modelLower -like "*emmc*") {
                    $mediaType = "SSD"
                } else {
                    $mediaType = "HDD"
                }
            }
        } else {
            $modelLower = $disk.Model.ToLower()
            if ($modelLower -like "*ssd*" -or $modelLower -like "*nvme*" -or $modelLower -like "*solid state*" -or $modelLower -like "*esd*" -or $modelLower -like "*emmc*") {
                $mediaType = "SSD"
            } else {
                $mediaType = "HDD"
            }
        }
        $disks += "$($disk.Model.Trim()) ($sizeGB GB - $mediaType)"
    }
}
$diskStr = if ($disks.Count -gt 0) { $disks -join ", " } else { "Khong xac dinh" }


# ========================================================================
# 2. THU THAP THONG TIN BAN QUYEN (LICENSING INFO)
# ========================================================================

# He dieu hanh Windows
$osObj = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
$winEdition = "Khong xac dinh"
if ($osObj) {
    $winEdition = $osObj.Caption.Trim()
}

# Kiem tra he dieu hanh tuy bien (Win Lite / Playbook)
$isCustomOS = $false
$customOSName = ""
$customOSFolders = @{
    "C:\Windows\Atlas" = "AtlasOS"
    "C:\ProgramData\Atlas" = "AtlasOS"
    "C:\Windows\Revision" = "ReviOS"
    "C:\ProgramData\Revision" = "ReviOS"
    "C:\Atlas" = "AtlasOS"
    "C:\ReviOS" = "ReviOS"
}
foreach ($folder in $customOSFolders.Keys) {
    if (Test-Path $folder) {
        $isCustomOS = $true
        $customOSName = $customOSFolders[$folder]
        break
    }
}
if (-not $isCustomOS) {
    $customOSRegistry = @{
        "HKLM:\SOFTWARE\AtlasOS" = "AtlasOS"
        "HKLM:\SOFTWARE\Atlas" = "AtlasOS"
        "HKLM:\SOFTWARE\Revision" = "ReviOS"
        "HKLM:\SOFTWARE\ReviOS" = "ReviOS"
    }
    foreach ($reg in $customOSRegistry.Keys) {
        if (Test-Path $reg) {
            $isCustomOS = $true
            $customOSName = $customOSRegistry[$reg]
            break
        }
    }
}
if ($isCustomOS) {
    $winEdition = "$winEdition ($customOSName Custom Edition)"
}

# UEFI BIOS Key
$oemKey = "Khong tim thay"
$oemKeyRaw = (Get-CimInstance SoftwareLicensingService -ErrorAction SilentlyContinue).OA3xOriginalProductKey
if ($oemKeyRaw -and $oemKeyRaw.Trim() -ne "") {
    $oemKey = $oemKeyRaw.Trim()
}

# Registry Decoded Product Key (Windows 10/11)
function Get-DecodedRegistryKey {
    try {
        $regPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
        $digitalProductId = (Get-ItemProperty -Path $regPath -Name "DigitalProductId" -ErrorAction SilentlyContinue).DigitalProductId
        if (-not $digitalProductId -or $digitalProductId.Count -lt 67) { return "Khong tim thay" }
        
        $isWin8 = ([System.Math]::Truncate($digitalProductId[66] / 6)) -band 1
        $digitalProductId[66] = ($digitalProductId[66] -band 0xF7) -bor (($isWin8 -band 2) * 4)
        
        $chars = "BCDFGHJKMPQRTVWXY2346789"
        $keyOffset = 52
        $productKey = ""
        $last = 0
        
        for ($i = 24; $i -ge 0; $i--) {
            $current = 0
            for ($j = 14; $j -ge 0; $j--) {
                $current = $current * 256
                $current = $digitalProductId[$j + $keyOffset] + $current
                $digitalProductId[$j + $keyOffset] = [System.Math]::Truncate($current / 24)
                $current = $current % 24
            }
            $productKey = $chars[$current] + $productKey
            $last = $current
        }
        
        if ($isWin8 -eq 1) {
            $keypart1 = $productKey.Substring(1, $last)
            $keypart2 = $productKey.Substring($last + 1, $productKey.Length - ($last + 1))
            $productKey = $keypart1 + "N" + $keypart2
        }
        
        $formattedKey = ""
        for ($i = 0; $i -lt 25; $i++) {
            $formattedKey += $productKey[$i]
            if (($i + 1) % 5 -eq 0 -and ($i -ne 24)) {
                $formattedKey += "-"
            }
        }
        return $formattedKey
    } catch {
        return "Khong the giai ma (Registry bi an)"
    }
}
$registryKey = Get-DecodedRegistryKey

# Trang thai kich hoat va Kenh phan phoi Windows
$winStatus = "Khong xac dinh"
$winChannel = "Khong xac dinh"
$winIsKMS = $false
$winIsKMS38 = $false
$winKmsServer = ""
$winKmsPort = 0
$winGraceMinutes = 0

$winLicObj = Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "ApplicationID = '55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue | Where-Object { $_.LicenseStatus -eq 1 }
if (-not $winLicObj) {
    $winLicObj = Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "ApplicationID = '55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue | Select-Object -First 1
}

if ($winLicObj) {
    $statusMap = @{
        0 = "Chua kich hoat (Unlicensed)"
        1 = "Da kich hoat (Licensed)"
        2 = "Thoi gian an han (OOB Grace)"
        3 = "Thoi gian gia han (OOT Grace)"
        4 = "Het han han phi ban quyen (Non-Genuine Grace)"
        5 = "Trang thai thong bao (Notification)"
        6 = "Thoi gian gia han mo rong (Extended Grace)"
    }
    $winStatus = $statusMap[[int]$winLicObj.LicenseStatus]
    if (-not $winStatus) { $winStatus = "Chua kich hoat" }
    
    $desc = $winLicObj.Description
    if ($desc -like "*RETAIL*") { $winChannel = "Retail Channel (Ban le)" }
    elseif ($desc -like "*OEM*") { $winChannel = "OEM Channel (Nha san xuat)" }
    elseif ($desc -like "*VOLUME_MAK*") { $winChannel = "Volume:MAK (Khoa kich hoat nhieu lan)" }
    elseif ($desc -like "*VOLUME_KMS*") { 
        $winChannel = "Volume:GVLK (KMS Client)" 
        $winIsKMS = $true
    } else {
        $winChannel = "Volume Channel (Doanh nghiep)"
    }
    
    if ($winLicObj.KeyManagementServiceMachine) {
        $winKmsServer = $winLicObj.KeyManagementServiceMachine
        $winKmsPort = $winLicObj.KeyManagementServicePort
    }
    
    $winGraceMinutes = $winLicObj.GracePeriodRemaining
    if ($winIsKMS -and $winGraceMinutes -gt 1000000) {
        $winIsKMS38 = $true
    }
}

# Truy van thong tin Microsoft Office
$officeProducts = @()
$offLicObj = Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "ApplicationID = '0ff1ce15-a989-479d-afc2-fb5b53c84000' AND PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue
if ($offLicObj) {
    foreach ($obj in $offLicObj) {
        $statusText = if ($obj.LicenseStatus -eq 1) { "Da kich hoat" } else { "Chua kich hoat" }
        $officeProducts += [PSCustomObject]@{
            Name = $obj.Name
            Status = $statusText
            Description = $obj.Description
            KmsServer = $obj.KeyManagementServiceMachine
        }
    }
}
$offOspObj = Get-CimInstance -ClassName OfficeSoftwareProtectionProduct -Filter "PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue
if ($offOspObj) {
    foreach ($obj in $offOspObj) {
        $statusText = if ($obj.LicenseStatus -eq 1) { "Da kich hoat" } else { "Chua kich hoat" }
        $officeProducts += [PSCustomObject]@{
            Name = $obj.Name
            Status = $statusText
            Description = $obj.Description
            KmsServer = $obj.KeyManagementServiceMachine
        }
    }
}

# Kiem tra Microsoft 365 / Office 365 Click-to-Run
$ctrConfigPath = "HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration"
if (Test-Path $ctrConfigPath) {
    $releaseIds = (Get-ItemProperty -Path $ctrConfigPath -Name "ProductReleaseIds" -ErrorAction SilentlyContinue).ProductReleaseIds
    if ($releaseIds) {
        $m365Edition = if ($releaseIds -like "*O365*") { "Microsoft 365 ($releaseIds)" } else { "Microsoft Office ($releaseIds)" }
        
        $licensesFolder = "$env:localappdata\Microsoft\Office\Licenses"
        $licensingFolder2 = "$env:localappdata\Microsoft\Office\Licensing"
        $hasLicenseFiles = $false
        if (Test-Path $licensesFolder) {
            $files = Get-ChildItem -Path $licensesFolder -Filter "*.lic" -ErrorAction SilentlyContinue
            if ($files -and $files.Count -gt 0) { $hasLicenseFiles = $true }
        }
        if (-not $hasLicenseFiles -and (Test-Path $licensingFolder2)) {
            $files = Get-ChildItem -Path $licensingFolder2 -Recurse -ErrorAction SilentlyContinue
            if ($files -and $files.Count -gt 0) { $hasLicenseFiles = $true }
        }
        
        $licNextPath = "HKCU:\SOFTWARE\Microsoft\Office\16.0\Common\Licensing\LicensingNext"
        $hasLicNext = Test-Path $licNextPath
        
        if ($hasLicenseFiles -or $hasLicNext) {
            $m365Status = "Da kich hoat (Subscription / Ban quyen theo tai khoan)"
            
            $alreadyExists = $false
            foreach ($off in $officeProducts) {
                if ($off.Name -like "*$releaseIds*" -or $off.Name -like "*O365*") { $alreadyExists = $true; break }
            }
            if (-not $alreadyExists) {
                $officeProducts += [PSCustomObject]@{
                    Name = $m365Edition
                    Status = $m365Status
                    Description = "Microsoft 365 Apps Subscription"
                    KmsServer = ""
                }
            }
        }
    }
}


# Danh sach cac Product Key mac dinh
$genericKeys = @{
    "VK7JG-NPHTM-C97JM-9MPGT-3V66T" = "Khoa mac dinh Win 10/11 Pro (Kich hoat ban quyen so - MAS HWID)"
    "2B87N-8KFHP-DKV6R-Y2C8J-PKCKT" = "Khoa mac dinh Win 10/11 Pro N (Kich hoat ban quyen so - MAS HWID)"
    "DXG7C-N36C4-C4HTG-X4T3X-2YV77" = "Khoa mac dinh Win 10/11 Pro Workstations (Kich hoat ban quyen so - MAS HWID)"
    "YTMG3-N6DKC-DKB77-7M9GH-8HVX7" = "Khoa mac dinh Win 10/11 Home (Kich hoat ban quyen so - MAS HWID)"
    "4CPRK-NM3K3-X6XXQ-RXX86-WXCHW" = "Khoa mac dinh Win 10/11 Home N (Kich hoat ban quyen so - MAS HWID)"
    "BT79Q-G7N6G-PGBYW-4YWX6-6F4BT" = "Khoa mac dinh Win 10/11 Home Single Language (Kich hoat ban quyen so - MAS HWID)"
    "NPPR9-FWDCX-D2C8J-H872K-2YT43" = "Khoa mac dinh Win 10/11 Enterprise (KMS / GVLK)"
    "DPH2V-TTNVB-4X9Q3-TJR4H-KHJW4" = "Khoa mac dinh Win 10/11 Enterprise N (KMS / GVLK)"
    "NW6C2-QMPVW-D7KKK-3GKT6-VCFB2" = "Khoa mac dinh Win 10/11 Education (KMS / GVLK)"
    "2WH4N-8QGBV-H22JP-CT43Q-MDWWJ" = "Khoa mac dinh Win 10/11 Education N (KMS / GVLK)"
}

# ========================================================================
# 3. QUET VA PHAT HIEN CONG CU CRACK (CRACK SCANNING LOGIC)
# ========================================================================

$scanResults = @()
$domainJoined = (Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue).PartOfDomain

# --- CHECK 1: Cau hinh KMS Server trong Registry (Windows & Office) ---
$kmsRegWindows = ""
$kmsRegOffice = ""

if (Test-Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform") {
    $kmsRegWindows = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform" -Name "KeyManagementServiceServer" -ErrorAction SilentlyContinue).KeyManagementServiceServer
}
if (Test-Path "HKLM:\SOFTWARE\Microsoft\OfficeSoftwareProtectionPlatform") {
    $kmsRegOffice = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\OfficeSoftwareProtectionPlatform" -Name "KeyManagementServiceServer" -ErrorAction SilentlyContinue).KeyManagementServiceServer
}
if (-not $kmsRegOffice -and (Test-Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\OfficeSoftwareProtectionPlatform")) {
    $kmsRegOffice = (Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\OfficeSoftwareProtectionPlatform" -Name "KeyManagementServiceServer" -ErrorAction SilentlyContinue).KeyManagementServiceServer
}

function Analyze-KmsServer {
    param([string]$server, [string]$source, [bool]$reportClean = $true)
    if ($server -and $server.Trim() -ne "") {
        $srv = $server.ToLower().Trim()
        if ($srv -eq "127.0.0.1" -or $srv -eq "localhost" -or $srv -eq "::1") {
            return [PSCustomObject]@{
                Name = "May chu KMS ($source)"
                Status = "CRACK"
                Details = "Phat hien may chu KMS noi bo (loopback: $server). Day la dau hieu cua KMS Emulator cuc bo."
            }
        }
        if (-not $domainJoined) {
            return [PSCustomObject]@{
                Name = "May chu KMS ($source)"
                Status = "WARNING"
                Details = "Phat hien may chu KMS tu xa ($server) nhung may tinh khong thuoc Domain cong ty. Rat co the la KMS cong cu dung de crack."
            }
        } else {
            return [PSCustomObject]@{
                Name = "May chu KMS ($source)"
                Status = "OK"
                Details = "Su dung may chu KMS doanh nghiep ($server) thong qua ket noi Domain chinh chu."
            }
        }
    }
    if ($reportClean) {
        return [PSCustomObject]@{
            Name = "May chu KMS ($source)"
            Status = "OK"
            Details = "Sach (Khong cau hinh may chu KMS)"
        }
    }
    return $null
}

$scanResults += Analyze-KmsServer -server $kmsRegWindows -source "Windows Registry" -reportClean $true
$scanResults += Analyze-KmsServer -server $kmsRegOffice -source "Office Registry" -reportClean $true

$wmiWinResult = Analyze-KmsServer -server $winKmsServer -source "Windows WMI" -reportClean $false
if ($wmiWinResult) { $scanResults += $wmiWinResult }

if ($officeProducts) {
    foreach ($off in $officeProducts) {
        if ($off.KmsServer) {
            $wmiOffResult = Analyze-KmsServer -server $off.KmsServer -source "Office WMI ($($off.Name))" -reportClean $false
            if ($wmiOffResult) { $scanResults += $wmiOffResult }
        }
    }
}

# --- CHECK: Kenh ban quyen doanh nghiep tren may ca nhan ---
if ($winIsKMS) {
    if (-not $domainJoined) {
        $scanResults += [PSCustomObject]@{
            Name = "Kenh ban quyen Windows"
            Status = "WARNING"
            Details = "May tinh dang dung khoa KMS Doanh nghiep (Volume:GVLK) nhung khong gia nhap Domain cong ty. Day thuong la dau hieu kich hoat lau qua tool KMS."
        }
    } else {
        $scanResults += [PSCustomObject]@{
            Name = "Kenh ban quyen Windows"
            Status = "OK"
            Details = "Ban quyen KMS Doanh nghiep (Volume:GVLK) hop le trong mang noi bo cong ty."
        }
    }
}

$officeKmsLau = $false
$officeKmsDetails = ""
if ($officeProducts) {
    foreach ($off in $officeProducts) {
        if ($off.Description -like "*KMS*" -or $off.KmsServer) {
            if (-not $domainJoined) {
                $officeKmsLau = $true
                $officeKmsDetails += "Phat hien Office [$($off.Name)] kich hoat qua KMS tren may ca nhan. "
            }
        }
    }
}
if ($officeKmsLau) {
    $scanResults += [PSCustomObject]@{
        Name = "Kenh ban quyen Office"
        Status = "WARNING"
        Details = $officeKmsDetails + "Kich hoat KMS danh cho to chuc nhung khong thuoc Domain doanh nghiep."
    }
}

# --- CHECK 2: Kiem tra KMS38 ---
if ($winIsKMS38) {
    $scanResults += [PSCustomObject]@{
        Name = "Kich hoat dang KMS38"
        Status = "CRACK"
        Details = "Phat hien ban quyen kich hoat bang phuong phap hack KMS38 (Gia han thoi gian dung thu cua KMS toi ngay 19/01/2038, thoi gian con lai: $winGraceMinutes phut)."
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Kich hoat dang KMS38"
        Status = "OK"
        Details = "Sach (Khong phat hien hack thoi gian KMS38)"
    }
}

# --- CHECK 3: Kiem tra tep tin KMS Hook ---
$kmsHookDetected = $false
$hookDetails = ""
$hookFiles = @(
    "C:\Windows\System32\SppExtComObjHook.dll",
    "C:\Windows\SppExtComObjHook.dll"
)
foreach ($file in $hookFiles) {
    if (Test-Path $file) {
        $sig = Get-AuthenticodeSignature -FilePath $file -ErrorAction SilentlyContinue
        if ($sig.Status -ne "Valid" -or $sig.SignerCertificate.Subject -notlike "*Microsoft*") {
            $kmsHookDetected = $true
            $hookDetails += "Phat hien tep hook [$file] khong co chu ky so hop le cua Microsoft. "
        }
    }
}

if ($kmsHookDetected) {
    $scanResults += [PSCustomObject]@{
        Name = "Tep tin KMS Hook he thong"
        Status = "CRACK"
        Details = $hookDetails
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Tep tin KMS Hook he thong"
        Status = "OK"
        Details = "Sach (Khong phat hien file hook SppExtComObjHook.dll)"
    }
}

# --- CHECK 4: Kiem tra Office Ohook ---
$ohookDetected = $false
$ohookDetails = ""
$officeInstallFolder = ""
if (Test-Path "HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration") {
    $officeInstallFolder = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration" -Name "InstallFolder" -ErrorAction SilentlyContinue).InstallFolder
}
$officeSppcPaths = @()
if ($officeInstallFolder) {
    $officeSppcPaths += Join-Path $officeInstallFolder "root\vfs\System\sppc.dll"
}
$officeSppcPaths += "$env:ProgramFiles\Microsoft Office\root\vfs\System\sppc.dll"
$officeSppcPaths += "${env:ProgramFiles(x86)}\Microsoft Office\root\vfs\System\sppc.dll"
$officeSppcPaths = $officeSppcPaths | Select-Object -Unique
foreach ($file in $officeSppcPaths) {
    if (Test-Path $file) {
        $sig = Get-AuthenticodeSignature -FilePath $file -ErrorAction SilentlyContinue
        if ($sig.Status -ne "Valid" -or $sig.SignerCertificate.Subject -notlike "*Microsoft*") {
            $ohookDetected = $true
            $ohookDetails += "Phat hien tep tin sppc.dll gia tao tai [$file] (Khong co chu ky so cua Microsoft). Day la cong cu Ohook kich hoat lau Office."
        }
    }
}

$resiliencyPath = "HKCU:\Software\Microsoft\Office\16.0\Common\Licensing\Resiliency"
if (Test-Path $resiliencyPath) {
    $heartbeat = (Get-ItemProperty -Path $resiliencyPath -Name "TimeOfLastHeartbeatFailure" -ErrorAction SilentlyContinue).TimeOfLastHeartbeatFailure
    if ($heartbeat) {
        if ($heartbeat -like "*203*" -or $heartbeat -like "*204*" -or $heartbeat -like "*205*") {
            $ohookDetected = $true
            $ohookDetails += "Phat hien cau hinh Resiliency tat kiem tra ban quyen cua Ohook trong Registry (TimeOfLastHeartbeatFailure: $heartbeat). "
        }
    }
}

if ($ohookDetected) {
    $scanResults += [PSCustomObject]@{
        Name = "Tep & Registry Office Ohook"
        Status = "CRACK"
        Details = $ohookDetails
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Tep & Registry Office Ohook"
        Status = "OK"
        Details = "Sach (Khong phat hien dau vet sppc.dll gia tao hoac cau hinh Resiliency lau)"
    }
}

# --- CHECK 5: Kiem tra Registry IFEO ---
$ifeoDetected = $false
$ifeoDetails = ""
$ifeoPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\SppExtComObj.exe",
    "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\osppsvc.exe"
)
foreach ($path in $ifeoPaths) {
    if (Test-Path $path) {
        $props = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
        if ($props.Debugger -or $props.VerifierDlls -or $props.MonitorProcess) {
            $ifeoDetected = $true
            $val = if ($props.Debugger) { "Debugger=" + $props.Debugger } else { "VerifierDlls=" + $props.VerifierDlls }
            $ifeoDetails += "Phat hien cau hinh chuyen huong tai [$(Split-Path $path -Leaf)]: $val. "
        }
    }
}

if ($ifeoDetected) {
    $scanResults += [PSCustomObject]@{
        Name = "Registry IFEO Hijack"
        Status = "CRACK"
        Details = $ifeoDetails + "Day la ky thuat chiem quyen kiem soat tien trinh kich hoat nham be khoa ban quyen."
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Registry IFEO Hijack"
        Status = "OK"
        Details = "Sach (Khong phat hien khoa chuyen huong tien trinh kich hoat)"
    }
}

# --- CHECK 6: Kiem tra Tac vu tu dong chay ---
$detectedTasks = @()
$suspiciousTaskNames = @("AutoKMS", "KMSAuto", "KMSConnectionMonitor", "KMS-Activator", "MAS_KMS", "KMSeldi")
$tasksList = Get-ScheduledTask -ErrorAction SilentlyContinue
if ($tasksList) {
    foreach ($task in $tasksList) {
        $isMatch = $false
        foreach ($name in $suspiciousTaskNames) {
            if ($task.TaskName -like "*$name*") {
                $isMatch = $true
                break
            }
        }
        if (-not $isMatch) {
            try {
                $execStr = ($task.Actions.Execute -join " ").ToLower()
                foreach ($name in $suspiciousTaskNames) {
                    if ($execStr -like "*$($name.ToLower())*") {
                        $isMatch = $true
                        break
                    }
                }
            } catch {}
        }
        if ($isMatch) {
            $detectedTasks += "$($task.TaskPath)$($task.TaskName)"
        }
    }
}

if ($detectedTasks.Count -gt 0) {
    $scanResults += [PSCustomObject]@{
        Name = "Tac vu an gia han kich hoat"
        Status = "CRACK"
        Details = "Phat hien tac vu tu dong chay cua cong cu crack: " + ($detectedTasks -join ", ")
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Tac vu an gia han kich hoat"
        Status = "OK"
        Details = "Sach (Khong phat hien tac vu tu dong gia han KMS lau)"
    }
}

# --- CHECK 7: Kiem tra Dich vu Windows ---
$detectedServices = @()
$suspiciousServices = @("AutoKMS", "KMSpico Service", "KMSeldi")
foreach ($srvName in $suspiciousServices) {
    $srvObj = Get-Service -Name $srvName -ErrorAction SilentlyContinue
    if (-not $srvObj) {
        $srvObj = Get-Service -DisplayName $srvName -ErrorAction SilentlyContinue
    }
    if ($srvObj) {
        $detectedServices += "$($srvObj.Name) ($($srvObj.Status))"
    }
}

if ($detectedServices.Count -gt 0) {
    $scanResults += [PSCustomObject]@{
        Name = "Dich vu crack chay ngam"
        Status = "CRACK"
        Details = "Phat hien dich vu be khoa ban quyen: " + ($detectedServices -join ", ")
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Dich vu crack chay ngam"
        Status = "OK"
        Details = "Sach (Khong phat hien dich vu be khoa chay ngam)"
    }
}

# --- CHECK 8: Kiem tra Lich su yeu cau KMS ---
$kmsEventServers = @()
try {
    $events = Get-WinEvent -FilterHashtable @{LogName='Application'; Id=12288} -MaxEvents 50 -ErrorAction SilentlyContinue
    if ($events) {
        foreach ($ev in $events) {
            $msg = $ev.Message
            if ($msg -match '(?i)([a-zA-Z0-9\.\-_]+):1688') {
                $server = $Matches[1].Trim().ToLower()
                if ($server -and $server -notlike "*microsoft*" -and $server -notlike "*windows*") {
                    $kmsEventServers += [PSCustomObject]@{
                        Server = $server
                        Time = $ev.TimeCreated
                        Provider = $ev.ProviderName
                    }
                }
            }
        }
    }
} catch {}

$uniqueKmsServers = @()
if ($kmsEventServers.Count -gt 0) {
    $groups = $kmsEventServers | Group-Object Server
    foreach ($gp in $groups) {
        $latest = $gp.Group | Sort-Object Time -Descending | Select-Object -First 1
        $uniqueKmsServers += $latest
    }
}

$historyKmsDetected = $false
$historyKmsDetails = ""
$historyStatus = "OK"

if ($uniqueKmsServers.Count -gt 0) {
    foreach ($item in $uniqueKmsServers) {
        $srv = $item.Server
        $timeStr = $item.Time.ToString("dd/MM/yyyy HH:mm:ss")
        if ($srv -eq "127.0.0.1" -or $srv -eq "localhost" -or $srv -eq "::1") {
            $historyKmsDetected = $true
            $historyStatus = "CRACK"
            $historyKmsDetails += "Tung yeu cau toi KMS gia lap cuc bo ($srv) luc $timeStr. "
        } else {
            if (-not $domainJoined) {
                $historyKmsDetected = $true
                if ($srv -like "*msguides*" -or $srv -like "*digiboy*" -or $srv -like "*cangshui*" -or $srv -like "*loli.best*" -or $srv -like "*shuax*" -or $srv -like "*chinancce*") {
                    $historyStatus = "CRACK"
                    $historyKmsDetails += "Tung kich hoat qua KMS lau cong cu ($srv) luc $timeStr. "
                } else {
                    if ($historyStatus -ne "CRACK") { $historyStatus = "WARNING" }
                    $historyKmsDetails += "Tung gui yeu cau toi may chu KMS la ($srv) luc $timeStr. "
                }
            }
        }
    }
}

if ($historyKmsDetected) {
    $scanResults += [PSCustomObject]@{
        Name = "Lich su yeu cau KMS lau (Event Log)"
        Status = $historyStatus
        Details = $historyKmsDetails
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Lich su yeu cau KMS lau (Event Log)"
        Status = "OK"
        Details = "Sach (Khong phat hien lich su gui yeu cau toi may chu KMS lau)"
    }
}

# --- CHECK 9: Kiem tra Lich su lenh PowerShell ---
$psHistoryPath = "$env:APPDATA\Microsoft\Windows\PowerShell\PSReadline\ConsoleHost_history.txt"
$historyFound = $false
$historyDetails = ""
$historyScanStatus = "OK"

if (Test-Path $psHistoryPath) {
    $historyLines = Get-Content -Path $psHistoryPath -ErrorAction SilentlyContinue
    if ($historyLines) {
        $masCommands = @()
        foreach ($line in $historyLines) {
            if ($line -like "*activated.win*" -or $line -like "*massgrave*" -or $line -like "*massgravel*" -or $line -like "*ohook*") {
                $masCommands += $line.Trim()
            }
        }
        if ($masCommands.Count -gt 0) {
            $historyFound = $true
            $historyScanStatus = "WARNING"
            $uniqueCmds = $masCommands | Select-Object -Unique -First 3
            $historyDetails = "Phat hien vet chay MAS/Ohook trong lich su go lenh: " + ($uniqueCmds -join " | ")
        }
    }
}

if ($historyFound) {
    $scanResults += [PSCustomObject]@{
        Name = "Lich su go lenh Terminal (PSReadline)"
        Status = $historyScanStatus
        Details = $historyDetails
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Lich su go lenh Terminal (PSReadline)"
        Status = "OK"
        Details = "Sach (Khong phat hien lenh kich hoat lau trong lich su go phim)"
    }
}

# --- CHECK 10: Kiem tra Windows Defender ---
$defenderDisabled = $false
$defenderDetails = ""
$defenderPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender"
$realtimePath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection"
$disableAntiSpyware = $null
$disableRealtime = $null
if (Test-Path $defenderPath) {
    $disableAntiSpyware = (Get-ItemProperty -Path $defenderPath -Name "DisableAntiSpyware" -ErrorAction SilentlyContinue).DisableAntiSpyware
}
if (Test-Path $realtimePath) {
    $disableRealtime = (Get-ItemProperty -Path $realtimePath -Name "DisableRealtimeMonitoring" -ErrorAction SilentlyContinue).DisableRealtimeMonitoring
}
if ($disableAntiSpyware -eq 1 -or $disableRealtime -eq 1) {
    $defenderDisabled = $true
    $defenderDetails = "Windows Defender bi vo hieu hoa qua Registry Policies (DisableAntiSpyware=$disableAntiSpyware, DisableRealtimeMonitoring=$disableRealtime). Day la hanh vi dac trung cua cac ban Windows Lite (AtlasOS, Tiny11) hoac do bo be khoa tu dong tat de tranh bi diet."
}
if ($defenderDisabled) {
    $scanResults += [PSCustomObject]@{
        Name = "Trang thai bao mat Windows Defender"
        Status = "WARNING"
        Details = $defenderDetails
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Trang thai bao mat Windows Defender"
        Status = "OK"
        Details = "Sach (Windows Defender hoat dong binh thuong, khong bi chan qua Registry)"
    }
}

# --- CHECK 11: Kiem tra Dich vu Ban quyen Windows (sppsvc) ---
$sppsvc = Get-Service -Name sppsvc -ErrorAction SilentlyContinue
if ($sppsvc) {
    if ($sppsvc.StartType -eq "Disabled") {
        $scanResults += [PSCustomObject]@{
            Name = "Dich vu ban quyen Windows (sppsvc)"
            Status = "WARNING"
            Details = "Dich vu bao ve ban quyen (sppsvc) bi VO HIEU HOA (Disabled). Day la dac trung cua cac ban Windows Lite/Debloated nham chan Windows tu dong kiem tra ban quyen."
        }
    } else {
        $scanResults += [PSCustomObject]@{
            Name = "Dich vu ban quyen Windows (sppsvc)"
            Status = "OK"
            Details = "Sach (Dich vu ban quyen sppsvc hoat dong binh thuong: $($sppsvc.Status))"
        }
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Dich vu ban quyen Windows (sppsvc)"
        Status = "WARNING"
        Details = "Khong tim thay dich vu ban quyen he thong (sppsvc) tren may. Co kha nang day la ban Windows Lite tuyen bien da bi loc bo sau."
    }
}

# --- CHECK 12: Kiem tra Dau vet ban quyen so cu (MAS HWID) ---
$masFootprintDetected = $false
$masFootprintDetails = ""
if ($winStatus -like "*Da kich hoat*" -and $genericKeys.ContainsKey($registryKey)) {
    if ($oemKey -eq "Khong tim thay") {
        $masFootprintDetected = $true
        $masFootprintDetails = "He thong tu dong nhan dien Ban quyen so (Digital License) thong qua khoa mac dinh nhung bo mach chu (BIOS OEM) khong co ban quyen goc di kem. Rat co the may da tung chay bo kich hoat lau MAS HWID de dang ky ID phan cung nay tren may chu Microsoft."
    } else {
        if ($registryKey -ne $oemKey) {
            $masFootprintDetected = $true
            $masFootprintDetails = "He thong dang chay ban quyen nang cap qua khoa mac dinh khac voi khoa ban quyen goc theo phan cung BIOS. Neu khong mua giay phep nang cap chinh hang, may da tung chay MAS HWID de nap khoa ao nang cap he dieu hanh."
        }
    }
}
if ($masFootprintDetected) {
    $scanResults += [PSCustomObject]@{
        Name = "Dau vet ban quyen so (MAS HWID cu)"
        Status = "WARNING"
        Details = $masFootprintDetails
    }
} else {
    $scanResults += [PSCustomObject]@{
        Name = "Dau vet ban quyen so (MAS HWID cu)"
        Status = "OK"
        Details = "Sach (Ban quyen trung khop voi phan cung goc hoac chua kich hoat)"
    }
}


# ========================================================================
# 4. GIAO DIEN HIEN THI TUONG TAC PHIM H
# ========================================================================

function Mask-Key {
    param([string]$key)
    if ($key -eq "Khong tim thay" -or $key -like "*Khong the*") {
        return $key
    }
    return "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
}


$showKeys = $false

try {
    while ($Host.UI.RawUI.KeyAvailable) {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
} catch {}

while ($true) {
    Clear-Host
    
    Write-Host "========================================================================" -ForegroundColor Gray
    Write-Host '   ____ _               _     ____                 _      ' -ForegroundColor Cyan
    Write-Host '  / ___| |__   ___  ___| | __/ ___|_ __ __ _  ___| | __  ' -ForegroundColor Cyan
    Write-Host ' | |   | ''_ \ / _ \/ __| |/ / |   | ''__/ _` |/ __| |/ /  ' -ForegroundColor Cyan
    Write-Host ' | |___| | | |  __/ (__|   <| |___| | | (_| | (__|   <   ' -ForegroundColor Cyan
    Write-Host '  \____|_| |_|\___|\___|_|\_\\____|_|  \__,_|\___|_|\_\  ' -ForegroundColor Cyan
    Write-Host "                                                         " -ForegroundColor Cyan
    Write-Host "  CONG CU KIEM TRA CRACK & BAN QUYEN WINDOWS/OFFICE " -ForegroundColor White
    Write-Host "                 Developed by TRANHUYTRUNGTAMMMO"               -ForegroundColor White
    Write-Host "========================================================================" -ForegroundColor Gray
    Write-Host ""
    
    # I. THONG TIN PHAN CUNG
    Write-Host "[I. THONG TIN PHAN CUNG MAY TINH]" -ForegroundColor Cyan
    Write-Host "  - Mainboard   : " -NoNewline; Write-Host $motherboard -ForegroundColor White
    Write-Host "  - Bo vi xu ly : " -NoNewline; Write-Host "$cpuName ($cpuCores cores, $cpuThreads threads)" -ForegroundColor White
    Write-Host "  - Bo nho RAM  : " -NoNewline; Write-Host "$ramTotalGB GB (Toc do toi da: $ramSpeed MHz, $ramSlots thanh cam)" -ForegroundColor White
    Write-Host "  - Card do hoa : " -NoNewline; Write-Host $gpuStr -ForegroundColor White
    Write-Host "  - O luu tru   : " -NoNewline; Write-Host $diskStr -ForegroundColor White
    Write-Host ""
    
    # II. THONG TIN BAN QUYEN HE THONG
    Write-Host "[II. THONG TIN BAN QUYEN HE THONG]" -ForegroundColor Cyan
    Write-Host "  - Phien ban Windows   : " -NoNewline; Write-Host $winEdition -ForegroundColor White
    Write-Host "  - Trang thai kich hoat: " -NoNewline
    if ($winStatus -like "*Da kich hoat*") {
        Write-Host $winStatus -ForegroundColor Green
    } else {
        Write-Host $winStatus -ForegroundColor Red
    }
    Write-Host "  - Kenh phan phoi ban quyen: " -NoNewline; Write-Host $winChannel -ForegroundColor White
    
    $displayOemKey = if ($showKeys) { $oemKey } else { Mask-Key $oemKey }
    $displayRegKey = if ($showKeys) { $registryKey } else { Mask-Key $registryKey }
    
    Write-Host "  - Product Key (BIOS OEM)  : " -NoNewline
    if ($oemKey -eq "Khong tim thay") {
        Write-Host $displayOemKey -ForegroundColor DarkGray
    } else {
        Write-Host $displayOemKey -ForegroundColor Yellow
    }
    Write-Host "  - Product Key (Registry)  : " -NoNewline
    if ($registryKey -like "*Khong the*" -or $registryKey -eq "Khong tim thay") {
        Write-Host $displayRegKey -ForegroundColor DarkGray
    } else {
        $isGeneric = $genericKeys[$registryKey]
        if ($isGeneric) {
            if ($showKeys) {
                Write-Host "$displayRegKey " -ForegroundColor Yellow -NoNewline
                Write-Host "[$isGeneric]" -ForegroundColor Cyan
            } else {
                Write-Host "$displayRegKey " -ForegroundColor Yellow -NoNewline
                Write-Host "[Khoa mac dinh Ban quyen so]" -ForegroundColor Cyan
            }
        } else {
            Write-Host $displayRegKey -ForegroundColor Yellow
        }
    }
    
    # Office
    if ($officeProducts.Count -gt 0) {
        Write-Host "  - Ban quyen MS Office : " -ForegroundColor Cyan
        foreach ($off in $officeProducts) {
            Write-Host "    - $($off.Name) : " -NoNewline
            if ($off.Status -eq "Da kich hoat") {
                Write-Host $off.Status -ForegroundColor Green -NoNewline
            } else {
                Write-Host $off.Status -ForegroundColor Red -NoNewline
            }
            if ($off.KmsServer) {
                Write-Host " (Thong qua KMS: $($off.KmsServer))" -ForegroundColor Yellow
            } else {
                Write-Host " (Kenh chinh chu)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  - Ban quyen MS Office : " -NoNewline; Write-Host "Khong phat hien ban cai Office co ban quyen tren may" -ForegroundColor DarkGray
    }
    Write-Host ""
    
    # III. KET QUA QUET CONG CU CRACK
    Write-Host "[III. KET QUA QUET CONG CU CRACK / HACKTOOL]" -ForegroundColor Cyan
    $crackDetectedList = @()
    $warningDetectedList = @()
    
    foreach ($res in $scanResults) {
        Write-Host "  " -NoNewline
        if ($res.Status -eq "OK") {
            Write-Host "[ SACH ] " -ForegroundColor Green -NoNewline
            Write-Host "$($res.Name): $($res.Details)" -ForegroundColor White
        } elseif ($res.Status -eq "WARNING") {
            Write-Host "[ CANH BAO ] " -ForegroundColor Yellow -NoNewline
            Write-Host "$($res.Name): $($res.Details)" -ForegroundColor Yellow
            $warningDetectedList += $res
        } else {
            Write-Host "[ PHAT HIEN ] " -ForegroundColor Red -NoNewline
            Write-Host "$($res.Name): $($res.Details)" -ForegroundColor Red
            $crackDetectedList += $res
        }
    }
    Write-Host ""
    
    # IV. KET LUAN CHUNG
    Write-Host "[IV. KET LUAN CHUNG]" -ForegroundColor Cyan
    Write-Host "  " -NoNewline
    if ($crackDetectedList.Count -gt 0) {
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host "  KET LUAN: HE THONG KHONG AN TOAN! PHAT HIEN CO DAU HIEU CAI DAT CRACK." -ForegroundColor Red
        Write-Host "  Cac moi nguy hai duoc phat hien:" -ForegroundColor Red
        foreach ($crk in $crackDetectedList) {
            Write-Host "  - $($crk.Name): $($crk.Details)" -ForegroundColor Red
        }
        Write-Host "  => Kuyen dung: Go bo cac cong cu nay va mua ban quyen chinh hang de dam bao an toan." -ForegroundColor Yellow
        Write-Host "==========================================================================" -ForegroundColor Red
    } elseif ($warningDetectedList.Count -gt 0) {
        Write-Host "==========================================================================" -ForegroundColor Yellow
        Write-Host "  KET LUAN: CO CANH BAO BAN QUYEN. CHUA PHAT HIEN TEP CRACK HOAC HOOK CHAY NGAM." -ForegroundColor Yellow
        Write-Host "  Chi tiet cac canh bao phat hien:" -ForegroundColor Yellow
        foreach ($warn in $warningDetectedList) {
            Write-Host "  - $($warn.Name): $($warn.Details)" -ForegroundColor Yellow
        }
        Write-Host "  => Luu y: Neu day la may tinh ca nhan, ban nen chuyen sang khoa Retail hoac ban quyen so sach." -ForegroundColor White
        Write-Host "==========================================================================" -ForegroundColor Yellow
    } else {
        Write-Host "==========================================================================" -ForegroundColor Green
        Write-Host "  KET LUAN: HE THONG SACH / BAN QUYEN HOP LE." -ForegroundColor Green
        if ($winStatus -like "*Da kich hoat*") {
            if ($winChannel -like "*Retail*" -and $registryKey -like "BBBBB-BBBBB-BBBBB-BBBBB-BBBBB*") {
                Write-Host "  - Windows kich hoat hop le bang Ban quyen so (Digital License) lien ket phan cung." -ForegroundColor Green
                Write-Host "    (Kich ban kich hoat sach cua MAS HWID hoac nang cap tu Win 7/8 chinh thuc)." -ForegroundColor Gray
            } else {
                Write-Host "  - Windows kich hoat hop le thong qua kenh chinh thong ($winChannel)." -ForegroundColor Green
            }
        } else {
            Write-Host "  - He thong an toan (khong co file crack), tuy nhien Windows chua duoc kich hoat." -ForegroundColor Yellow
        }
        Write-Host "==========================================================================" -ForegroundColor Green
    }
    Write-Host ""
    
    # Huong dan thao tac phim nong
    Write-Host "  [ H ] An/Hien Product Key  |  [ Q hoac ESC ] Thoat chuong trinh" -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------------" -ForegroundColor Gray
    
    if ($testMode) {
        if (-not $showKeys) {
            $showKeys = $true
            Start-Sleep -Milliseconds 300
            continue
        } else {
            break
        }
    }
    
    try {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq [ConsoleKey]::H -or $key.Key.ToString() -eq 'H') {
            $showKeys = -not $showKeys
        } elseif ($key.Key -eq [ConsoleKey]::Q -or $key.Key.ToString() -eq 'Q' -or $key.Key -eq [ConsoleKey]::Escape -or $key.Key.ToString() -eq 'Escape') {
            break
        }
    } catch {
        Write-Host "Khong nhan dien duoc tuong tac ban phim (Co the do chay duoi dang script tu dong)." -ForegroundColor Yellow
        Write-Host "Nhan phim Enter de thoat..." -ForegroundColor Cyan
        Read-Host
        break
    }
}

Write-Host "Da thoat chuong trinh. Cam on ban da su dung!" -ForegroundColor Green
