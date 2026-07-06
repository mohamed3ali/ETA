using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;
using Net.Pkcs11Interop.Common;
using Net.Pkcs11Interop.HighLevelAPI;

namespace EtaSigner.Core.Pkcs11;

public sealed record TokenInfo(
    string CertificateRin,
    string CertificateSubject,
    DateTime? NotAfter,
    string SlotDescription);

public static class Pkcs11TokenService
{
    private static readonly Pkcs11InteropFactories Factories = new();

    public static string? LibraryPath =>
        Environment.GetEnvironmentVariable("PKCS11_LIB");

    public static bool IsConfigured => !string.IsNullOrWhiteSpace(LibraryPath);

    public static TokenInfo? Probe()
    {
        var path = LibraryPath;
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            return null;

        using var lib = Factories.Pkcs11LibraryFactory.LoadPkcs11Library(
            Factories, path, AppType.MultiThreaded);

        var slots = lib.GetSlotList(SlotsType.WithTokenPresent);
        if (slots.Count == 0)
            return null;

        var slot = slots[0];
        var tokenInfo = slot.GetTokenInfo();
        using var session = slot.OpenSession(SessionType.ReadOnly);

        foreach (var (x509, certId) in EnumerateCertificates(session))
        {
            var rin = ExtractRin(x509.Subject);
            if (rin is null)
                continue;

            if (!HasPrivateKey(session, certId))
                continue;

            return new TokenInfo(
                rin,
                x509.Subject,
                x509.NotAfter,
                tokenInfo.Label?.Trim() ?? "USB Token");
        }

        return null;
    }

    public static byte[] SignSha256Digest(byte[] sha256Digest, string pin)
    {
        if (sha256Digest.Length != 32)
            throw new ArgumentException("Expected a 32-byte SHA-256 digest", nameof(sha256Digest));

        var path = LibraryPath ?? throw new InvalidOperationException("PKCS11_LIB is not set");
        using var lib = Factories.Pkcs11LibraryFactory.LoadPkcs11Library(
            Factories, path, AppType.MultiThreaded);

        var slot = lib.GetSlotList(SlotsType.WithTokenPresent).FirstOrDefault()
            ?? throw new InvalidOperationException("No USB Token detected");

        using var session = slot.OpenSession(SessionType.ReadWrite);
        session.Login(CKU.CKU_USER, pin);

        try
        {
            var privateKey = FindSigningPrivateKey(session)
                ?? throw new InvalidOperationException("No signing private key found on token");

            var mechanism = session.Factories.MechanismFactory.Create(CKM.CKM_SHA256_RSA_PKCS);
            try
            {
                return session.Sign(mechanism, privateKey, sha256Digest);
            }
            catch (Pkcs11Exception)
            {
                var digestInfo = RsaPkcs1DigestInfo.ForSha256(sha256Digest);
                var rsaMech = session.Factories.MechanismFactory.Create(CKM.CKM_RSA_PKCS);
                return session.Sign(rsaMech, privateKey, digestInfo);
            }
        }
        finally
        {
            try { session.Logout(); } catch { /* ignore */ }
        }
    }

    public static X509Certificate2 GetSigningCertificate(string pin)
    {
        var path = LibraryPath ?? throw new InvalidOperationException("PKCS11_LIB is not set");
        using var lib = Factories.Pkcs11LibraryFactory.LoadPkcs11Library(
            Factories, path, AppType.MultiThreaded);

        var slot = lib.GetSlotList(SlotsType.WithTokenPresent).FirstOrDefault()
            ?? throw new InvalidOperationException("No USB Token detected");

        using var session = slot.OpenSession(SessionType.ReadOnly);
        session.Login(CKU.CKU_USER, pin);
        try
        {
            foreach (var (x509, certId) in EnumerateCertificates(session))
            {
                if (HasPrivateKey(session, certId))
                    return x509;
            }
            throw new InvalidOperationException("No signing certificate found on token");
        }
        finally
        {
            try { session.Logout(); } catch { /* ignore */ }
        }
    }

    internal static string? ExtractRin(string subject)
    {
        var serial = Regex.Match(subject, @"serialNumber=(\d+)", RegexOptions.IgnoreCase);
        if (serial.Success)
            return serial.Groups[1].Value;

        var cn = Regex.Match(subject, @"CN=(\d{9,})", RegexOptions.IgnoreCase);
        return cn.Success ? cn.Groups[1].Value : null;
    }

    private static IEnumerable<(X509Certificate2 Cert, byte[] Id)> EnumerateCertificates(ISession session)
    {
        var template = new List<IObjectAttribute>
        {
            session.Factories.ObjectAttributeFactory.Create(CKA.CKA_CLASS, CKO.CKO_CERTIFICATE),
        };

        foreach (var handle in session.FindAllObjects(template))
        {
            var attrs = session.GetAttributeValue(handle, new List<CKA> { CKA.CKA_ID, CKA.CKA_VALUE });
            var idAttr = attrs.First(a => (CKA)a.Type == CKA.CKA_ID);
            var valueAttr = attrs.First(a => (CKA)a.Type == CKA.CKA_VALUE);
            var id = idAttr.GetValueAsByteArray();
            var der = valueAttr.GetValueAsByteArray();
            if (der.Length == 0)
                continue;
            yield return (new X509Certificate2(der), id);
        }
    }

    private static bool HasPrivateKey(ISession session, byte[] certId)
    {
        var template = new List<IObjectAttribute>
        {
            session.Factories.ObjectAttributeFactory.Create(CKA.CKA_CLASS, CKO.CKO_PRIVATE_KEY),
            session.Factories.ObjectAttributeFactory.Create(CKA.CKA_ID, certId),
        };
        return session.FindAllObjects(template).Count > 0;
    }

    private static IObjectHandle? FindSigningPrivateKey(ISession session)
    {
        foreach (var (_, certId) in EnumerateCertificates(session))
        {
            var template = new List<IObjectAttribute>
            {
                session.Factories.ObjectAttributeFactory.Create(CKA.CKA_CLASS, CKO.CKO_PRIVATE_KEY),
                session.Factories.ObjectAttributeFactory.Create(CKA.CKA_ID, certId),
            };
            var key = session.FindAllObjects(template).FirstOrDefault();
            if (key is not null)
                return key;
        }
        return null;
    }
}

internal static class RsaPkcs1DigestInfo
{
    private static readonly byte[] Sha256Prefix =
    [
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01,
        0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20,
    ];

    public static byte[] ForSha256(ReadOnlySpan<byte> hash)
    {
        if (hash.Length != 32)
            throw new ArgumentException("SHA-256 digest must be 32 bytes");
        var buf = new byte[Sha256Prefix.Length + 32];
        Sha256Prefix.CopyTo(buf, 0);
        hash.CopyTo(buf.AsSpan(Sha256Prefix.Length));
        return buf;
    }
}
