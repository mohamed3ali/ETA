using EtaSigner.Core.Signing;
using Microsoft.AspNetCore.Builder;

namespace EtaSigner.Tray;

public sealed class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _tray;
    private readonly ICadesSigner _signer;
    private WebApplication? _webApp;
    private CancellationTokenSource? _hostCts;

    public TrayApplicationContext(ICadesSigner signer, AgentOptions options)
    {
        _signer = signer;

        _tray = new NotifyIcon
        {
            Text = "ETA Signer",
            Icon = SystemIcons.Shield,
            Visible = true,
            ContextMenuStrip = BuildMenu(options),
        };

        options.PinProvider ??= () => PinPromptForm.Prompt(hint: "فاتورة ETA");

        StartHost(signer, options);
        RefreshTrayStatus();
    }

    private ContextMenuStrip BuildMenu(AgentOptions options)
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("حالة الفلاشة", null, (_, _) => RefreshTrayStatus(showBalloon: true));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add($"المنفذ: {options.Port}", null, (_, _) => { });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("خروج", null, (_, _) => ExitThread());
        return menu;
    }

    private void StartHost(ICadesSigner signer, AgentOptions options)
    {
        _hostCts = new CancellationTokenSource();
        _webApp = AgentWebHost.Build(signer, options);
        _ = Task.Run(() => _webApp.Run(), _hostCts.Token);
    }

    private void RefreshTrayStatus(bool showBalloon = false)
    {
        var health = _signer.GetHealth();
        var connected = health.TokenConnected;
        _tray.Icon = connected ? SystemIcons.Shield : SystemIcons.Warning;
        _tray.Text = connected
            ? $"ETA Signer — Token OK ({health.Mode})"
            : $"ETA Signer — No token ({health.Mode})";

        if (showBalloon)
        {
            _tray.ShowBalloonTip(
                3000,
                "ETA Signer",
                connected
                    ? $"RIN: {health.CertificateRin ?? "—"} · v{health.AgentVersion}"
                    : "الفلاشة غير متصلة — وصّل USB Token",
                connected ? ToolTipIcon.Info : ToolTipIcon.Warning);
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _hostCts?.Cancel();
            _hostCts?.Dispose();
            _tray.Dispose();
        }
        base.Dispose(disposing);
    }
}
