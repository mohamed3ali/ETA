using EtaSigner.Core.Signing;

namespace EtaSigner.Tray;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        if (FirstRunInstaller.EnsureInstalledAndMaybeRelaunch())
        {
            return;
        }

        using var singleInstance = new Mutex(initiallyOwned: true, "Global\\EtaSigner.Tray.SingleInstance", out var createdNew);
        if (!createdNew)
        {
            return;
        }

        var useMock = string.Equals(
            Environment.GetEnvironmentVariable("ETA_SIGNER_MOCK"),
            "false",
            StringComparison.OrdinalIgnoreCase) is false;

        ICadesSigner signer = useMock
            ? new MockCadesSigner(Environment.GetEnvironmentVariable("ETA_SIGNER_MOCK_RIN") ?? "123456789")
            : new Pkcs11CadesSigner(() => PinPromptForm.Prompt(hint: "فاتورة ETA"));

        var port = int.TryParse(Environment.GetEnvironmentVariable("AGENT_PORT"), out var p) ? p : 8765;
        var host = Environment.GetEnvironmentVariable("AGENT_HOST") ?? "127.0.0.1";

        var cors = (Environment.GetEnvironmentVariable("AGENT_CORS_ORIGINS")
            ?? "http://localhost:3000,http://127.0.0.1:3000,http://localhost,http://127.0.0.1")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var opts = new AgentOptions
        {
            Host = host,
            Port = port,
            CorsOrigins = cors,
            PinProvider = () => PinPromptForm.Prompt(hint: "فاتورة ETA"),
        };

        Application.Run(new TrayApplicationContext(signer, opts));
    }
}
