using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EtaSigner.Core.Canonicalization;

/// <summary>
/// ETA document serialization — must stay in sync with
/// backend/src/modules/eta/eta-canonicalizer.ts and desktop-agent/src/canonicalizer.ts
/// </summary>
/// <see href="https://sdk.invoicing.eta.gov.eg/document-serialization-approach/"/>
public static class EtaCanonicalizer
{
    public static string Canonicalize(JsonElement document, params string[] excludeKeys)
    {
        var exclude = new HashSet<string>(excludeKeys, StringComparer.Ordinal);
        if (document.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("Document root must be a JSON object");

        var filtered = new Dictionary<string, JsonElement>();
        foreach (var prop in document.EnumerateObject())
        {
            if (!exclude.Contains(prop.Name))
                filtered[prop.Name] = prop.Value;
        }

        return SerializeObject(filtered);
    }

    public static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string SerializeObject(IReadOnlyDictionary<string, JsonElement> obj)
    {
        var sb = new StringBuilder();
        foreach (var (key, value) in obj)
        {
            if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
                continue;

            var upperKey = $"\"{key.ToUpperInvariant()}\"";

            if (value.ValueKind == JsonValueKind.Array)
            {
                sb.Append(upperKey);
                foreach (var item in value.EnumerateArray())
                {
                    sb.Append(upperKey);
                    sb.Append(SerializeValue(item));
                }
                continue;
            }

            sb.Append(upperKey);
            sb.Append(SerializeValue(value));
        }
        return sb.ToString();
    }

    private static string SerializeValue(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Null or JsonValueKind.Undefined => "\"\"",
        JsonValueKind.String => $"\"{value.GetString()}\"",
        JsonValueKind.Number => $"\"{value.GetRawText()}\"",
        JsonValueKind.True => "\"true\"",
        JsonValueKind.False => "\"false\"",
        JsonValueKind.Object => SerializeObject(
            value.EnumerateObject().ToDictionary(p => p.Name, p => p.Value)),
        JsonValueKind.Array => string.Concat(value.EnumerateArray().Select(SerializeValue)),
        _ => throw new NotSupportedException($"Unsupported JSON kind: {value.ValueKind}"),
    };
}
