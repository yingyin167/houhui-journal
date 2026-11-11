[CmdletBinding()]
param(
    [string]$SubscriptionName = "Azure for Students",
    [string]$ResourceGroup = "houhuiqikan-rg",
    [string]$VmName = "houhuiqikan-vm",
    [string]$AdminUsername = "houhui",
    [string[]]$Regions = @(
        "southeastasia",
        "eastasia",
        "japaneast",
        "koreacentral",
        "australiaeast",
        "eastus",
        "westus2",
        "westeurope"
    ),
    [string[]]$Sizes = @(
        "Standard_B2ats_v2",
        "Standard_B1s",
        "Standard_B2s_v2"
    ),
    [switch]$Create
)

$ErrorActionPreference = "Stop"

function Invoke-AzJson {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $raw = & az @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($raw -join [Environment]::NewLine)
    }

    $text = $raw -join [Environment]::NewLine
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    return ($text | ConvertFrom-Json)
}

function Test-CommandAvailable {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandAvailable "az")) {
    throw @"
Azure CLI is not installed in this PowerShell session.
Run this script in Azure Cloud Shell, or install Azure CLI locally first:
https://learn.microsoft.com/cli/azure/install-azure-cli
"@
}

$account = $null
try {
    $account = Invoke-AzJson -Arguments @("account", "show", "-o", "json")
}
catch {
    Write-Host "Azure CLI is not logged in. Opening Azure login..." -ForegroundColor Yellow
    & az login
    if ($LASTEXITCODE -ne 0) {
        throw "Azure login failed."
    }
    $account = Invoke-AzJson -Arguments @("account", "show", "-o", "json")
}

$subscription = Invoke-AzJson -Arguments @(
    "account", "list",
    "--query", "[?name=='$SubscriptionName' && state=='Enabled'] | [0]",
    "-o", "json"
)

if ($null -eq $subscription) {
    throw "Enabled subscription '$SubscriptionName' was not found. Run 'az account list -o table' to inspect subscriptions."
}

& az account set --subscription $subscription.id
if ($LASTEXITCODE -ne 0) {
    throw "Could not switch to subscription '$SubscriptionName'."
}

Write-Host ""
Write-Host "Subscription: $($subscription.name)" -ForegroundColor Cyan
Write-Host "Subscription ID: $($subscription.id)" -ForegroundColor Cyan
Write-Host "Mode: $(if ($Create) { 'CREATE' } else { 'CHECK ONLY' })" -ForegroundColor Cyan
Write-Host ""

$candidates = New-Object System.Collections.Generic.List[object]

foreach ($region in $Regions) {
    Write-Host "Checking region: $region" -ForegroundColor DarkCyan

    try {
        $skus = Invoke-AzJson -Arguments @(
            "vm", "list-skus",
            "--location", $region,
            "--resource-type", "virtualMachines",
            "--all",
            "-o", "json"
        )
    }
    catch {
        Write-Host "  Could not read SKU availability: $($_.Exception.Message)" -ForegroundColor DarkYellow
        continue
    }

    foreach ($size in $Sizes) {
        $sku = @($skus | Where-Object {
            $_.name -eq $size -and $_.resourceType -eq "virtualMachines"
        } | Select-Object -First 1)

        if ($sku.Count -eq 0) {
            Write-Host "  $size : not listed" -ForegroundColor DarkGray
            continue
        }

        $locationMatch = @($sku.locations | Where-Object {
            $_ -eq $region -or $_ -eq (($region -replace " ", "").ToLower())
        })
        $blocked = @($sku.restrictions | Where-Object {
            $_.type -in @("Location", "NotAvailableForSubscription", "QuotaId")
        })

        if ($locationMatch.Count -eq 0) {
            Write-Host "  $size : not available in this region" -ForegroundColor DarkYellow
            continue
        }

        if ($blocked.Count -gt 0) {
            $reason = ($blocked | ForEach-Object { $_.reasonCode } | Sort-Object -Unique) -join ", "
            Write-Host "  $size : restricted ($reason)" -ForegroundColor DarkYellow
            continue
        }

        Write-Host "  $size : candidate" -ForegroundColor Green
        $candidates.Add([pscustomobject]@{
            Region = $region
            Size = $size
        })
    }
}

if ($candidates.Count -eq 0) {
    Write-Host ""
    Write-Host "No VM size passed the SKU availability check." -ForegroundColor Red
    Write-Host "This usually means the subscription has no usable VM quota/SKU in these regions." -ForegroundColor Yellow
    Write-Host "The Azure policy error may still require Microsoft to confirm the allowed regions." -ForegroundColor Yellow
    exit 2
}

$selected = $candidates[0]
Write-Host ""
Write-Host "Selected candidate: $($selected.Size) in $($selected.Region)" -ForegroundColor Green

if (-not $Create) {
    Write-Host ""
    Write-Host "This was a check only. No Azure resources were created." -ForegroundColor Cyan
    Write-Host "To create the VM, run this script again with -Create." -ForegroundColor Cyan
    exit 0
}

Write-Host ""
Write-Host "Creating resource group '$ResourceGroup'..." -ForegroundColor Cyan
& az group create `
    --name $ResourceGroup `
    --location $selected.Region `
    --tags app=houhuiqikan environment=production `
    -o table
if ($LASTEXITCODE -ne 0) {
    throw "Resource group creation failed."
}

Write-Host ""
Write-Host "Creating VM. This can take several minutes..." -ForegroundColor Cyan
& az vm create `
    --resource-group $ResourceGroup `
    --name $VmName `
    --location $selected.Region `
    --image Ubuntu2404 `
    --size $selected.Size `
    --admin-username $AdminUsername `
    --generate-ssh-keys `
    --public-ip-sku Standard `
    --storage-sku StandardSSD_LRS `
    --os-disk-size-gb 30 `
    --tags app=houhuiqikan environment=production `
    -o json

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "VM creation failed. The selected region may still be blocked by the subscription policy." -ForegroundColor Red
    Write-Host "Run the script without -Create to inspect the SKU candidates again." -ForegroundColor Yellow
    exit 3
}

Write-Host ""
Write-Host "Opening HTTP and HTTPS ports..." -ForegroundColor Cyan
& az vm open-port --resource-group $ResourceGroup --name $VmName --port 80 -o table
$httpExitCode = $LASTEXITCODE
& az vm open-port --resource-group $ResourceGroup --name $VmName --port 443 -o table
$httpsExitCode = $LASTEXITCODE
if ($httpExitCode -ne 0 -or $httpsExitCode -ne 0) {
    Write-Host "VM was created, but opening one or more ports failed. Configure ports from the VM networking page." -ForegroundColor Yellow
}

$publicIp = & az vm show `
    --resource-group $ResourceGroup `
    --name $VmName `
    --show-details `
    --query publicIps `
    -o tsv

Write-Host ""
Write-Host "VM created successfully." -ForegroundColor Green
Write-Host "Region: $($selected.Region)" -ForegroundColor Cyan
Write-Host "Size: $($selected.Size)" -ForegroundColor Cyan
Write-Host "Public IP: $publicIp" -ForegroundColor Cyan
Write-Host ""
Write-Host "SSH command:" -ForegroundColor Cyan
Write-Host "ssh -i `"$HOME\.ssh\id_rsa`" $AdminUsername@$publicIp"
