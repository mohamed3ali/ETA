using System.Text;
using EtaSigner.Core.Canonicalization;

namespace EtaSigner.Core.Signing;

/// <summary>Dev / CI signer — same contract as the Node mock agent.</summary>
public sealed class MockCadesSigner : ICadesSigner
{
    public const string Version = "1.0.0-mock";
    private readonly string _mockRin;

    public MockCadesSigner(string mockRin = "123456789") => _mockRin = mockRin;

    public AgentHealth GetHealth() => new()
    {
        Status = "ok",
        TokenConnected = true,
        CertificateRin = _mockRin,
        CertificateExpiry = "2099-12-31",
        AgentVersion = Version,
        Mode = "mock",
    };

    public Task<SignResponse> SignAsync(SignRequest request, CancellationToken cancellationToken = default)
    {
        var localCanonical = EtaCanonicalizer.Canonicalize(request.Document, "signatures");
        var localHash = EtaCanonicalizer.Sha256Hex(localCanonical);

        if (!string.Equals(localCanonical, request.Canonical, StringComparison.Ordinal)
            || !string.Equals(localHash, request.HashHex, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Canonical/hash mismatch — document was modified after the server built the payload");
        }

        var mockCades = Convert.ToBase64String(Encoding.UTF8.GetBytes($"MOCK-CADES-BES:{localHash}"));

        return Task.FromResult(new SignResponse
        {
            Signatures = [new EtaSignatureDto { SignatureType = "I", Value = mockCades }],
            SignedAt = DateTime.UtcNow.ToString("o"),
            Mode = "mock",
        });
    }
}
