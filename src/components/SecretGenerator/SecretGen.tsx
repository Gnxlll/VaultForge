import { useState, useEffect } from "react";
import { Cpu, Copy, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";
import { safeInvoke } from "../../utils/tauri";

type SecretPreset = "JWT_HS256" | "JWT_HS384" | "JWT_HS512" | "HEX" | "BASE64";

export default function SecretGen() {
  const [preset, setPreset] = useState<SecretPreset>("JWT_HS256");
  const [entropy, setEntropy] = useState<number>(256);
  const [secret, setSecret] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-adjust entropy based on JWT algorithm recommendations
  useEffect(() => {
    if (preset === "JWT_HS256") setEntropy(256);
    if (preset === "JWT_HS384") setEntropy(384);
    if (preset === "JWT_HS512") setEntropy(512);
    if (preset === "HEX" || preset === "BASE64") setEntropy(256);
  }, [preset]);

  const generateSecret = async () => {
    try {
      setError(null);
      let generated = "";

      if (preset.startsWith("JWT")) {
        generated = await safeInvoke<string>("generate_jwt_secret", {
          entropyBits: entropy,
        });
      } else {
        const bytes = Math.floor(entropy / 8);
        const encoding = preset === "HEX" ? "hex" : "base64";
        generated = await safeInvoke<string>("generate_generic_secret", {
          lengthBytes: bytes,
          encoding,
        });
      }

      setSecret(generated);
      setCopied(false);
    } catch (err) {
      setError(String(err));
      setSecret("");
    }
  };

  // Generate a secret immediately on load
  useEffect(() => {
    generateSecret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="border-b border-cyber-panel pb-4">
        <div className="flex items-center space-x-3">
          <Cpu className="text-cyber-neonPink w-6 h-6" />
          <h3 className="text-2xl font-heading text-white">MACHINE SECRETS</h3>
        </div>
        <p className="text-cyber-neonCyan opacity-70 font-mono text-sm mt-2">
          Cryptographically secure generation for API keys, session signing, and
          infrastructure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <div className="bg-cyber-panel border border-cyber-dim p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-mono text-gray-400 uppercase">
              Output Format
            </label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as SecretPreset)}
              className="w-full bg-cyber-dark border border-gray-700 text-white p-2.5 font-mono text-sm focus:border-cyber-neonCyan outline-none"
            >
              <option value="JWT_HS256">JWT Secret (HS256)</option>
              <option value="JWT_HS384">JWT Secret (HS384)</option>
              <option value="JWT_HS512">JWT Secret (HS512)</option>
              <option value="HEX">Random Hex Key</option>
              <option value="BASE64">Random Base64 Key</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono text-gray-400 uppercase">
                Security Strength
              </label>
              <span className="text-xs font-mono text-cyber-neonCyan">
                {entropy} bits
              </span>
            </div>
            <input
              type="range"
              min="128"
              max="1024"
              step="8"
              value={entropy}
              onChange={(e) => setEntropy(Number(e.target.value))}
              className="w-full accent-cyber-neonCyan"
            />
            {preset.startsWith("JWT") &&
              entropy < parseInt(preset.split("HS")[1]) && (
                <div className="flex items-start space-x-2 text-cyber-neonYellow mt-2">
                  <ShieldAlert size={14} className="mt-0.5" />
                  <span className="text-[10px] font-mono leading-tight">
                    Warning: Configured entropy is lower than recommended for{" "}
                    {preset}.
                  </span>
                </div>
              )}
          </div>

          <button
            onClick={generateSecret}
            className="w-full flex items-center justify-center space-x-2 bg-cyber-dark border border-cyber-neonCyan text-cyber-neonCyan p-3 hover:bg-cyber-neonCyan hover:text-black transition-all shadow-[0_0_10px_rgba(0,243,255,0.1)] hover:shadow-neon-cyan"
          >
            <RefreshCw size={16} />
            <span className="font-heading uppercase font-bold tracking-wider">
              GENERATE SECRET
            </span>
          </button>
        </div>

        {/* Output Panel */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-cyber-dark border border-gray-800 p-6 relative overflow-hidden group">
            {/* Holographic background line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyber-neonCyan to-transparent opacity-30"></div>

            <label className="text-xs font-mono text-gray-500 uppercase mb-4 block">
              Generated Output
            </label>

            {error ? (
              <div className="text-red-500 font-mono text-sm break-all">
                {error}
              </div>
            ) : (
              <div className="font-mono text-lg text-white break-all leading-relaxed selection:bg-cyber-neonPink selection:text-white">
                {secret || "Generating..."}
              </div>
            )}

            {/* Action Overlay */}
            <div className="mt-8 flex justify-end space-x-3">
              <button
                onClick={handleCopy}
                disabled={!secret}
                className="flex items-center space-x-2 px-4 py-2 bg-cyber-panel border border-gray-700 hover:border-cyber-neonCyan hover:text-cyber-neonCyan transition-colors disabled:opacity-50"
              >
                {copied ? (
                  <CheckCircle2 size={16} className="text-cyber-neonGreen" />
                ) : (
                  <Copy size={16} />
                )}
                <span className="font-heading uppercase font-bold tracking-wide text-sm">
                  {copied ? "Copied to Clipboard" : "Copy"}
                </span>
              </button>

              <button
                disabled={!secret}
                className="flex items-center space-x-2 px-4 py-2 bg-cyber-neonPink/10 border border-cyber-neonPink text-cyber-neonPink hover:bg-cyber-neonPink hover:text-white transition-colors disabled:opacity-50"
              >
                <span className="font-heading uppercase font-bold tracking-wide text-sm">
                  Save to Vault
                </span>
              </button>
            </div>
          </div>

          <div className="bg-cyber-panel/50 border border-gray-800 p-4">
            <p className="text-xs font-mono text-gray-400">
              <strong className="text-cyber-neonCyan">
                SECURE ENV EXPORT:
              </strong>{" "}
              Secrets are generated using OS-level cryptographically secure
              random number generators (
              <code className="text-gray-300">OsRng</code>). VaultForge does not
              persist these secrets unless explicitly saved to the encrypted
              Vault.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
