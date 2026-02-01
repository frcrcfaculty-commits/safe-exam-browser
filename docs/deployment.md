# Group Policy & Lab Deployment Guide

## Windows Shell Launcher Setup

For maximum lockdown, configure Shell Launcher to use Safe Exam Browser as the Windows shell instead of Explorer.

### Enable Shell Launcher Feature

```powershell
# Run as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName "Client-EmbeddedShellLauncher"
```

### Configure Shell Launcher

```powershell
# Set Safe Exam Browser as shell for exam user
$STUDENT_SID = "S-1-5-21-..." # Get SID of student account

Set-WmiInstance -Class WESL_UserSetting -Namespace "root\standardcimv2\embedded" -Arguments @{
    Sid = $STUDENT_SID
    Shell = "C:\Program Files\SafeExamBrowser\SafeExamBrowser.exe"
    DefaultAction = 0  # Restart shell on exit
}
```

## Group Policy Settings

Apply these policies via Local Group Policy Editor (gpedit.msc) or Domain GPO:

### User Configuration

| Setting | Path | Value |
|---------|------|-------|
| Remove Run menu | User Config > Admin Templates > Start Menu | Enabled |
| Remove Task Manager | User Config > Admin Templates > System | Enabled |
| Disable CMD | User Config > Admin Templates > System | Enabled |
| Disable Registry | User Config > Admin Templates > System | Enabled |
| Hide drives | User Config > Admin Templates > Windows Components > File Explorer | All drives |

### Computer Configuration

| Setting | Path | Value |
|---------|------|-------|
| Disable Ctrl+Alt+Del | Computer Config > Windows Settings > Security Settings > Local Policies | Enabled |
| Disable Windows Store | Computer Config > Admin Templates > Windows Components > Store | Enabled |

## Recommended Lab Account Setup

1. Create a dedicated "ExamStudent" local account
2. Set account to Standard User (not Administrator)
3. Apply Group Policies to this account
4. Configure Shell Launcher for this account
5. Enable auto-login for exam sessions

## Network Configuration

- Ensure all lab PCs can reach the exam server
- Configure firewall to allow HTTPS (port 443)
- Block external internet if desired
- Use internal DNS for server hostname

## Troubleshooting

### Device Not Registering
- Check network connectivity
- Verify server URL in client settings
- Check server logs for errors

### Exam Not Starting
- Ensure device is approved in admin panel
- Check that exam is published
- Verify roll number format

### Focus Detection Issues
- Ensure Single Display mode
- Disable secondary monitors
- Check for background applications
