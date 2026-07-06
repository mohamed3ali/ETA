namespace EtaSigner.Core.Signing;

public interface ICadesSigner
{
    AgentHealth GetHealth();
    Task<SignResponse> SignAsync(SignRequest request, CancellationToken cancellationToken = default);
}
