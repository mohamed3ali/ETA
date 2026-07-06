using EtaSigner.Core.Canonicalization;
using EtaSigner.Core.Pkcs11;

namespace EtaSigner.Core.Signing;

/// <summary>
/// Production signer: reads the eSeal certificate from a USB Token via PKCS#11
/// and produces a CAdES-BES (CMS) signature over the SHA-256 document hash.
/// </summary>
public sealed class Pkcs11CadesSigner : ICadesSigner
{
    public const string Version = "1.0.0";

    private readonly Func<string?> _pinProvider;
    private TokenInfo? _cachedToken;

    public Pkcs11CadesSigner(Func<string?> pinProvider) => _pinProvider = pinProvider;

    public AgentHealth GetHealth()
    {
        if (!Pkcs11TokenService.IsConfigured)
        {
            return new AgentHealth
            {
                Status = "no_token",
                TokenConnected = false,
                AgentVersion = Version,
                Mode = "production",
            };
        }

        try
        {
            _cachedToken = Pkcs11TokenService.Probe();
            if (_cachedToken is null)
            {
                return new AgentHealth
                {
                    Status = "no_token",
                    TokenConnected = false,
                    AgentVersion = Version,
                    Mode = "production",
                };
            }

            return new AgentHealth
            {
                Status = "ok",
                TokenConnected = true,
                CertificateRin = _cachedToken.CertificateRin,
                CertificateExpiry = _cachedToken.NotAfter?.ToString("yyyy-MM-dd"),
                AgentVersion = Version,
                Mode = "production",
            };
        }
        catch (Exception ex)
        {
            return new AgentHealth
            {
                Status = $"error:{ex.Message}",
                TokenConnected = false,
                AgentVersion = Version,
                Mode = "production",
            };
        }
    }

    public async Task<SignResponse> SignAsync(SignRequest request, CancellationToken cancellationToken = default)
    {
        var localCanonical = EtaCanonicalizer.Canonicalize(request.Document, "signatures");
        var localHash = EtaCanonicalizer.Sha256Hex(localCanonical);

        if (!string.Equals(localCanonical, request.Canonical, StringComparison.Ordinal)
            || !string.Equals(localHash, request.HashHex, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Canonical/hash mismatch — document was modified after the server built the payload");
        }

        if (!Pkcs11TokenService.IsConfigured)
            throw new InvalidOperationException("PKCS11_LIB environment variable is not set");

        var pin = request.Pin ?? _pinProvider()
            ?? throw new InvalidOperationException("PIN required — user cancelled or empty");

        var hashBytes = Convert.FromHexString(localHash);

        var rsaSig = await Task.Run(
            () => Pkcs11TokenService.SignSha256Digest(hashBytes, pin),
            cancellationToken);

        var cert = await Task.Run(
            () => Pkcs11TokenService.GetSigningCertificate(pin),
            cancellationToken);

        if (!string.IsNullOrEmpty(request.IssuerRin))
        {
            var certRin = Pkcs11TokenService.ExtractRin(cert.Subject)
                ?? _cachedToken?.CertificateRin;
            if (certRin is not null
                && !string.Equals(certRin, request.IssuerRin, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Certificate RIN {certRin} does not match invoice issuer {request.IssuerRin}");
            }
        }

        var cms = CadesBesBuilder.BuildDetached(hashBytes, rsaSig, cert);
        var base64 = Convert.ToBase64String(cms);

        return new SignResponse
        {
            Signatures = [new EtaSignatureDto { SignatureType = "I", Value = base64 }],
            SignedAt = DateTime.UtcNow.ToString("o"),
            Mode = "production",
        };
    }
}
