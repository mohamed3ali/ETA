using System.Text.Json;
using EtaSigner.Core.Signing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace EtaSigner.Tray;

public static class AgentWebHost
{
    public static WebApplication Build(ICadesSigner signer, AgentOptions options)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ApplicationName = typeof(AgentWebHost).Assembly.FullName,
            Args = Array.Empty<string>(),
        });

        builder.WebHost.UseUrls($"http://{options.Host}:{options.Port}");

        builder.Services.AddSingleton(signer);
        builder.Services.AddSingleton(options);
        builder.Services.AddCors(cors =>
        {
            cors.AddDefaultPolicy(p =>
            {
                p.WithOrigins(options.CorsOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        var app = builder.Build();
        app.UseCors();

        app.MapGet("/health", (ICadesSigner s) => Results.Json(s.GetHealth()));

        app.MapPost("/sign", async (HttpContext ctx, ICadesSigner s, AgentOptions opt) =>
        {
            SignBody? body;
            try
            {
                body = await ctx.Request.ReadFromJsonAsync<SignBody>();
            }
            catch
            {
                return Results.BadRequest(new { error = new { message = "Invalid JSON body" } });
            }

            if (body?.Document is null)
                return Results.BadRequest(new { error = new { message = "Missing document" } });
            if (string.IsNullOrEmpty(body.HashHex) || string.IsNullOrEmpty(body.Canonical))
                return Results.BadRequest(new { error = new { message = "Missing canonical or hashHex" } });

            var pin = body.Pin;
            if (string.IsNullOrEmpty(pin) && opt.PinProvider is not null)
                pin = opt.PinProvider();

            try
            {
                var response = await s.SignAsync(new SignRequest
                {
                    Document = body.Document.Value,
                    Canonical = body.Canonical,
                    HashHex = body.HashHex,
                    IssuerRin = body.IssuerRin,
                    Pin = pin,
                });
                return Results.Json(response);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Conflict(new { error = new { message = ex.Message } });
            }
            catch (NotImplementedException ex)
            {
                return Results.Json(
                    new { error = new { message = ex.Message } },
                    statusCode: StatusCodes.Status501NotImplemented);
            }
        });

        return app;
    }

    private sealed class SignBody
    {
        public JsonElement? Document { get; init; }
        public string? Canonical { get; init; }
        public string? HashHex { get; init; }
        public string? IssuerRin { get; init; }
        public string? Pin { get; init; }
    }
}

public sealed class AgentOptions
{
    public string Host { get; init; } = "127.0.0.1";
    public int Port { get; init; } = 8765;
    public string[] CorsOrigins { get; init; } =
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost",
        "http://127.0.0.1",
    ];

    /// <summary>Called when /sign has no PIN in the body (tray UI prompt).</summary>
    public Func<string?>? PinProvider { get; set; }
}
