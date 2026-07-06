using Microsoft.Win32;

namespace EtaSigner.Tray;

/// <summary>
/// First-run "self-install" so the single-file <c>EtaSigner.exe</c> behaves
/// like an extension: double-click → copies itself to <c>%LOCALAPPDATA%</c>,
/// registers a Run-on-login key, and relaunches from the permanent location.
/// </summary>
internal static class FirstRunInstaller
{
    private const string InstallFolderName = "EtaSigner";
    private const string ExeName = "EtaSigner.exe";
    private const string RunKeyName = "EtaSigner";
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";

    public static string InstallDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        InstallFolderName);

    public static string InstalledExePath => Path.Combine(InstallDirectory, ExeName);

    /// <summary>
    /// Returns true and exits the current process if we relaunched from a
    /// different location (i.e. installation just happened).
    /// </summary>
    public static bool EnsureInstalledAndMaybeRelaunch()
    {
        if (string.Equals(Environment.GetEnvironmentVariable("ETA_SIGNER_NO_INSTALL"), "true", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var currentExe = Environment.ProcessPath;
        if (string.IsNullOrEmpty(currentExe))
        {
            return false;
        }

        var installed = InstalledExePath;
        var alreadyRunningFromInstallDir = string.Equals(
            Path.GetFullPath(currentExe),
            Path.GetFullPath(installed),
            StringComparison.OrdinalIgnoreCase);

        if (alreadyRunningFromInstallDir)
        {
            TryRegisterAutoStart(installed);
            return false;
        }

        try
        {
            Directory.CreateDirectory(InstallDirectory);
            File.Copy(currentExe, installed, overwrite: true);
            TryRegisterAutoStart(installed);

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = installed,
                UseShellExecute = true,
                WorkingDirectory = InstallDirectory,
            });

            TryShowWelcome();
            return true;
        }
        catch
        {
            // Installation failed (e.g. file locked); keep running from the
            // current location so the user can still sign right now.
            return false;
        }
    }

    private static void TryRegisterAutoStart(string exePath)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true)
                ?? Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true);
            key?.SetValue(RunKeyName, $"\"{exePath}\"");
        }
        catch
        {
            // Non-fatal — agent still works for this session.
        }
    }

    private static void TryShowWelcome()
    {
        try
        {
            MessageBox.Show(
                "تم تثبيت برنامج الختم الإلكتروني بنجاح.\n\n" +
                "البرنامج يعمل الآن في شريط المهام (بجانب الساعة) وسيبدأ تلقائيًا مع تشغيل Windows.\n" +
                "ارجع لصفحة الفاتورة واضغط: توقيع وإرسال للمصلحة.",
                "ETA Signer",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
        catch
        {
            // Headless / no message pump — ignore.
        }
    }
}
