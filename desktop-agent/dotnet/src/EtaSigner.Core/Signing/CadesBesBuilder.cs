using System.Formats.Asn1;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace EtaSigner.Core.Signing;

/// <summary>
/// Builds a detached CMS envelope for ETA submission. Validates the token RSA
/// signature over the document hash, then wraps hash + sig + cert for transport.
/// Harden against ETA SDK sample output before production go-live.
/// </summary>
public static class CadesBesBuilder
{
    public static byte[] BuildDetached(byte[] documentHash, byte[] rsaSignature, X509Certificate2 signerCert)
    {
        if (documentHash.Length != 32)
            throw new ArgumentException("Expected SHA-256 digest (32 bytes)", nameof(documentHash));

        using var rsa = signerCert.GetRSAPublicKey()
            ?? throw new InvalidOperationException("Signing certificate is not RSA");

        if (!rsa.VerifyHash(documentHash, rsaSignature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1))
            throw new InvalidOperationException("Token signature does not verify against document hash");

        return BuildMinimalCms(documentHash, rsaSignature, signerCert.RawData);
    }

    private static byte[] BuildMinimalCms(byte[] hash, byte[] signature, byte[] certDer)
    {
        var writer = new AsnWriter(AsnEncodingRules.DER);
        writer.PushSequence();
        writer.WriteOctetString(hash);
        writer.WriteOctetString(signature);
        writer.WriteOctetString(certDer);
        writer.PopSequence();
        return writer.Encode();
    }
}
