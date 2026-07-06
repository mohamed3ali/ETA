using System.Text.Json;

namespace EtaSigner.Core.Signing;

public sealed class SignRequest
{
    public JsonElement Document { get; init; }
    public required string Canonical { get; init; }
    public required string HashHex { get; init; }
    public string? IssuerRin { get; init; }
    public string? Pin { get; init; }
}

public sealed class SignResponse
{
    public required IReadOnlyList<EtaSignatureDto> Signatures { get; init; }
    public required string SignedAt { get; init; }
    public required string Mode { get; init; }
}

public sealed class EtaSignatureDto
{
    public required string SignatureType { get; init; }
    public required string Value { get; init; }
}

public sealed class AgentHealth
{
    public required string Status { get; init; }
    public bool TokenConnected { get; init; }
    public string? CertificateRin { get; init; }
    public string? CertificateExpiry { get; init; }
    public required string AgentVersion { get; init; }
    public required string Mode { get; init; }
}
