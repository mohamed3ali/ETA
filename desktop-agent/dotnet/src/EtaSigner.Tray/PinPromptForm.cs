namespace EtaSigner.Tray;

/// <summary>Native PIN entry — shown when the browser calls /sign without a pin field.</summary>
public sealed class PinPromptForm : Form
{
    private readonly TextBox _pinBox;
    private readonly Button _ok;
    private readonly Button _cancel;

    public string? EnteredPin { get; private set; }

    public PinPromptForm(string? invoiceHint = null)
    {
        Text = "ETA eSeal — أدخل رمز PIN";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        Width = 360;
        Height = 180;

        var label = new Label
        {
            Text = string.IsNullOrEmpty(invoiceHint)
                ? "أدخل رمز PIN للفلاشة للتوقيع على الفاتورة"
                : $"توقيع: {invoiceHint}",
            AutoSize = false,
            Width = 320,
            Height = 40,
            Left = 16,
            Top = 16,
        };

        _pinBox = new TextBox
        {
            Left = 16,
            Top = 60,
            Width = 320,
            UseSystemPasswordChar = true,
        };

        _ok = new Button { Text = "موافق", DialogResult = DialogResult.OK, Left = 160, Top = 100, Width = 80 };
        _cancel = new Button { Text = "إلغاء", DialogResult = DialogResult.Cancel, Left = 256, Top = 100, Width = 80 };

        AcceptButton = _ok;
        CancelButton = _cancel;

        Controls.AddRange([label, _pinBox, _ok, _cancel]);

        _ok.Click += (_, _) => EnteredPin = _pinBox.Text;
    }

    public static string? Prompt(IWin32Window? owner = null, string? hint = null)
    {
        using var form = new PinPromptForm(hint);
        return form.ShowDialog(owner) == DialogResult.OK ? form.EnteredPin : null;
    }
}
